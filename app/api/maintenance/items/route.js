import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const isActive = body.isActive ? 1 : 0;
    const mantenimientoId = Array.isArray(body.mantenimientoIds) ? body.mantenimientoIds.join(",") : "";

    if (!name) {
      return NextResponse.json({ message: "El nombre es obligatorio." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO posventa_mantenimiento (name, description, is_active, mantenimiento_id)
       VALUES (?, ?, ?, ?)`,
      [name, description || null, isActive, mantenimientoId || null]
    );

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating maintenance:", error);
    return NextResponse.json({ message: "No se pudo crear el mantenimiento." }, { status: 500 });
  }
}
