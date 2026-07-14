import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function requireUser(action) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autenticado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["configuracion_datos_fiscales_punto", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para datos fiscales." }, { status: 403 }) };
  }
  return { user };
}

async function canAccessPoint(userId, tallerId, mostradorId) {
  if (!tallerId && !mostradorId) return true;
  const [[row]] = await pool.query(
    `SELECT
       EXISTS(SELECT 1 FROM administracion_usuario_talleres WHERE usuario_id = ? AND taller_id = ?) AS has_taller,
       EXISTS(SELECT 1 FROM administracion_usuario_mostradores WHERE usuario_id = ? AND mostrador_id = ?) AS has_mostrador`,
    [userId, tallerId || 0, userId, mostradorId || 0]
  );
  return Boolean(row?.has_taller || row?.has_mostrador);
}

export async function PUT(request, { params }) {
  try {
    const auth = await requireUser("edit");
    if (auth.error) return auth.error;
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const razonSocial = clean(body?.razonSocial);
    const ruc = clean(body?.ruc);
    const direccion = clean(body?.direccion);
    const celular = clean(body?.celular);
    const logoPath = clean(body?.logoPath);
    const tallerId = Number(body?.tallerId) || null;
    const mostradorId = Number(body?.mostradorId) || null;

    if (!id) return NextResponse.json({ message: "Registro invalido." }, { status: 400 });
    if (!razonSocial || !ruc) return NextResponse.json({ message: "Razon social y RUC son obligatorios." }, { status: 400 });
    if (Boolean(tallerId) && Boolean(mostradorId)) return NextResponse.json({ message: "Selecciona solo un almacen o un mostrador." }, { status: 400 });
    if (!(await canAccessPoint(auth.user.id, tallerId, mostradorId))) {
      return NextResponse.json({ message: "No tienes asignado ese almacen o mostrador." }, { status: 403 });
    }

    const [result] = await pool.query(
      `UPDATE configuracion_datos_fiscales_punto
       SET razon_social = ?, direccion = ?, ruc = ?, celular = ?, logo_path = ?, taller_id = ?, mostrador_id = ?
       WHERE id = ?`,
      [razonSocial, direccion, ruc, celular, logoPath, tallerId, mostradorId, id]
    );
    if (!result.affectedRows) return NextResponse.json({ message: "Registro no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating fiscal point data:", error);
    return NextResponse.json({ message: "No se pudo actualizar el dato fiscal." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const auth = await requireUser("delete");
    if (auth.error) return auth.error;
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!id) return NextResponse.json({ message: "Registro invalido." }, { status: 400 });

    const [[current]] = await pool.query(`SELECT taller_id, mostrador_id FROM configuracion_datos_fiscales_punto WHERE id = ?`, [id]);
    if (!current) return NextResponse.json({ message: "Registro no encontrado." }, { status: 404 });
    if (!(await canAccessPoint(auth.user.id, current.taller_id, current.mostrador_id))) {
      return NextResponse.json({ message: "No tienes asignado ese almacen o mostrador." }, { status: 403 });
    }

    await pool.query(`DELETE FROM configuracion_datos_fiscales_punto WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting fiscal point data:", error);
    return NextResponse.json({ message: "No se pudo eliminar el dato fiscal." }, { status: 500 });
  }
}
