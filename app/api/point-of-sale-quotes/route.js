import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { buildPointOfSaleQuoteScope, canViewPointOfSaleModule } from "@/lib/pointOfSaleScope";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

const DEFAULT_TAX_PERCENT = 18;
const VALID_STATES = new Set(["cotizacion", "vendida", "anticipo", "cancelada"]);

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

function normalizeState(value) {
  return VALID_STATES.has(value) ? value : "cotizacion";
}

function quoteCode(id) {
  return `PV-COT-${new Date().getFullYear()}-${String(id).padStart(6, "0")}`;
}

function mapQuote(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    puntoVentaId: row.punto_venta_id,
    puntoVentaCodigo: row.punto_venta_codigo || "",
    clienteId: row.cliente_id,
    clienteNombre: row.cliente_nombre || "",
    clienteRazonSocial: row.cliente_razon_social || "",
    clienteCelular: row.cliente_celular || "",
    clienteEmail: row.cliente_email || "",
    clienteDocumento: row.cliente_documento || "",
    subtotalSinIgv: Number(row.subtotal_sin_igv || 0),
    igvMonto: Number(row.igv_monto || 0),
    descuentoProductos: Number(row.descuento_productos || 0),
    descuentoTotalTipo: row.descuento_total_tipo || "monto",
    descuentoTotalValor: Number(row.descuento_total_valor || 0),
    descuentoTotalMonto: Number(row.descuento_total_monto || 0),
    total: Number(row.total || 0),
    estado: row.estado || "cotizacion",
    createdBy: row.created_by,
    itemCount: Number(row.item_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row) {
  return {
    id: row.id,
    cotizacionId: row.cotizacion_id,
    productoId: row.producto_id,
    comboId: row.combo_id,
    loteId: row.lote_id,
    ubicacionId: row.ubicacion_id,
    numeroParte: row.numero_parte || "",
    descripcion: row.descripcion || "",
    marca: row.marca || "",
    tipoLogistico: row.tipo_logistico || "",
    cantidad: Number(row.cantidad || 0),
    precioUnitario: Number(row.precio_unitario || 0),
    precioCompra: Number(row.precio_compra || 0),
    descuentoTipo: row.descuento_tipo || "monto",
    descuentoValor: Number(row.descuento_valor || 0),
    descuentoMonto: Number(row.descuento_monto || 0),
    subtotal: Number(row.subtotal || 0),
    total: Number(row.total || 0),
    createdAt: row.created_at,
  };
}

async function requirePointOfSale(action = "view") {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };

  const permissions = user.permissions || {};
  const allowed =
    hasPerm(permissions, ["puntoventa_cotizaciones", action]) ||
    (action === "view" && canViewPointOfSaleModule(user, "puntoventa_cotizaciones")) ||
    hasPerm(permissions, ["puntoventa", action]) ||
    (action === "create" && hasPerm(permissions, ["puntoventa", "view"]));

  if (!allowed) {
    return { error: NextResponse.json({ message: "No tienes permiso para Punto de Venta." }, { status: 403 }) };
  }
  return { user };
}

async function getActiveTaxPercent(connection = pool) {
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

async function isCashOpeningEnabled(connection = pool) {
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

async function getActivePointId(userId, connection = pool) {
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
    .filter((item) => item.descripcion && item.cantidad > 0);
}

export async function GET(request) {
  try {
    const allowed = await requirePointOfSale("view");
    if (allowed.error) return allowed.error;

    const { searchParams } = new URL(request.url);
    const state = searchParams.get("estado");
    const params = [];
    const where = [];
    const scope = buildPointOfSaleQuoteScope(allowed.user, { moduleKey: "puntoventa_cotizaciones", quoteAlias: "q" });
    if (scope.where) {
      where.push(scope.where);
      params.push(...scope.params);
    }
    if (VALID_STATES.has(state)) {
      where.push("q.estado = ?");
      params.push(state);
    }

    const [rows] = await pool.query(
      `SELECT q.*, pv.codigo AS punto_venta_codigo, COUNT(i.id) AS item_count
       FROM posventa_punto_venta_cotizaciones q
       LEFT JOIN configuracion_puntos_venta pv ON pv.id = q.punto_venta_id
       LEFT JOIN posventa_punto_venta_cotizacion_items i ON i.cotizacion_id = q.id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       GROUP BY q.id, pv.codigo
       ORDER BY q.created_at DESC, q.id DESC
       LIMIT 300`,
      params
    );

    return NextResponse.json({ items: rows.map(mapQuote) });
  } catch (error) {
    console.error("Error loading point of sale quotes:", error);
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ message: "Falta crear las tablas de cotizaciones de punto de venta." }, { status: 500 });
    }
    return NextResponse.json({ message: "No se pudo cargar las cotizaciones de punto de venta." }, { status: 500 });
  }
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const allowed = await requirePointOfSale("create");
    if (allowed.error) return allowed.error;

    const body = await request.json();
    const taxPercent = await getActiveTaxPercent(connection);
    const taxFactor = 1 + taxPercent / 100;
    const items = normalizeItems(body.items, taxFactor);

    if (!items.length) {
      return NextResponse.json({ message: "Agrega al menos un producto para guardar la cotizacion." }, { status: 400 });
    }

    const lineTotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
    const descuentoProductos = roundMoney(items.reduce((sum, item) => sum + item.descuentoMonto, 0));
    const descuentoTotalTipo = normalizeDiscountType(body.descuentoTotalTipo ?? body.totalDiscountType);
    const descuentoTotalValor = Math.max(0, toNumber(body.descuentoTotalValor ?? body.totalDiscountValue));
    const descuentoTotalMonto = roundMoney(discountAmount(lineTotal, descuentoTotalTipo, descuentoTotalValor));
    const total = roundMoney(Math.max(lineTotal - descuentoTotalMonto, 0));
    const subtotalSinIgv = roundMoney(total / taxFactor);
    const igvMonto = roundMoney(total - subtotalSinIgv);
    const estado = normalizeState(body.estado);
    const anticipoMonto = roundMoney(body.anticipoMonto);
    const puntoVentaId = body.puntoVentaId ? Number(body.puntoVentaId) : await getActivePointId(allowed.user.id, connection);

    if (estado === "anticipo" && anticipoMonto <= 0) {
      return NextResponse.json({ message: "Ingresa un monto de anticipo mayor a cero." }, { status: 400 });
    }
    if (estado === "anticipo" && anticipoMonto > total) {
      return NextResponse.json({ message: "El anticipo no puede ser mayor al total de la cotizacion." }, { status: 400 });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO posventa_punto_venta_cotizaciones
        (codigo, punto_venta_id, cliente_id, cliente_nombre, cliente_razon_social, cliente_celular,
         cliente_email, cliente_documento, subtotal_sin_igv, igv_monto, descuento_productos,
         descuento_total_tipo, descuento_total_valor, descuento_total_monto, total, estado, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `PV-COT-TMP-${Date.now()}`,
        puntoVentaId || null,
        body.clienteId ? Number(body.clienteId) : null,
        String(body.clienteNombre || "").trim() || null,
        String(body.clienteRazonSocial || "").trim() || null,
        String(body.clienteCelular || "").trim() || null,
        String(body.clienteEmail || body.clienteCorreo || "").trim() || null,
        String(body.clienteDocumento || "").trim() || null,
        subtotalSinIgv,
        igvMonto,
        descuentoProductos,
        descuentoTotalTipo,
        roundMoney(descuentoTotalValor),
        descuentoTotalMonto,
        total,
        estado,
        allowed.user.id,
      ]
    );

    const cotizacionId = result.insertId;
    const codigo = quoteCode(cotizacionId);
    await connection.query(`UPDATE posventa_punto_venta_cotizaciones SET codigo = ? WHERE id = ?`, [codigo, cotizacionId]);

    await connection.query(
      `INSERT INTO posventa_punto_venta_cotizacion_items
        (cotizacion_id, producto_id, combo_id, lote_id, ubicacion_id, numero_parte, descripcion, marca,
         tipo_logistico, cantidad, precio_unitario, precio_compra, descuento_tipo, descuento_valor,
         descuento_monto, subtotal, total)
       VALUES ${items.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
      items.flatMap((item) => [
        cotizacionId,
        item.productoId,
        item.comboId,
        item.loteId,
        item.ubicacionId,
        item.numeroParte,
        item.descripcion,
        item.marca,
        item.tipoLogistico,
        item.cantidad,
        item.precioUnitario,
        item.precioCompra,
        item.descuentoTipo,
        item.descuentoValor,
        item.descuentoMonto,
        item.subtotal,
        item.total,
      ])
    );

    if (estado === "anticipo") {
      await connection.query(
        `INSERT INTO posventa_punto_venta_anticipos
          (cotizacion_id, punto_venta_id, monto, saldo_pendiente, estado, observacion, created_by)
         VALUES (?, ?, ?, ?, 'pendiente', ?, ?)`,
        [
          cotizacionId,
          puntoVentaId || null,
          anticipoMonto,
          roundMoney(total - anticipoMonto),
          String(body.anticipoObservacion || "").trim() || null,
          allowed.user.id,
        ]
      );
    }

    await connection.commit();

    return NextResponse.json({
      ok: true,
      id: cotizacionId,
      codigo,
      total,
      subtotalSinIgv,
      igvMonto,
      descuentoProductos,
      descuentoTotalMonto,
      anticipoMonto: estado === "anticipo" ? anticipoMonto : 0,
    }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating point of sale quote:", error);
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ message: "Falta crear las tablas de cotizaciones de punto de venta." }, { status: 500 });
    }
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Ya existe una cotizacion con ese codigo." }, { status: 409 });
    }
    return NextResponse.json({ message: "No se pudo guardar la cotizacion de punto de venta." }, { status: 500 });
  } finally {
    connection.release();
  }
}
