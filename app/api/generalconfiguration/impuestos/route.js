import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapImpuesto(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    porcentaje: Number(row.porcentaje),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, porcentaje, is_active, created_at, updated_at
       FROM configuracion_impuestos
       ORDER BY nombre ASC`
    );

    return NextResponse.json({ impuestos: rows.map(mapImpuesto) });
  } catch (error) {
    console.error("Error loading taxes:", error);

    return NextResponse.json(
      { message: "No se pudieron cargar los impuestos." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const nombre = String(body?.nombre || "").trim();
    const porcentaje = Number(body?.porcentaje);
    const isActive = body?.isActive === false ? 0 : 1;

    if (!nombre || Number.isNaN(porcentaje) || porcentaje < 0) {
      return NextResponse.json(
        { message: "Nombre y porcentaje valido son obligatorios." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_impuestos (nombre, porcentaje, is_active)
       VALUES (?, ?, ?)`,
      [nombre, porcentaje, isActive]
    );

    const [rows] = await pool.query(
      `SELECT id, nombre, porcentaje, is_active, created_at, updated_at
       FROM configuracion_impuestos
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ impuesto: mapImpuesto(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error creating tax:", error);

    return NextResponse.json(
      { message: "No se pudo crear el impuesto." },
      { status: 500 }
    );
  }
}
