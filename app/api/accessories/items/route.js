import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function payloadFromBody(body) {
  const appliesAll = Boolean(body.aplicaTodos);
  return {
    aplicaTodos: appliesAll,
    marcaId: appliesAll ? null : Number(body.marcaId),
    modeloId: appliesAll ? null : Number(body.modeloId),
    detalle: String(body.detalle || "").trim(),
    numeroParte: String(body.numeroParte || "").trim(),
    precio: Number(body.precio || 0),
    precioVenta: body.precioVenta === "" || body.precioVenta === null ? null : Number(body.precioVenta),
    impuestoId: body.impuestoId ? Number(body.impuestoId) : null,
    monedaId: Number(body.monedaId),
  };
}

export async function POST(request) {
  try {
    const payload = payloadFromBody(await request.json());
    if ((!payload.aplicaTodos && (!payload.marcaId || !payload.modeloId)) || !payload.detalle || !payload.numeroParte || !payload.monedaId || Number.isNaN(payload.precio)) {
      return NextResponse.json({ message: "Completa marca, modelo, detalle, numero de parte, moneda y precio; o marca que aplica a todas las marcas y modelos." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO ventas_accesorios_disponibles
       (marca_id, modelo_id, detalle, numero_parte, precio, precio_venta, impuesto_id, moneda_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.marcaId, payload.modeloId, payload.detalle, payload.numeroParte, payload.precio, payload.precioVenta, payload.impuestoId, payload.monedaId]
    );

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating accessory:", error);
    return NextResponse.json({ message: "No se pudo crear el accesorio." }, { status: 500 });
  }
}
