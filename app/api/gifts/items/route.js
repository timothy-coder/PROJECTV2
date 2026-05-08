import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function payloadFromBody(body) {
  return {
    detalle: String(body.detalle || "").trim(),
    lote: String(body.lote || "").trim() || null,
    precioCompra: Number(body.precioCompra || 0),
    precioVenta: body.precioVenta === "" || body.precioVenta === null ? null : Number(body.precioVenta),
    impuestoId: body.impuestoId ? Number(body.impuestoId) : null,
    regaloTienda: body.regaloTienda ? 1 : 0,
    monedaId: Number(body.monedaId),
  };
}

export async function POST(request) {
  try {
    const payload = payloadFromBody(await request.json());
    if (!payload.detalle || !payload.monedaId || Number.isNaN(payload.precioCompra)) {
      return NextResponse.json({ message: "Completa detalle, moneda y precio de compra." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO ventas_regalos_disponibles
       (detalle, lote, precio_compra, precio_venta, impuesto_id, regalo_tienda, moneda_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [payload.detalle, payload.lote, payload.precioCompra, payload.precioVenta, payload.impuestoId, payload.regaloTienda, payload.monedaId]
    );

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating gift:", error);
    return NextResponse.json({ message: "No se pudo crear el regalo." }, { status: 500 });
  }
}
