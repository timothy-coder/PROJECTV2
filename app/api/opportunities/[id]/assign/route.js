import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";

async function isAdvisorUser(userId) {
  if (!userId) return true;
  const [rows] = await pool.query(
    `SELECT u.id
     FROM administracion_usuarios u
     INNER JOIN configuracion_roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.is_active = 1 AND LOWER(TRIM(r.name)) = 'asesor'
     LIMIT 1`,
    [Number(userId)]
  );
  return rows.length > 0;
}

function permissionFromCode(code) {
  return String(code || "").startsWith("LD-") ? "leads" : "oportunidades";
}

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const [[opportunity]] = await pool.query(`SELECT oportunidad_id FROM ventas_oportunidades WHERE id=? LIMIT 1`, [id]);
    if (!opportunity) return NextResponse.json({ message: "No se encontró la oportunidad." }, { status: 404 });
    const permission = permissionFromCode(opportunity.oportunidad_id);
    const canAssign = Boolean(
      hasPerm(user.permissions, [permission, "viewall"]) ||
      hasPerm(user.permissions, [permission, "asignar"]) ||
      hasPerm(user.permissions, ["oportunidades", "viewall"]) ||
      hasPerm(user.permissions, ["agenda", "viewall"])
    );
    if (!canAssign) return NextResponse.json({ message: "No tienes permiso para asignar." }, { status: 403 });
    if (body.asignadoA && !(await isAdvisorUser(body.asignadoA))) {
      return NextResponse.json({ message: "Solo se puede asignar a usuarios con rol Asesor." }, { status: 400 });
    }
    await pool.query(`UPDATE ventas_oportunidades SET asignado_a=? WHERE id=?`, [body.asignadoA ? Number(body.asignadoA) : null, id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error assigning opportunity:", error);
    return NextResponse.json({ message: "No se pudo asignar la oportunidad." }, { status: 500 });
  }
}
