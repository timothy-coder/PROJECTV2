import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

async function getSettings(connection) {
  const [[settings]] = await connection.query(
    `SELECT habilitar_tipo_medida, habilitar_proveedor_en_lote
     FROM configuracion_posventa_inventario
     ORDER BY id ASC
     LIMIT 1`
  );
  return {
    habilitarTipoMedida: settings ? Boolean(settings.habilitar_tipo_medida) : true,
    habilitarProveedorEnLote: settings ? Boolean(settings.habilitar_proveedor_en_lote) : true,
  };
}

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

async function firstId(connection, table) {
  const [[row]] = await connection.query(`SELECT id FROM ${table} ORDER BY id ASC LIMIT 1`);
  return row?.id ? Number(row.id) : null;
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

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (!hasPerm(user.permissions || {}, ["inventario", "lotes"]) && !hasPerm(user.permissions || {}, ["inventario", "lotes_edit"]) && !hasPerm(user.permissions || {}, ["inventario", "lotes_editall"])) {
      return NextResponse.json({ message: "No tienes permiso para crear lotes." }, { status: 403 });
    }
    const body = await request.json();
    const productoId = Number(body.productoId || 0);
    const numeroFactura = String(body.numeroFactura || "").trim();
    const numeroFacturaDb = numeroFactura || null;
    const tipoComprobanteId = body.tipoComprobanteId ? Number(body.tipoComprobanteId) : null;
    const precioCompra = Number(body.precioCompra || 0);
    const stockLote = Number(body.stockLote || 0);
    const margenComercial = body.margenComercial === "" || body.margenComercial === null || body.margenComercial === undefined ? null : Number(body.margenComercial);
    let precioVentaSinIgv = body.precioVentaSinIgv === "" || body.precioVentaSinIgv === null || body.precioVentaSinIgv === undefined ? null : Number(body.precioVentaSinIgv);
    const precioVentaConIgvInput = body.precioVentaConIgv === "" || body.precioVentaConIgv === null || body.precioVentaConIgv === undefined ? null : Number(body.precioVentaConIgv);
    const fechaVencimiento = body.fechaVencimiento || null;
    const settings = await getSettings(connection);
    const defaultCurrencyId = await getDefaultCurrencyId(connection);
    const monedaId = body.monedaId ? Number(body.monedaId) : defaultCurrencyId;
    const tipoCambio = monedaId && defaultCurrencyId && Number(monedaId) !== Number(defaultCurrencyId) ? Number(body.tipoCambio || 0) : null;
    const tipoMedidaId = body.tipoMedidaId ? Number(body.tipoMedidaId) : settings.habilitarTipoMedida ? null : await firstId(connection, "configuracion_tipos_medida");
    const proveedorId = body.proveedorId ? Number(body.proveedorId) : settings.habilitarProveedorEnLote ? null : await firstId(connection, "administracion_proveedores");
    const taxFactor = await getTaxFactor(connection);
    const precioCompraCalculado = tipoCambio ? precioCompra * tipoCambio : precioCompra;
    if (margenComercial !== null && Number.isFinite(precioCompraCalculado) && precioCompraCalculado > 0) {
      precioVentaSinIgv = Number((precioCompraCalculado / (1 - margenComercial / 100)).toFixed(2));
    }
    const precioVentaConIgv = precioVentaSinIgv !== null ? Number((precioVentaSinIgv * taxFactor).toFixed(2)) : precioVentaConIgvInput;

    if (!productoId || !tipoMedidaId || !monedaId || stockLote < 0) {
      return NextResponse.json({ message: "Producto, unidad de medida, moneda y stock son obligatorios." }, { status: 400 });
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

    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO posventa_productos_lotes
       (producto_id, tipo_medida_id, proveedor_id, numero_factura, tipo_comprobante_id, fecha_vencimiento, precio_compra, moneda_id, tipo_cambio,
        margen_comercial, precio_venta_sin_igv, precio_venta_con_igv, stock_lote, stock_usado, stock_disponible, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [productoId, tipoMedidaId, proveedorId, numeroFacturaDb, tipoComprobanteId, fechaVencimiento, precioCompra, monedaId, tipoCambio, margenComercial, precioVentaSinIgv, precioVentaConIgv, stockLote, stockLote, user?.id || null]
    );
    await connection.query(
      `UPDATE posventa_productos
       SET precio_venta = COALESCE(?, precio_venta), moneda_id = ?
       WHERE id = ?`,
      [precioVentaConIgv, monedaId, productoId]
    );
    await recalcProductStock(connection, productoId);
    await connection.commit();

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating product lot:", error);
    return NextResponse.json({ message: "No se pudo crear el lote." }, { status: 500 });
  } finally {
    connection.release();
  }
}
