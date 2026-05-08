import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const marcaId = Number(body.marcaId);
    const modeloId = Number(body.modeloId);
    const kilometraje = Number(body.kilometraje);
    const meses = Number(body.meses);
    const anios = Array.isArray(body.anios) ? body.anios : [];
    if (!id || !marcaId || !modeloId || Number.isNaN(kilometraje) || !meses) {
      return NextResponse.json({ message: "Frecuencia invalida." }, { status: 400 });
    }
    await pool.query(
      `UPDATE administracion_algoritmo_visita
       SET modelo_id = ?, marca_id = ?, kilometraje = ?, meses = ?, anios = ?
       WHERE id = ?`,
      [modeloId, marcaId, kilometraje, meses, JSON.stringify(anios), id]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating maintenance algorithm:", error);
    return NextResponse.json({ message: "No se pudo actualizar la frecuencia." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM administracion_algoritmo_visita WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting maintenance algorithm:", error);
    return NextResponse.json({ message: "No se pudo eliminar la frecuencia." }, { status: 500 });
  }
}
