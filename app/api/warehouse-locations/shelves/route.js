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

async function getWarehouseSettings() {
  const [[settings]] = await pool.query(
    `SELECT habilitar_taller, habilitar_mostrador
     FROM configuracion_posventa_inventario
     ORDER BY id ASC
     LIMIT 1`
  );
  return {
    habilitarTaller: settings ? Boolean(settings.habilitar_taller) : true,
    habilitarMostrador: settings ? Boolean(settings.habilitar_mostrador) : true,
  };
}

async function userHasAssignedLocation(userId, { tallerId, mostradorId }) {
  if (tallerId) {
    const [[row]] = await pool.query(
      `SELECT 1 AS ok
       FROM administracion_usuario_talleres
       WHERE usuario_id = ? AND taller_id = ?
       LIMIT 1`,
      [userId, tallerId]
    );
    return Boolean(row?.ok);
  }
  if (mostradorId) {
    const [[row]] = await pool.query(
      `SELECT 1 AS ok
       FROM administracion_usuario_mostradores
       WHERE usuario_id = ? AND mostrador_id = ?
       LIMIT 1`,
      [userId, mostradorId]
    );
    return Boolean(row?.ok);
  }
  return false;
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
    const settings = await getWarehouseSettings();

    if (!codigo || (tallerId && mostradorId)) {
      return NextResponse.json({ message: "Codigo obligatorio; selecciona solo almacen o mostrador." }, { status: 400 });
    }
    if ((settings.habilitarTaller || settings.habilitarMostrador) && !tallerId && !mostradorId) {
      return NextResponse.json({ message: "Selecciona un almacen o mostrador asignado." }, { status: 400 });
    }
    if (tallerId && !settings.habilitarTaller) {
      return NextResponse.json({ message: "El uso de almacenes no esta habilitado." }, { status: 400 });
    }
    if (mostradorId && !settings.habilitarMostrador) {
      return NextResponse.json({ message: "El uso de mostradores no esta habilitado." }, { status: 400 });
    }
    if ((tallerId || mostradorId) && !(await userHasAssignedLocation(allowed.user.id, { tallerId, mostradorId }))) {
      return NextResponse.json({ message: "No tienes asignado ese almacen o mostrador." }, { status: 403 });
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
