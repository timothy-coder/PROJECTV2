import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapMoneda(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    simbolo: row.simbolo,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT id, codigo, nombre, simbolo, is_active, created_at, updated_at
       FROM configuracion_monedas
       ORDER BY codigo ASC`
    );

    return NextResponse.json({ monedas: rows.map(mapMoneda) });
  } catch (error) {
    console.error("Error loading currencies:", error);

    return NextResponse.json(
      { message: "No se pudieron cargar las monedas." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const codigo = String(body?.codigo || "").trim().toUpperCase();
    const nombre = String(body?.nombre || "").trim();
    const simbolo = String(body?.simbolo || "").trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!codigo || !nombre || !simbolo) {
      return NextResponse.json(
        { message: "Codigo, nombre y simbolo son obligatorios." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_monedas (codigo, nombre, simbolo, is_active)
       VALUES (?, ?, ?, ?)`,
      [codigo, nombre, simbolo, isActive]
    );

    const [rows] = await pool.query(
      `SELECT id, codigo, nombre, simbolo, is_active, created_at, updated_at
       FROM configuracion_monedas
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ moneda: mapMoneda(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error creating currency:", error);

    return NextResponse.json(
      { message: "No se pudo crear la moneda." },
      { status: 500 }
    );
  }
}
