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

function quoteCode(id) {
  return `PV-COT-${new Date().getFullYear()}-${String(id).padStart(6, "0")}`;
}

async function requirePointOfSale() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["puntoventa", "view"])) {
    return { error: NextResponse.json({ message: "No tienes permiso para Punto de Venta." }, { status: 403 }) };
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

async function getActivePoint(userId, connection) {
  const [rows] = await connection.query(
    `SELECT id, taller_id, mostrador_id
     FROM configuracion_puntos_venta
     WHERE created_by = ? AND hora_cierre IS NULL
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );
  return rows?.[0] || null;
}

async function getStockLocation(ubicacionId, connection) {
  const [rows] = await connection.query(
    `SELECT u.id, u.lote_id, u.anaquel_id, u.cantidad,
            l.producto_id,
            p.numero_parte, p.descripcion, p.marca, p.precio_compra, p.precio_venta,
            a.taller_id, a.mostrador_id,
            t.nombre AS taller_nombre, m.nombre AS mostrador_nombre
     FROM posventa_lotes_ubicaciones u
     INNER JOIN posventa_productos_lotes l ON l.id = u.lote_id
     INNER JOIN posventa_productos p ON p.id = l.producto_id
     INNER JOIN almacen_anaqueles a ON a.id = u.anaquel_id
     LEFT JOIN configuracion_talleres t ON t.id = a.taller_id
     LEFT JOIN configuracion_mostradores m ON m.id = a.mostrador_id
     WHERE u.id = ?
     LIMIT 1`,
    [ubicacionId]
  );
  return rows?.[0] || null;
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const allowed = await requirePointOfSale();
    if (allowed.error) return allowed.error;

    const body = await request.json();
    const ubicacionId = Number(body.ubicacionId || body.stockId || 0);
    const cantidad = Math.max(1, Math.trunc(toNumber(body.cantidad, 1)));
    if (!ubicacionId) return NextResponse.json({ message: "Selecciona una ubicacion valida." }, { status: 400 });

    const activePoint = await getActivePoint(allowed.user.id, connection);
    const stock = await getStockLocation(ubicacionId, connection);
    if (!stock) return NextResponse.json({ message: "No se encontro la ubicacion del producto." }, { status: 404 });
    if (Number(stock.cantidad || 0) < cantidad) return NextResponse.json({ message: "No hay stock suficiente en la ubicacion seleccionada." }, { status: 400 });

    const destinoTallerId = body.destinoTallerId ? Number(body.destinoTallerId) : activePoint?.taller_id || null;
    const destinoMostradorId = body.destinoMostradorId ? Number(body.destinoMostradorId) : activePoint?.mostrador_id || null;
    if (!destinoTallerId && !destinoMostradorId) {
      return NextResponse.json({ message: "Abre un punto de venta o selecciona un almacen/mostrador destino." }, { status: 400 });
    }

    const taxPercent = await getActiveTaxPercent(connection);
    const taxFactor = 1 + taxPercent / 100;
    const precioUnitario = roundMoney(body.precioUnitario ?? stock.precio_venta);
    const precioCompra = roundMoney(stock.precio_compra);
    const total = roundMoney(precioUnitario * cantidad);
    const subtotalSinIgv = roundMoney(total / taxFactor);
    const igvMonto = roundMoney(total - subtotalSinIgv);

    await connection.beginTransaction();
    const [quoteResult] = await connection.query(
      `INSERT INTO posventa_punto_venta_cotizaciones
        (codigo, punto_venta_id, cliente_nombre, cliente_razon_social,
         subtotal_sin_igv, igv_monto, descuento_productos, descuento_total_tipo,
         descuento_total_valor, descuento_total_monto, total, estado, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'monto', 0, 0, ?, 'cotizacion', ?)`,
      [
        `PV-COT-TMP-${Date.now()}`,
        activePoint?.id || null,
        "Movimiento entre almacenes",
        [stock.taller_nombre, stock.mostrador_nombre].filter(Boolean).join(" / ") || "Origen externo",
        subtotalSinIgv,
        igvMonto,
        total,
        allowed.user.id,
      ]
    );

    const cotizacionId = quoteResult.insertId;
    const codigo = quoteCode(cotizacionId);
    await connection.query(`UPDATE posventa_punto_venta_cotizaciones SET codigo = ? WHERE id = ?`, [codigo, cotizacionId]);

    await connection.query(
      `INSERT INTO posventa_punto_venta_cotizacion_items
        (cotizacion_id, producto_id, lote_id, ubicacion_id, numero_parte, descripcion, marca,
         cantidad, precio_unitario, precio_compra, descuento_tipo, descuento_valor,
         descuento_monto, subtotal, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'monto', 0, 0, ?, ?)`,
      [
        cotizacionId,
        stock.producto_id,
        stock.lote_id,
        stock.id,
        stock.numero_parte,
        stock.descripcion,
        stock.marca,
        cantidad,
        precioUnitario,
        precioCompra,
        subtotalSinIgv,
        total,
      ]
    );

    await connection.query(
      `INSERT INTO posventa_punto_venta_movimientos
        (cotizacion_id, origen_taller_id, origen_mostrador_id, destino_taller_id, destino_mostrador_id,
         producto_id, lote_id, ubicacion_id, cantidad, estado, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
      [
        cotizacionId,
        stock.taller_id || null,
        stock.mostrador_id || null,
        destinoTallerId,
        destinoMostradorId,
        stock.producto_id,
        stock.lote_id,
        stock.id,
        cantidad,
        allowed.user.id,
      ]
    );

    await connection.commit();
    return NextResponse.json({ ok: true, id: cotizacionId, codigo }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating movement quote:", error);
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ message: "Falta crear la tabla de movimientos de punto de venta." }, { status: 500 });
    }
    return NextResponse.json({ message: "No se pudo generar la cotizacion de movimiento." }, { status: 500 });
  } finally {
    connection.release();
  }
}
