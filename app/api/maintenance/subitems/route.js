import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const parentId = Number(body.posventaMantenimientoId);
    const isActive = body.isActive ? 1 : 0;

    if (!name || !parentId) {
      return NextResponse.json({ message: "Completa mantenimiento y nombre." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO posventa_submantenimiento (name, description, posventamantenimiento_id, is_active)
       VALUES (?, ?, ?, ?)`,
      [name, description || null, parentId, isActive]
    );

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating submaintenance:", error);
    return NextResponse.json({ message: "No se pudo crear el submantenimiento." }, { status: 500 });
  }
}
