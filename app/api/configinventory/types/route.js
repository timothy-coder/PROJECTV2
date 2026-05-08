import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const nombre = String(body.nombre || "").trim();

    if (!nombre) {
      return NextResponse.json({ message: "El nombre es obligatorio." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_inventario_tipo (nombre) VALUES (?)`,
      [nombre]
    );

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating inventory type:", error);
    return NextResponse.json({ message: "No se pudo crear el tipo de inventario." }, { status: 500 });
  }
}
