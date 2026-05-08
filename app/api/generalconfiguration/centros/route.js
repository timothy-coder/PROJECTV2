import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, created_at
       FROM configuracion_centros
       ORDER BY nombre ASC`
    );

    return NextResponse.json({
      centros: rows.map((row) => ({
        id: row.id,
        nombre: row.nombre,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Error loading configuration centers:", error);

    return NextResponse.json(
      { message: "No se pudieron cargar los centros." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const nombre = String(body?.nombre || "").trim();

    if (!nombre) {
      return NextResponse.json(
        { message: "El nombre del centro es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_centros (nombre)
       VALUES (?)`,
      [nombre]
    );

    const [rows] = await pool.query(
      `SELECT id, nombre, created_at
       FROM configuracion_centros
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    const centro = rows[0];

    return NextResponse.json(
      {
        centro: {
          id: centro.id,
          nombre: centro.nombre,
          createdAt: centro.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating configuration center:", error);

    return NextResponse.json(
      { message: "No se pudo crear el centro." },
      { status: 500 }
    );
  }
}
