import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

async function requirePermission(action) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["config_anaqueles", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para configurar posiciones." }, { status: 403 }) };
  }
  return { user };
}

export async function POST(request) {
  try {
    const allowed = await requirePermission("create");
    if (allowed.error) return allowed.error;

    const body = await request.json();
    const nivelId = Number(body.nivelId);
    const posicion = Number(body.posicion);
    const activo = body.activo === false ? 0 : 1;

    if (!nivelId || !Number.isFinite(posicion)) {
      return NextResponse.json({ message: "Nivel y posicion son obligatorios." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO almacen_nivel_posiciones (nivel_id, posicion, activo)
       VALUES (?, ?, ?)`,
      [nivelId, posicion, activo]
    );
    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating shelf position:", error);
    return NextResponse.json({ message: error?.code === "ER_DUP_ENTRY" ? "Ya existe esa posicion en el nivel." : "No se pudo crear la posicion." }, { status: error?.code === "ER_DUP_ENTRY" ? 409 : 500 });
  }
}
