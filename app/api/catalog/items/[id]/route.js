import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

function payload(body) {
  return { groupId: Number(body.groupId), clave: String(body.clave || "").trim(), valor: String(body.valor || "").trim(), orden: Number(body.orden || 0), isActive: body.isActive === undefined ? true : Boolean(body.isActive) };
}

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const data = payload(await request.json());
    if (!id || !data.groupId || !data.clave) return NextResponse.json({ message: "Especificacion invalida." }, { status: 400 });
    await pool.query(`UPDATE ventas_precio_specs_item SET group_id=?, clave=?, valor=?, orden=?, is_active=? WHERE id=?`, [data.groupId, data.clave, data.valor, data.orden, data.isActive ? 1 : 0, id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating spec item:", error);
    return NextResponse.json({ message: "No se pudo actualizar la especificacion." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM ventas_precio_specs_item WHERE id=?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting spec item:", error);
    return NextResponse.json({ message: "No se pudo eliminar la especificacion." }, { status: 500 });
  }
}
