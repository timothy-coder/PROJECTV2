import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const nombre = String(body.nombre || "").trim();

    if (!id || !nombre) {
      return NextResponse.json({ message: "Tipo de inventario invalido." }, { status: 400 });
    }

    await pool.query(
      `UPDATE configuracion_inventario_tipo SET nombre = ? WHERE id = ?`,
      [nombre, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating inventory type:", error);
    return NextResponse.json({ message: "No se pudo actualizar el tipo de inventario." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM configuracion_inventario_tipo WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting inventory type:", error);
    return NextResponse.json({ message: "No se pudo eliminar el tipo de inventario." }, { status: 500 });
  }
}
