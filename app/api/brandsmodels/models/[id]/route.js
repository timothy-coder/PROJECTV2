import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const marcaId = Number(body.marcaId);
    const claseId = body.claseId ? Number(body.claseId) : null;
    const name = String(body.name || "").trim();
    const anios = Array.isArray(body.anios) ? body.anios : [];
    if (!id || !marcaId || !name) return NextResponse.json({ message: "Modelo invalido." }, { status: 400 });
    await pool.query(
      `UPDATE administracion_modelos SET marca_id = ?, clase_id = ?, name = ?, anios = ? WHERE id = ?`,
      [marcaId, claseId, name, JSON.stringify(anios), id]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating model:", error);
    return NextResponse.json({ message: "No se pudo actualizar el modelo." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM administracion_modelos WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting model:", error);
    return NextResponse.json({ message: "No se pudo eliminar el modelo." }, { status: 500 });
  }
}
