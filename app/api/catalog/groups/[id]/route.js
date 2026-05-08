import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

function payload(body) {
  return { precioId: Number(body.precioId), nombre: String(body.nombre || "").trim(), orden: Number(body.orden || 0), isActive: body.isActive === undefined ? true : Boolean(body.isActive) };
}

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const data = payload(await request.json());
    if (!id || !data.precioId || !data.nombre) return NextResponse.json({ message: "Grupo invalido." }, { status: 400 });
    await pool.query(`UPDATE ventas_precio_specs_group SET precio_id=?, nombre=?, orden=?, is_active=? WHERE id=?`, [data.precioId, data.nombre, data.orden, data.isActive ? 1 : 0, id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating spec group:", error);
    return NextResponse.json({ message: "No se pudo actualizar el grupo." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM ventas_precio_specs_group WHERE id=?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting spec group:", error);
    return NextResponse.json({ message: "No se pudo eliminar el grupo." }, { status: 500 });
  }
}
