import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

const FUELS = new Set(["GASOLINA", "DIESEL", "BICOMBUSTIBLE"]);

function normalizeFuel(value) {
  const fuel = String(value || "GASOLINA").trim().toUpperCase();
  return FUELS.has(fuel) ? fuel : "GASOLINA";
}

function payloadFromBody(body) {
  return {
    marcaId: Number(body.marcaId),
    modeloId: Number(body.modeloId),
    version: String(body.version || "").trim(),
    combustible: normalizeFuel(body.combustible),
    monedaId: Number(body.monedaId),
    precioBase: Number(body.precioBase || 0),
    enStock: Boolean(body.enStock),
    existe: body.existe === undefined ? true : Boolean(body.existe),
    tiempoEntregaDias: Number(body.tiempoEntregaDias || 0),
  };
}

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const payload = payloadFromBody(await request.json());
    if (!id || !payload.marcaId || !payload.modeloId || !payload.version || !payload.monedaId || Number.isNaN(payload.precioBase)) {
      return NextResponse.json({ message: "Precio de carro invalido." }, { status: 400 });
    }

    await pool.query(
      `UPDATE ventas_precios
       SET marca_id = ?, modelo_id = ?, version = ?, combustible = ?, moneda_id = ?, precio_base = ?, en_stock = ?, existe = ?, tiempo_entrega_dias = ?
       WHERE id = ?`,
      [payload.marcaId, payload.modeloId, payload.version, payload.combustible, payload.monedaId, payload.precioBase, payload.enStock ? 1 : 0, payload.existe ? 1 : 0, payload.tiempoEntregaDias, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating car price:", error);
    return NextResponse.json({ message: "No se pudo actualizar el precio de carro." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM ventas_precios WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting car price:", error);
    return NextResponse.json({ message: "No se pudo eliminar el precio de carro." }, { status: 500 });
  }
}
