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

export async function GET() {
  const auth = await requirePermission("view");
  if (auth.error) return auth.error;

  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, permissions, created_at
       FROM administracion_perfiles_permisos
       ORDER BY nombre ASC`
    );
    return NextResponse.json({ profiles: rows.map(mapProfile) });
  } catch (error) {
    console.error("Error loading permission profiles:", error);
    return NextResponse.json({ message: "No se pudieron cargar los perfiles de permisos." }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requirePermission("create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const nombre = String(body?.nombre || "").trim();
    const permissions = body?.permissions && typeof body.permissions === "object" ? body.permissions : {};

    if (!nombre) {
      return NextResponse.json({ message: "El nombre del perfil es obligatorio." }, { status: 400 });
    }

    const [existing] = await pool.query(
      `SELECT id FROM administracion_perfiles_permisos WHERE LOWER(nombre) = LOWER(?) LIMIT 1`,
      [nombre]
    );
    if (existing.length) {
      return NextResponse.json({ message: "Ya existe un perfil con ese nombre." }, { status: 409 });
    }

    const [result] = await pool.query(
      `INSERT INTO administracion_perfiles_permisos (nombre, permissions)
       VALUES (?, ?)`,
      [nombre, JSON.stringify(permissions)]
    );

    const [rows] = await pool.query(
      `SELECT id, nombre, permissions, created_at
       FROM administracion_perfiles_permisos
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ profile: mapProfile(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error creating permission profile:", error);
    return NextResponse.json({ message: "No se pudo crear el perfil de permisos." }, { status: 500 });
  }
}
