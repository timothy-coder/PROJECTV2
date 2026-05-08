import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapMostrador(row) {
  return {
    id: row.id,
    centroId: row.centro_id,
    nombre: row.nombre,
    createdAt: row.created_at,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const centroId = Number(searchParams.get("centroId"));

    if (!Number.isInteger(centroId) || centroId <= 0) {
      return NextResponse.json({ mostradores: [] });
    }

    const [rows] = await pool.query(
      `SELECT id, centro_id, nombre, created_at
       FROM configuracion_mostradores
       WHERE centro_id = ?
       ORDER BY nombre ASC`,
      [centroId]
    );

    return NextResponse.json({ mostradores: rows.map(mapMostrador) });
  } catch (error) {
    console.error("Error loading counters:", error);

    return NextResponse.json(
      { message: "No se pudieron cargar los mostradores." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const centroId = Number(body?.centroId);
    const nombre = String(body?.nombre || "").trim();

    if (!Number.isInteger(centroId) || centroId <= 0) {
      return NextResponse.json({ message: "Selecciona un centro valido." }, { status: 400 });
    }

    if (!nombre) {
      return NextResponse.json(
        { message: "El nombre del mostrador es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_mostradores (centro_id, nombre)
       VALUES (?, ?)`,
      [centroId, nombre]
    );

    const [rows] = await pool.query(
      `SELECT id, centro_id, nombre, created_at
       FROM configuracion_mostradores
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ mostrador: mapMostrador(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error creating counter:", error);

    return NextResponse.json(
      { message: "No se pudo crear el mostrador." },
      { status: 500 }
    );
  }
}
