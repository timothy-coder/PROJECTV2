import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

async function requirePermission(action) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["config_anaqueles", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para configurar anaqueles." }, { status: 403 }) };
  }
  return { user };
}

export async function PUT(request, { params }) {
  try {
    const allowed = await requirePermission("edit");
    if (allowed.error) return allowed.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const codigo = String(body.codigo || "").trim();
    const descripcion = String(body.descripcion || "").trim() || null;
    const tallerId = body.tallerId ? Number(body.tallerId) : null;
    const mostradorId = body.mostradorId ? Number(body.mostradorId) : null;
    const activo = body.activo === false ? 0 : 1;

    if (!id || !codigo || (tallerId && mostradorId)) {
      return NextResponse.json({ message: "Anaquel invalido; selecciona solo taller o mostrador." }, { status: 400 });
    }

    const [result] = await pool.query(
      `UPDATE almacen_anaqueles
       SET codigo=?, descripcion=?, taller_id=?, mostrador_id=?, activo=?
       WHERE id=?`,
      [codigo, descripcion, tallerId, mostradorId, activo, id]
    );
    if (!result.affectedRows) return NextResponse.json({ message: "Anaquel no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating shelf:", error);
    return NextResponse.json({ message: error?.code === "ER_DUP_ENTRY" ? "Ya existe un anaquel con ese codigo." : "No se pudo actualizar el anaquel." }, { status: error?.code === "ER_DUP_ENTRY" ? 409 : 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const allowed = await requirePermission("delete");
    if (allowed.error) return allowed.error;

    const { id: rawId } = await params;
    const [result] = await pool.query(`DELETE FROM almacen_anaqueles WHERE id=?`, [Number(rawId)]);
    if (!result.affectedRows) return NextResponse.json({ message: "Anaquel no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting shelf:", error);
    return NextResponse.json({ message: "No se pudo eliminar el anaquel. Revisa si tiene niveles o ubicaciones asociadas." }, { status: 409 });
  }
}
