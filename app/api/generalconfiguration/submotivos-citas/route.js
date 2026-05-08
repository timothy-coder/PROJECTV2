import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapSubmotivo(row) {
  return {
    id: row.id,
    motivoId: row.motivo_id,
    nombre: row.nombre,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const motivoId = Number(body?.motivoId);
    const nombre = String(body?.nombre || "").trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!Number.isInteger(motivoId) || motivoId <= 0) {
      return NextResponse.json({ message: "Selecciona un motivo valido." }, { status: 400 });
    }

    if (!nombre) {
      return NextResponse.json(
        { message: "El nombre del submotivo es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_submotivos_citas (motivo_id, nombre, is_active)
       VALUES (?, ?, ?)`,
      [motivoId, nombre, isActive]
    );

    const [rows] = await pool.query(
      `SELECT id, motivo_id, nombre, is_active, created_at
       FROM configuracion_submotivos_citas
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ submotivo: mapSubmotivo(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error creating appointment subreason:", error);

    return NextResponse.json(
      { message: "No se pudo crear el submotivo." },
      { status: 500 }
    );
  }
}
