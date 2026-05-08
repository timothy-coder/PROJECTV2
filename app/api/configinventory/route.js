import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, created_at, updated_at
       FROM configuracion_inventario_tipo
       ORDER BY nombre ASC`
    );

    return NextResponse.json({
      types: rows.map((row) => ({
        id: row.id,
        nombre: row.nombre,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    console.error("Error loading inventory config:", error);
    return NextResponse.json({ message: "No se pudieron cargar tipos de inventario." }, { status: 500 });
  }
}
