import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const parentId = Number(body.posventaMantenimientoId);
    const isActive = body.isActive ? 1 : 0;

    if (!id || !name || !parentId) {
      return NextResponse.json({ message: "Submantenimiento invalido." }, { status: 400 });
    }

    await pool.query(
      `UPDATE posventa_submantenimiento
       SET name = ?, description = ?, posventamantenimiento_id = ?, is_active = ?
       WHERE id = ?`,
      [name, description || null, parentId, isActive, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating submaintenance:", error);
    return NextResponse.json({ message: "No se pudo actualizar el submantenimiento." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM posventa_submantenimiento WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting submaintenance:", error);
    return NextResponse.json({ message: "No se pudo eliminar el submantenimiento." }, { status: 500 });
  }
}
