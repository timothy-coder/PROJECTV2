import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function mapRole(row) {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description || "",
    createdAt: row.created_at || null,
    usersCount: Number(row.users_count || 0),
  };
}

async function requirePermission(action) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ message: "No autenticado." }, { status: 401 }) };
  }
  if (!hasPerm(user.permissions || {}, ["configuracion_roles", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para gestionar roles." }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const auth = await requirePermission("view");
  if (auth.error) return auth.error;

  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.description, r.created_at, COUNT(u.id) AS users_count
       FROM configuracion_roles r
       LEFT JOIN administracion_usuarios u ON u.role_id = r.id
       GROUP BY r.id, r.name, r.description, r.created_at
       ORDER BY r.name ASC`
    );

    return NextResponse.json({ roles: rows.map(mapRole) });
  } catch (error) {
    console.error("Error loading configuration roles:", error);
    return NextResponse.json({ message: "No se pudieron cargar los roles." }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requirePermission("create");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim() || null;

    if (!name) {
      return NextResponse.json({ message: "El nombre del rol es obligatorio." }, { status: 400 });
    }

    const [existing] = await pool.query(
      `SELECT id FROM configuracion_roles WHERE LOWER(name) = LOWER(?) LIMIT 1`,
      [name]
    );

    if (existing.length) {
      return NextResponse.json({ message: "Ya existe un rol con ese nombre." }, { status: 409 });
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_roles (name, description)
       VALUES (?, ?)`,
      [name, description]
    );

    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.description, r.created_at, COUNT(u.id) AS users_count
       FROM configuracion_roles r
       LEFT JOIN administracion_usuarios u ON u.role_id = r.id
       WHERE r.id = ?
       GROUP BY r.id, r.name, r.description, r.created_at
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ role: mapRole(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error creating configuration role:", error);
    return NextResponse.json({ message: "No se pudo crear el rol." }, { status: 500 });
  }
}
