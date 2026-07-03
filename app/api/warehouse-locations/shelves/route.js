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

export async function POST(request) {
  try {
    const allowed = await requirePermission("create");
    if (allowed.error) return allowed.error;

    const body = await request.json();
    const codigo = String(body.codigo || "").trim();
    const descripcion = String(body.descripcion || "").trim() || null;
    const tallerId = body.tallerId ? Number(body.tallerId) : null;
    const mostradorId = body.mostradorId ? Number(body.mostradorId) : null;
    const activo = body.activo === false ? 0 : 1;

    if (!codigo || (tallerId && mostradorId)) {
      return NextResponse.json({ message: "Codigo obligatorio; selecciona solo taller o mostrador." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO almacen_anaqueles (codigo, descripcion, taller_id, mostrador_id, activo)
       VALUES (?, ?, ?, ?, ?)`,
      [codigo, descripcion, tallerId, mostradorId, activo]
    );
    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating shelf:", error);
    return NextResponse.json({ message: error?.code === "ER_DUP_ENTRY" ? "Ya existe un anaquel con ese codigo." : "No se pudo crear el anaquel." }, { status: error?.code === "ER_DUP_ENTRY" ? 409 : 500 });
  }
}
