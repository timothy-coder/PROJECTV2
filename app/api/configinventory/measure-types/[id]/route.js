import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const nombre = String(body.nombre || "").trim();
    const abreviatura = String(body.abreviatura || "").trim() || null;

    if (!id || !nombre) {
      return NextResponse.json({ message: "Tipo de medida invalido." }, { status: 400 });
    }

    await pool.query(
      `UPDATE configuracion_tipos_medida
       SET nombre = ?, abreviatura = ?
       WHERE id = ?`,
      [nombre, abreviatura, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating measure type:", error);
    return NextResponse.json({ message: "No se pudo actualizar el tipo de medida." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM configuracion_tipos_medida WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting measure type:", error);
    return NextResponse.json({ message: "No se pudo eliminar el tipo de medida." }, { status: 500 });
  }
}
