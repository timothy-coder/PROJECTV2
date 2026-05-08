import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapOrigen(row) {
  return {
    id: row.id,
    name: row.name,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, is_active, created_at
       FROM configuracion_origenes_citas
       ORDER BY name ASC`
    );

    return NextResponse.json({ origenes: rows.map(mapOrigen) });
  } catch (error) {
    console.error("Error loading appointment origins:", error);

    return NextResponse.json(
      { message: "No se pudieron cargar los origenes." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!name) {
      return NextResponse.json(
        { message: "El nombre del origen es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_origenes_citas (name, is_active)
       VALUES (?, ?)`,
      [name, isActive]
    );

    const [rows] = await pool.query(
      `SELECT id, name, is_active, created_at
       FROM configuracion_origenes_citas
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ origen: mapOrigen(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error creating appointment origin:", error);

    return NextResponse.json(
      { message: "No se pudo crear el origen." },
      { status: 500 }
    );
  }
}
