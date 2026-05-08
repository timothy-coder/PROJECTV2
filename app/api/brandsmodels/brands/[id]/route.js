import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const name = String(body.name || "").trim();
    const imageUrl = String(body.imageUrl || "").trim() || null;
    if (!id || !name) return NextResponse.json({ message: "Marca invalida." }, { status: 400 });
    await pool.query(`UPDATE administracion_marcas SET name = ?, image_url = ? WHERE id = ?`, [name, imageUrl, id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating brand:", error);
    return NextResponse.json({ message: "No se pudo actualizar la marca." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    await pool.query(`DELETE FROM administracion_marcas WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting brand:", error);
    return NextResponse.json({ message: "No se pudo eliminar la marca." }, { status: 500 });
  }
}
