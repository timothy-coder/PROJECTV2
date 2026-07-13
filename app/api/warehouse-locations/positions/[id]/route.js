import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { userCanAccessLevel } from "@/lib/warehouseLocationAccess";

async function requirePermission(action) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["config_anaqueles", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para configurar posiciones." }, { status: 403 }) };
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
    const nivelId = Number(body.nivelId);
    const posicion = Number(body.posicion);
    const activo = body.activo === false ? 0 : 1;

    if (!id || !nivelId || !Number.isFinite(posicion)) {
      return NextResponse.json({ message: "Posicion invalida." }, { status: 400 });
    }
    if (!(await userCanAccessLevel(allowed.user.id, nivelId))) {
      return NextResponse.json({ message: "No tienes asignado el almacen o mostrador de ese nivel." }, { status: 403 });
    }

    const [result] = await pool.query(
      `UPDATE almacen_nivel_posiciones
       SET nivel_id=?, posicion=?, activo=?
       WHERE id=?`,
      [nivelId, posicion, activo, id]
    );
    if (!result.affectedRows) return NextResponse.json({ message: "Posicion no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating shelf position:", error);
    return NextResponse.json({ message: error?.code === "ER_DUP_ENTRY" ? "Ya existe esa posicion en el nivel." : "No se pudo actualizar la posicion." }, { status: error?.code === "ER_DUP_ENTRY" ? 409 : 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const allowed = await requirePermission("delete");
    if (allowed.error) return allowed.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    const [[current]] = await pool.query(
      `SELECT nivel_id
       FROM almacen_nivel_posiciones
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!current) return NextResponse.json({ message: "Posicion no encontrada." }, { status: 404 });
    if (!(await userCanAccessLevel(allowed.user.id, current.nivel_id))) {
      return NextResponse.json({ message: "No tienes asignado el almacen o mostrador de esa posicion." }, { status: 403 });
    }
    const [result] = await pool.query(`DELETE FROM almacen_nivel_posiciones WHERE id=?`, [id]);
    if (!result.affectedRows) return NextResponse.json({ message: "Posicion no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting shelf position:", error);
    return NextResponse.json({ message: "No se pudo eliminar la posicion. Revisa si tiene ubicaciones asociadas." }, { status: 409 });
  }
}
