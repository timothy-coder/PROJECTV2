import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const isActive = body.isActive ? 1 : 0;
    const mantenimientoId = Array.isArray(body.mantenimientoIds) ? body.mantenimientoIds.join(",") : "";

    if (!id || !name) {
      return NextResponse.json({ message: "Mantenimiento invalido." }, { status: 400 });
    }

    await pool.query(
      `UPDATE posventa_mantenimiento
       SET name = ?, description = ?, is_active = ?, mantenimiento_id = ?
       WHERE id = ?`,
      [name, description || null, isActive, mantenimientoId || null, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating maintenance:", error);
    return NextResponse.json({ message: "No se pudo actualizar el mantenimiento." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM posventa_mantenimiento WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting maintenance:", error);
    return NextResponse.json({ message: "No se pudo eliminar el mantenimiento." }, { status: 500 });
  }
}
