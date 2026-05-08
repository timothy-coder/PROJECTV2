import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapMotivo(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    submotivos: [],
  };
}

function mapSubmotivo(row) {
  return {
    id: row.id,
    motivoId: row.motivo_id,
    nombre: row.nombre,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const [motivosRows] = await pool.query(
      `SELECT id, nombre, is_active, created_at
       FROM configuracion_motivos_citas
       ORDER BY nombre ASC`
    );
    const [submotivosRows] = await pool.query(
      `SELECT id, motivo_id, nombre, is_active, created_at
       FROM configuracion_submotivos_citas
       ORDER BY nombre ASC`
    );

    const motivos = motivosRows.map(mapMotivo);
    const byId = new Map(motivos.map((motivo) => [motivo.id, motivo]));

    submotivosRows.map(mapSubmotivo).forEach((submotivo) => {
      byId.get(submotivo.motivoId)?.submotivos.push(submotivo);
    });

    return NextResponse.json({ motivos });
  } catch (error) {
    console.error("Error loading appointment reasons:", error);

    return NextResponse.json(
      { message: "No se pudieron cargar los motivos." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const nombre = String(body?.nombre || "").trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!nombre) {
      return NextResponse.json(
        { message: "El nombre del motivo es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_motivos_citas (nombre, is_active)
       VALUES (?, ?)`,
      [nombre, isActive]
    );

    const [rows] = await pool.query(
      `SELECT id, nombre, is_active, created_at
       FROM configuracion_motivos_citas
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ motivo: mapMotivo(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error creating appointment reason:", error);

    return NextResponse.json(
      { message: "No se pudo crear el motivo." },
      { status: 500 }
    );
  }
}
