import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapTaller(row) {
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
      return NextResponse.json({ talleres: [] });
    }

    const [rows] = await pool.query(
      `SELECT id, centro_id, nombre, created_at
       FROM configuracion_talleres
       WHERE centro_id = ?
       ORDER BY nombre ASC`,
      [centroId]
    );

    return NextResponse.json({ talleres: rows.map(mapTaller) });
  } catch (error) {
    console.error("Error loading workshops:", error);

    return NextResponse.json(
      { message: "No se pudieron cargar los talleres." },
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
        { message: "El nombre del taller es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_talleres (centro_id, nombre)
       VALUES (?, ?)`,
      [centroId, nombre]
    );

    const [rows] = await pool.query(
      `SELECT id, centro_id, nombre, created_at
       FROM configuracion_talleres
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ taller: mapTaller(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error creating workshop:", error);

    return NextResponse.json(
      { message: "No se pudo crear el taller." },
      { status: 500 }
    );
  }
}
