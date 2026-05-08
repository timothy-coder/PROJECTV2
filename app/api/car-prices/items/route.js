import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function payloadFromBody(body) {
  return {
    marcaId: Number(body.marcaId),
    modeloId: Number(body.modeloId),
    version: String(body.version || "").trim(),
    monedaId: Number(body.monedaId),
    precioBase: Number(body.precioBase || 0),
    enStock: Boolean(body.enStock),
    existe: body.existe === undefined ? true : Boolean(body.existe),
    tiempoEntregaDias: Number(body.tiempoEntregaDias || 0),
  };
}

export async function POST(request) {
  try {
    const payload = payloadFromBody(await request.json());
    if (!payload.marcaId || !payload.modeloId || !payload.version || !payload.monedaId || Number.isNaN(payload.precioBase)) {
      return NextResponse.json({ message: "Completa marca, modelo, version, moneda y precio base." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO ventas_precios
       (marca_id, modelo_id, version, moneda_id, precio_base, en_stock, existe, tiempo_entrega_dias)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.marcaId, payload.modeloId, payload.version, payload.monedaId, payload.precioBase, payload.enStock ? 1 : 0, payload.existe ? 1 : 0, payload.tiempoEntregaDias]
    );

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating car price:", error);
    return NextResponse.json({ message: "No se pudo crear el precio de carro." }, { status: 500 });
  }
}
