import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!id || !name) return NextResponse.json({ message: "Clase invalida." }, { status: 400 });
    await pool.query(`UPDATE administracion_clases SET name = ? WHERE id = ?`, [name, id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating class:", error);
    return NextResponse.json({ message: "No se pudo actualizar la clase." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM administracion_clases WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting class:", error);
    return NextResponse.json({ message: "No se pudo eliminar la clase." }, { status: 500 });
  }
}
