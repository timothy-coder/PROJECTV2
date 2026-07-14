import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

const DEFAULT_TAX_PERCENT = 18;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function discountAmount(base, type, value) {
  const amount = Math.max(0, toNumber(base));
  const discount = Math.max(0, toNumber(value));
  if (!amount || !discount) return 0;
  if (type === "porcentaje") return Math.min(amount, amount * (discount / 100));
  return Math.min(amount, discount);
}

function normalizeDiscountType(value) {
  return value === "porcentaje" ? "porcentaje" : "monto";
}

function saleCode(id) {
  return `PV-VEN-${new Date().getFullYear()}-${String(id).padStart(6, "0")}`;
}

async function requirePointOfSaleSale() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  const permissions = user.permissions || {};
  if (!hasPerm(permissions, ["puntoventa", "view"]) && !hasPerm(permissions, ["puntoventa_cotizaciones", "sell"])) {
    return { error: NextResponse.json({ message: "No tienes permiso para generar comprobantes." }, { status: 403 }) };
  }
  return { user };
}

async function getActiveTaxPercent(connection) {
  try {
    const [rows] = await connection.query(
      `SELECT porcentaje
       FROM configuracion_impuestos
       WHERE is_active = 1
       ORDER BY id ASC
       LIMIT 1`
    );
    return toNumber(rows?.[0]?.porcentaje, DEFAULT_TAX_PERCENT);
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
    return DEFAULT_TAX_PERCENT;
  }
}

async function isCashOpeningEnabled(connection) {
  try {
    const [rows] = await connection.query(
      `SELECT habilitar_apertura_caja
       FROM configuracion_posventa_inventario
       ORDER BY id ASC
       LIMIT 1`
    );
    return Boolean(rows?.[0]?.habilitar_apertura_caja);
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
    return false;
  }
}

async function getActivePointId(userId, connection) {
  if (!await isCashOpeningEnabled(connection)) return null;
  const [rows] = await connection.query(
    `SELECT id
     FROM configuracion_puntos_venta
     WHERE created_by = ? AND hora_cierre IS NULL
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );
  return rows?.[0]?.id || null;
}

function normalizeItems(items, taxFactor) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const cantidad = Math.max(1, Math.trunc(toNumber(item.cantidad ?? item.qty, 1)));
      const precioUnitario = Math.max(0, toNumber(item.precioUnitario ?? item.precioVenta ?? item.precio_venta));
      const precioCompra = Math.max(0, toNumber(item.precioCompra ?? item.precio_compra));
      const descuentoTipo = normalizeDiscountType(item.descuentoTipo ?? item.discountType ?? item.descuento_tipo);
      const descuentoValor = Math.max(0, toNumber(item.descuentoValor ?? item.discountValue ?? item.descuento_valor));
      const lineBase = roundMoney(precioUnitario * cantidad);
      const descuentoMonto = roundMoney(discountAmount(lineBase, descuentoTipo, descuentoValor));
      const total = roundMoney(Math.max(lineBase - descuentoMonto, 0));
      const subtotal = roundMoney(total / taxFactor);

      return {
        productoId: item.productoId ?? item.producto_id ? Number(item.productoId ?? item.producto_id) : null,
        comboId: item.comboId ?? item.combo_id ? Number(item.comboId ?? item.combo_id) : null,
        loteId: item.loteId ?? item.lote_id ? Number(item.loteId ?? item.lote_id) : null,
        ubicacionId: item.ubicacionId ?? item.ubicacion_id ? Number(item.ubicacionId ?? item.ubicacion_id) : null,
        numeroParte: String(item.numeroParte ?? item.numero_parte ?? "").trim() || null,
        descripcion: String(item.descripcion ?? item.name ?? item.nombre ?? "").trim(),
        marca: String(item.marca ?? "").trim() || null,
        tipoLogistico: String(item.tipoLogistico ?? item.tipo_logistico ?? "").trim().slice(0, 10) || null,
        cantidad,
        precioUnitario: roundMoney(precioUnitario),
        precioCompra: roundMoney(precioCompra),
        descuentoTipo,
        descuentoValor: roundMoney(descuentoValor),
        descuentoMonto,
        subtotal,
        total,
      };
    })
    .filter((item) => item.productoId && item.descripcion && item.cantidad > 0);
}

async function syncProductStock(connection, productoId) {
  const [[stock]] = await connection.query(
    `SELECT COALESCE(SUM(stock_lote), 0) AS total,
            COALESCE(SUM(stock_usado), 0) AS usado,
            COALESCE(SUM(stock_disponible), 0) AS disponible
     FROM posventa_productos_lotes
     WHERE producto_id = ?`,
    [productoId]
  );
  await connection.query(
    `UPDATE posventa_productos
     SET stock_total = ?, stock_usado = ?, stock_disponible = ?
     WHERE id = ?`,
    [Number(stock.total || 0), Number(stock.usado || 0), Number(stock.disponible || 0), productoId]
  );
}

async function registerMonthlySale(connection, productoId, cantidad) {
  const now = new Date();
  const anio = now.getFullYear();
  const mes = now.getMonth() + 1;
  const [rows] = await connection.query(
    `SELECT id, cantidad
     FROM posventa_productos_ventames
     WHERE producto_id = ? AND anio = ? AND mes = ?
     ORDER BY id ASC
     LIMIT 1
     FOR UPDATE`,
    [productoId, anio, mes]
  );

  if (rows.length) {
    await connection.query(
      `UPDATE posventa_productos_ventames
       SET cantidad = ?
       WHERE id = ?`,
      [Number(rows[0].cantidad || 0) + cantidad, rows[0].id]
    );
    return;
  }

  await connection.query(
    `INSERT INTO posventa_productos_ventames (producto_id, anio, mes, cantidad)
     VALUES (?, ?, ?, ?)`,
    [productoId, anio, mes, cantidad]
  );
}

async function tableColumns(connection, tableName) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
}

async function insertSale(connection, values) {
  const columns = await tableColumns(connection, "posventa_punto_venta_ventas");
  const entries = Object.entries(values).filter(([column]) => columns.has(column));
  if (!entries.length) throw new Error("La tabla de ventas no tiene columnas compatibles.");

  const [result] = await connection.query(
    `INSERT INTO posventa_punto_venta_ventas
      (${entries.map(([column]) => column).join(", ")})
     VALUES (${entries.map(() => "?").join(", ")})`,
    entries.map(([, value]) => value)
  );
  return { result, columns };
}

async function discountStock(connection, item) {
  if (!item.loteId || !item.ubicacionId) {
    throw new Error(`Selecciona lote y ubicacion para ${item.descripcion}.`);
  }

  const [locationRows] = await connection.query(
    `SELECT id, lote_id, cantidad
     FROM posventa_lotes_ubicaciones
     WHERE id = ? AND lote_id = ?
     LIMIT 1
     FOR UPDATE`,
    [item.ubicacionId, item.loteId]
  );
  const location = locationRows[0];
  if (!location) throw new Error(`No se encontro la ubicacion de ${item.descripcion}.`);
  if (Number(location.cantidad || 0) < item.cantidad) {
    throw new Error(`No hay stock suficiente de ${item.descripcion} en la ubicacion seleccionada.`);
  }

  const [lotRows] = await connection.query(
    `SELECT id, producto_id, stock_lote, stock_usado, stock_disponible
     FROM posventa_productos_lotes
     WHERE id = ? AND producto_id = ?
     LIMIT 1
     FOR UPDATE`,
    [item.loteId, item.productoId]
  );
  const lot = lotRows[0];
  if (!lot) throw new Error(`No se encontro el lote de ${item.descripcion}.`);
  if (Number(lot.stock_disponible || 0) < item.cantidad) {
    throw new Error(`No hay stock disponible en el lote de ${item.descripcion}.`);
  }

  await connection.query(
    `UPDATE posventa_lotes_ubicaciones
     SET cantidad = cantidad - ?
     WHERE id = ?`,
    [item.cantidad, item.ubicacionId]
  );
  await connection.query(
    `UPDATE posventa_productos_lotes
     SET stock_usado = stock_usado + ?,
         stock_disponible = GREATEST(stock_disponible - ?, 0)
     WHERE id = ?`,
    [item.cantidad, item.cantidad, item.loteId]
  );
  await syncProductStock(connection, item.productoId);
  await registerMonthlySale(connection, item.productoId, item.cantidad);
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const allowed = await requirePointOfSaleSale();
    if (allowed.error) return allowed.error;

    const body = await request.json();
    const taxPercent = await getActiveTaxPercent(connection);
    const taxFactor = 1 + taxPercent / 100;
    const items = normalizeItems(body.items, taxFactor);

    if (!items.length) {
      return NextResponse.json({ message: "Agrega al menos un producto para generar el comprobante." }, { status: 400 });
    }

    const lineTotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
    const descuentoProductos = roundMoney(items.reduce((sum, item) => sum + item.descuentoMonto, 0));
    const descuentoTotalTipo = normalizeDiscountType(body.descuentoTotalTipo ?? body.totalDiscountType);
    const descuentoTotalValor = Math.max(0, toNumber(body.descuentoTotalValor ?? body.totalDiscountValue));
    const descuentoTotalMonto = roundMoney(discountAmount(lineTotal, descuentoTotalTipo, descuentoTotalValor));
    const total = roundMoney(Math.max(lineTotal - descuentoTotalMonto, 0));
    const subtotalSinIgv = roundMoney(total / taxFactor);
    const igvMonto = roundMoney(total - subtotalSinIgv);
    const puntoVentaId = body.puntoVentaId ? Number(body.puntoVentaId) : await getActivePointId(allowed.user.id, connection);
    const cotizacionId = body.cotizacionId ? Number(body.cotizacionId) : null;

    await connection.beginTransaction();

    const { result, columns } = await insertSale(connection, {
      codigo: `PV-VEN-TMP-${Date.now()}`,
      cotizacion_id: cotizacionId,
      punto_venta_id: puntoVentaId || null,
      cliente_id: body.clienteId ? Number(body.clienteId) : null,
      cliente_nombre: String(body.clienteNombre || "").trim() || null,
      cliente_razon_social: String(body.clienteRazonSocial || "").trim() || null,
      cliente_celular: String(body.clienteCelular || "").trim() || null,
      cliente_email: String(body.clienteEmail || body.clienteCorreo || "").trim() || null,
      cliente_documento: String(body.clienteDocumento || "").trim() || null,
      subtotal_sin_igv: subtotalSinIgv,
      igv_monto: igvMonto,
      descuento_productos: descuentoProductos,
      descuento_total_tipo: descuentoTotalTipo,
      descuento_total_valor: roundMoney(descuentoTotalValor),
      descuento_total_monto: descuentoTotalMonto,
      total,
      estado: "emitida",
      created_by: allowed.user.id,
    });

    const ventaId = result.insertId;
    const codigo = saleCode(ventaId);
    if (columns.has("codigo")) {
      await connection.query(`UPDATE posventa_punto_venta_ventas SET codigo = ? WHERE id = ?`, [codigo, ventaId]);
    }

    for (const item of items) {
      await discountStock(connection, item);
    }

    if (cotizacionId) {
      await connection.query(`UPDATE posventa_punto_venta_cotizaciones SET estado = 'vendida' WHERE id = ?`, [cotizacionId]);
    }

    await connection.commit();
    return NextResponse.json({ ok: true, id: ventaId, codigo, total, subtotalSinIgv, igvMonto }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating point of sale sale:", error);
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ message: "Falta crear las tablas de ventas de punto de venta." }, { status: 500 });
    }
    return NextResponse.json({ message: error?.message || "No se pudo generar el comprobante." }, { status: 500 });
  } finally {
    connection.release();
  }
}
