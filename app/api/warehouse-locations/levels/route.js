import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { userCanAccessShelf } from "@/lib/warehouseLocationAccess";

async function requirePermission(action) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["config_anaqueles", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para configurar niveles." }, { status: 403 }) };
  }
  return { user };
}

export async function POST(request) {
  try {
    const allowed = await requirePermission("create");
    if (allowed.error) return allowed.error;

    const body = await request.json();
    const anaquelId = Number(body.anaquelId);
    const codigoNivel = String(body.codigoNivel || "").trim();
    const ordenNivel = Number(body.ordenNivel);
    const activo = body.activo === false ? 0 : 1;

    if (!anaquelId || !codigoNivel || !Number.isFinite(ordenNivel)) {
      return NextResponse.json({ message: "Anaquel, codigo y orden son obligatorios." }, { status: 400 });
    }
    if (!(await userCanAccessShelf(allowed.user.id, anaquelId))) {
      return NextResponse.json({ message: "No tienes asignado el almacen o mostrador de ese anaquel." }, { status: 403 });
    }

    const [result] = await pool.query(
      `INSERT INTO almacen_anaquel_niveles (anaquel_id, codigo_nivel, orden_nivel, activo)
       VALUES (?, ?, ?, ?)`,
      [anaquelId, codigoNivel, ordenNivel, activo]
    );
    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating shelf level:", error);
    return NextResponse.json({ message: error?.code === "ER_DUP_ENTRY" ? "Ya existe ese codigo u orden para el anaquel." : "No se pudo crear el nivel." }, { status: error?.code === "ER_DUP_ENTRY" ? 409 : 500 });
  }
}
