import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

async function getDefaultCurrencyId(connection) {
  const [[configured]] = await connection.query(
    `SELECT moneda_id
     FROM configuracion_posventa_monedas
     WHERE is_active = 1
     ORDER BY id ASC
     LIMIT 1`
  );
  if (configured?.moneda_id) return Number(configured.moneda_id);
  const [[fallback]] = await connection.query(
    `SELECT id
     FROM configuracion_monedas
     WHERE is_active = 1
     ORDER BY codigo ASC
     LIMIT 1`
  );
  return fallback?.id ? Number(fallback.id) : null;
}

async function getTaxFactor(connection) {
  const [[tax]] = await connection.query(
    `SELECT porcentaje
     FROM configuracion_impuestos
     WHERE is_active = 1
     ORDER BY id ASC
     LIMIT 1`
  );
  const percentage = Number(tax?.porcentaje || 0) || 18;
  return 1 + percentage / 100;
}

async function recalcProductStock(connection, productoId) {
  const [[stock]] = await connection.query(
    `SELECT COALESCE(SUM(stock_lote), 0) AS total,
            COALESCE(SUM(stock_usado), 0) AS usado,
            COALESCE(SUM(stock_disponible), 0) AS disponible,
            CASE
              WHEN COALESCE(SUM(stock_lote), 0) > 0
                THEN COALESCE(SUM((precio_compra * COALESCE(NULLIF(tipo_cambio, 0), 1)) * stock_lote), 0) / SUM(stock_lote)
              ELSE 0
            END AS precio_compra_medio
     FROM posventa_productos_lotes
     WHERE producto_id = ?`,
    [productoId]
  );
  await connection.query(
    `UPDATE posventa_productos
     SET stock_total = ?, stock_usado = ?, stock_disponible = ?, precio_compra = ?
     WHERE id = ?`,
    [Number(stock.total || 0), Number(stock.usado || 0), Number(stock.disponible || 0), Number(stock.precio_compra_medio || 0), productoId]
  );
}

async function activeVoucherTypeExists(connection, id) {
  if (!id) return false;
  const [[row]] = await connection.query(
    `SELECT id
     FROM configuracion_tipos_comprobante
     WHERE id = ? AND active_configuracion = 1
     LIMIT 1`,
    [id]
  );
  return Boolean(row?.id);
}

async function userCanAccessLotLocations(connection, userId, lotId) {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS total,
            SUM(
              CASE
                WHEN (a.taller_id IS NOT NULL AND ut.usuario_id IS NOT NULL)
                  OR (a.mostrador_id IS NOT NULL AND um.usuario_id IS NOT NULL)
                  OR (a.taller_id IS NULL AND a.mostrador_id IS NULL)
                THEN 1 ELSE 0
              END
            ) AS assigned
     FROM posventa_lotes_ubicaciones u
     INNER JOIN almacen_anaqueles a ON a.id = u.anaquel_id
     LEFT JOIN administracion_usuario_talleres ut
       ON ut.taller_id = a.taller_id AND ut.usuario_id = ?
     LEFT JOIN administracion_usuario_mostradores um
       ON um.mostrador_id = a.mostrador_id AND um.usuario_id = ?
     WHERE u.lote_id = ?`,
    [userId, userId, lotId]
  );
  const total = Number(row?.total || 0);
  const assigned = Number(row?.assigned || 0);
  return total === 0 || total === assigned;
}

function canEditLotByScope(user, lot) {
  if (hasPerm(user.permissions || {}, ["inventario", "lotes_editall"])) return true;
  const isOwn = Number(lot.created_by || 0) === Number(user.id || 0);
  return isOwn && (hasPerm(user.permissions || {}, ["inventario", "lotes_edit"]) || hasPerm(user.permissions || {}, ["inventario", "lotes"]));
}

export async function PUT(request, { params }) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const numeroFactura = String(body.numeroFactura || "").trim();
    const numeroFacturaDb = numeroFactura || null;
    const tipoComprobanteId = body.tipoComprobanteId ? Number(body.tipoComprobanteId) : null;
    const tipoMedidaId = body.tipoMedidaId ? Number(body.tipoMedidaId) : null;
    const proveedorId = body.proveedorId ? Number(body.proveedorId) : null;
    const fechaVencimiento = body.fechaVencimiento || null;
    const precioCompra = Number(body.precioCompra || 0);
    const stockLote = Number(body.stockLote || 0);
    const margenComercial = body.margenComercial === "" || body.margenComercial === null || body.margenComercial === undefined ? null : Number(body.margenComercial);
    let precioVentaSinIgv = body.precioVentaSinIgv === "" || body.precioVentaSinIgv === null || body.precioVentaSinIgv === undefined ? null : Number(body.precioVentaSinIgv);
    const precioVentaConIgvInput = body.precioVentaConIgv === "" || body.precioVentaConIgv === null || body.precioVentaConIgv === undefined ? null : Number(body.precioVentaConIgv);
    const defaultCurrencyId = await getDefaultCurrencyId(connection);
    const monedaId = body.monedaId ? Number(body.monedaId) : defaultCurrencyId;
    const tipoCambio = monedaId && defaultCurrencyId && Number(monedaId) !== Number(defaultCurrencyId) ? Number(body.tipoCambio || 0) : null;
    const taxFactor = await getTaxFactor(connection);
    const precioCompraCalculado = tipoCambio ? precioCompra * tipoCambio : precioCompra;
    if (margenComercial !== null && Number.isFinite(precioCompraCalculado) && precioCompraCalculado > 0) {
      precioVentaSinIgv = Number((precioCompraCalculado / (1 - margenComercial / 100)).toFixed(2));
    }
    const precioVentaConIgv = precioVentaSinIgv !== null ? Number((precioVentaSinIgv * taxFactor).toFixed(2)) : precioVentaConIgvInput;

    if (!id || !tipoMedidaId || !monedaId || stockLote < 0) {
      return NextResponse.json({ message: "Lote invalido." }, { status: 400 });
    }
    if (tipoComprobanteId && !(await activeVoucherTypeExists(connection, tipoComprobanteId))) {
      return NextResponse.json({ message: "El tipo de comprobante no esta activo para configuracion." }, { status: 400 });
    }
    if (tipoCambio !== null && (!Number.isFinite(tipoCambio) || tipoCambio <= 0)) {
      return NextResponse.json({ message: "El tipo de cambio es obligatorio cuando la moneda es diferente a la configurada." }, { status: 400 });
    }
    if (margenComercial !== null && (!Number.isFinite(margenComercial) || margenComercial >= 100)) {
      return NextResponse.json({ message: "El margen comercial debe ser menor a 100%." }, { status: 400 });
    }

    const [[current]] = await connection.query(`SELECT producto_id, stock_usado, created_by FROM posventa_productos_lotes WHERE id = ?`, [id]);
    if (!current) return NextResponse.json({ message: "Lote no encontrado." }, { status: 404 });
    if (!canEditLotByScope(user, current)) {
      return NextResponse.json({ message: "No tienes permiso para editar este lote." }, { status: 403 });
    }
    if (!(await userCanAccessLotLocations(connection, user.id, id))) {
      return NextResponse.json({ message: "No tienes asignado el almacen o mostrador de este lote." }, { status: 403 });
    }
    const stockUsado = Number(current.stock_usado || 0);
    if (stockLote < stockUsado) {
      return NextResponse.json({ message: "El stock del lote no puede ser menor al stock usado." }, { status: 400 });
    }

    await connection.beginTransaction();
    await connection.query(
      `UPDATE posventa_productos_lotes
       SET tipo_medida_id = ?, proveedor_id = ?, numero_factura = ?, tipo_comprobante_id = ?, fecha_vencimiento = ?,
           precio_compra = ?, moneda_id = ?, tipo_cambio = ?, margen_comercial = ?,
           precio_venta_sin_igv = ?, precio_venta_con_igv = ?, stock_lote = ?, stock_disponible = ?
       WHERE id = ?`,
      [tipoMedidaId, proveedorId, numeroFacturaDb, tipoComprobanteId, fechaVencimiento, precioCompra, monedaId, tipoCambio, margenComercial, precioVentaSinIgv, precioVentaConIgv, stockLote, stockLote - stockUsado, id]
    );
    await connection.query(
      `UPDATE posventa_productos
       SET precio_venta = COALESCE(?, precio_venta), moneda_id = ?
       WHERE id = ?`,
      [precioVentaConIgv, monedaId, current.producto_id]
    );
    await recalcProductStock(connection, current.producto_id);
    await connection.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating product lot:", error);
    return NextResponse.json({ message: "No se pudo actualizar el lote." }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function DELETE(_request, { params }) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const { id: rawId } = await params;
    const id = Number(rawId);
    const [[current]] = await connection.query(`SELECT producto_id, stock_usado, created_by FROM posventa_productos_lotes WHERE id = ?`, [id]);
    if (!current) return NextResponse.json({ message: "Lote no encontrado." }, { status: 404 });
    if (!canEditLotByScope(user, current) || !hasPerm(user.permissions || {}, ["inventario", "delete"])) {
      return NextResponse.json({ message: "No tienes permiso para eliminar este lote." }, { status: 403 });
    }
    if (!(await userCanAccessLotLocations(connection, user.id, id))) {
      return NextResponse.json({ message: "No tienes asignado el almacen o mostrador de este lote." }, { status: 403 });
    }
    if (Number(current.stock_usado || 0) > 0) {
      return NextResponse.json({ message: "No se puede eliminar un lote con stock usado." }, { status: 400 });
    }

    await connection.beginTransaction();
    await connection.query(`DELETE FROM posventa_productos_lotes WHERE id = ?`, [id]);
    await recalcProductStock(connection, current.producto_id);
    await connection.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting product lot:", error);
    return NextResponse.json({ message: "No se pudo eliminar el lote." }, { status: 500 });
  } finally {
    connection.release();
  }
}
