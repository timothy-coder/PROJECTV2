import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const dias = Number(body.dias);
    if (!id || !dias || dias < 1) return NextResponse.json({ message: "Frecuencia invalida." }, { status: 400 });
    await pool.query(`UPDATE configuracion_prospeccion_frecuencia SET dias = ? WHERE id = ?`, [dias, id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating prospection frequency:", error);
    return NextResponse.json({ message: "No se pudo actualizar la frecuencia." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM configuracion_prospeccion_frecuencia WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting prospection frequency:", error);
    return NextResponse.json({ message: "No se pudo eliminar la frecuencia." }, { status: 500 });
  }
}
