import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapMeasureType(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    abreviatura: row.abreviatura || "",
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, abreviatura, created_at
       FROM configuracion_tipos_medida
       ORDER BY nombre ASC`
    );

    return NextResponse.json({ measureTypes: rows.map(mapMeasureType) });
  } catch (error) {
    console.error("Error loading measure types:", error);
    return NextResponse.json({ message: "No se pudieron cargar los tipos de medida." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const nombre = String(body.nombre || "").trim();
    const abreviatura = String(body.abreviatura || "").trim() || null;

    if (!nombre) {
      return NextResponse.json({ message: "El nombre es obligatorio." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_tipos_medida (nombre, abreviatura) VALUES (?, ?)`,
      [nombre, abreviatura]
    );

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating measure type:", error);
    return NextResponse.json({ message: "No se pudo crear el tipo de medida." }, { status: 500 });
  }
}
