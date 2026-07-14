import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function parsePermissions(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function mapProfile(row) {
  return {
    id: Number(row.id),
    nombre: row.nombre || "",
    permissions: parsePermissions(row.permissions),
    createdAt: row.created_at || null,
  };
}

async function requirePermission(action) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autenticado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["configuracion_perfiles_permisos", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para gestionar perfiles de permisos." }, { status: 403 }) };
  }
  return { user };
}

export async function PUT(request, context) {
  const auth = await requirePermission("edit");
  if (auth.error) return auth.error;

  try {
    const routeParams = await context.params;
    const id = Number(routeParams.id);
    const body = await request.json();
    const nombre = String(body?.nombre || "").trim();
    const permissions = body?.permissions && typeof body.permissions === "object" ? body.permissions : {};

    if (!id) return NextResponse.json({ message: "Perfil invalido." }, { status: 400 });
    if (!nombre) return NextResponse.json({ message: "El nombre del perfil es obligatorio." }, { status: 400 });

    const [existing] = await pool.query(
      `SELECT id FROM administracion_perfiles_permisos WHERE LOWER(nombre) = LOWER(?) AND id <> ? LIMIT 1`,
      [nombre, id]
    );
    if (existing.length) {
      return NextResponse.json({ message: "Ya existe un perfil con ese nombre." }, { status: 409 });
    }

    await pool.query(
      `UPDATE administracion_perfiles_permisos
       SET nombre = ?, permissions = ?
       WHERE id = ?`,
      [nombre, JSON.stringify(permissions), id]
    );

    const [rows] = await pool.query(
      `SELECT id, nombre, permissions, created_at
       FROM administracion_perfiles_permisos
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) return NextResponse.json({ message: "Perfil no encontrado." }, { status: 404 });
    return NextResponse.json({ profile: mapProfile(rows[0]) });
  } catch (error) {
    console.error("Error updating permission profile:", error);
    return NextResponse.json({ message: "No se pudo actualizar el perfil de permisos." }, { status: 500 });
  }
}

export async function DELETE(_request, context) {
  const auth = await requirePermission("delete");
  if (auth.error) return auth.error;

  try {
    const routeParams = await context.params;
    const id = Number(routeParams.id);
    if (!id) return NextResponse.json({ message: "Perfil invalido." }, { status: 400 });

    await pool.query(`DELETE FROM administracion_perfiles_permisos WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting permission profile:", error);
    return NextResponse.json({ message: "No se pudo eliminar el perfil de permisos." }, { status: 500 });
  }
}
