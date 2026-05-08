import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

function payload(body) {
  return { precioId: Number(body.precioId), nombre: String(body.nombre || "").trim(), orden: Number(body.orden || 0), isActive: body.isActive === undefined ? true : Boolean(body.isActive) };
}

export async function POST(request) {
  try {
    const data = payload(await request.json());
    if (!data.precioId || !data.nombre) return NextResponse.json({ message: "Completa precio y nombre del grupo." }, { status: 400 });
    const [result] = await pool.query(
      `INSERT INTO ventas_precio_specs_group (precio_id, nombre, orden, is_active) VALUES (?, ?, ?, ?)`,
      [data.precioId, data.nombre, data.orden, data.isActive ? 1 : 0]
    );
    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating spec group:", error);
    return NextResponse.json({ message: "No se pudo crear el grupo." }, { status: 500 });
  }
}
