import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { userCanAccessLevel, userCanAccessShelf } from "@/lib/warehouseLocationAccess";

async function requirePermission(action) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["config_anaqueles", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para configurar niveles." }, { status: 403 }) };
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
    const anaquelId = Number(body.anaquelId);
    const codigoNivel = String(body.codigoNivel || "").trim();
    const ordenNivel = Number(body.ordenNivel);
    const activo = body.activo === false ? 0 : 1;

    if (!id || !anaquelId || !codigoNivel || !Number.isFinite(ordenNivel)) {
      return NextResponse.json({ message: "Nivel invalido." }, { status: 400 });
    }
    if (!(await userCanAccessShelf(allowed.user.id, anaquelId))) {
      return NextResponse.json({ message: "No tienes asignado el almacen o mostrador de ese anaquel." }, { status: 403 });
    }

    const [result] = await pool.query(
      `UPDATE almacen_anaquel_niveles
       SET anaquel_id=?, codigo_nivel=?, orden_nivel=?, activo=?
       WHERE id=?`,
      [anaquelId, codigoNivel, ordenNivel, activo, id]
    );
    if (!result.affectedRows) return NextResponse.json({ message: "Nivel no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating shelf level:", error);
    return NextResponse.json({ message: error?.code === "ER_DUP_ENTRY" ? "Ya existe ese codigo u orden para el anaquel." : "No se pudo actualizar el nivel." }, { status: error?.code === "ER_DUP_ENTRY" ? 409 : 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const allowed = await requirePermission("delete");
    if (allowed.error) return allowed.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!(await userCanAccessLevel(allowed.user.id, id))) {
      return NextResponse.json({ message: "No tienes asignado el almacen o mostrador de ese nivel." }, { status: 403 });
    }
    const [result] = await pool.query(`DELETE FROM almacen_anaquel_niveles WHERE id=?`, [id]);
    if (!result.affectedRows) return NextResponse.json({ message: "Nivel no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting shelf level:", error);
    return NextResponse.json({ message: "No se pudo eliminar el nivel. Revisa si tiene posiciones o ubicaciones asociadas." }, { status: 409 });
  }
}
