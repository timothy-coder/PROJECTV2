import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { pool } from "@/lib/db";

function safeJson(value, fallback) {
  if (!value) return fallback;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

function mapUser(row) {
  return {
    id: Number(row.id),
    roleId: row.role_id ? Number(row.role_id) : null,
    roleName: row.role_name || "",
    fullname: row.fullname,
    username: row.username,
    email: row.email || "",
    phone: row.phone || "",
    isActive: Boolean(row.is_active),
    permissions: safeJson(row.permissions, {}),
    workSchedule: safeJson(row.work_schedule, {}),
    color: row.color || "#5e17eb",
    chatwootAgentId: row.chatwoot_agent_id ?? null,
    createdAt: row.created_at,
    centroIds: [],
    tallerIds: [],
    mostradorIds: [],
  };
}

async function loadRoles() {
  try {
    const [rows] = await pool.query(
      `SELECT id, name FROM configuracion_roles ORDER BY name ASC`
    );
    return rows.map((row) => ({ id: Number(row.id), name: row.name }));
  } catch {
    const [rows] = await pool.query(`SELECT id, name FROM roles ORDER BY name ASC`);
    return rows.map((row) => ({ id: Number(row.id), name: row.name }));
  }
}

async function loadOptions() {
  const [roles, centrosRows, talleresRows, mostradoresRows] = await Promise.all([
    loadRoles(),
    pool.query(`SELECT id, nombre FROM configuracion_centros ORDER BY nombre ASC`),
    pool.query(
      `SELECT t.id, t.centro_id, t.nombre, c.nombre AS centro_nombre
       FROM configuracion_talleres t
       LEFT JOIN configuracion_centros c ON c.id = t.centro_id
       ORDER BY t.nombre ASC`
    ),
    pool.query(
      `SELECT m.id, m.centro_id, m.nombre, c.nombre AS centro_nombre
       FROM configuracion_mostradores m
       LEFT JOIN configuracion_centros c ON c.id = m.centro_id
       ORDER BY m.nombre ASC`
    ),
  ]);

  return {
    roles,
    centros: centrosRows[0].map((row) => ({ id: row.id, nombre: row.nombre })),
    talleres: talleresRows[0].map((row) => ({
      id: row.id,
      centroId: row.centro_id,
      nombre: row.nombre,
      centroNombre: row.centro_nombre || "",
    })),
    mostradores: mostradoresRows[0].map((row) => ({
      id: row.id,
      centroId: row.centro_id,
      nombre: row.nombre,
      centroNombre: row.centro_nombre || "",
    })),
  };
}

async function loadUserRows() {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.role_id, u.fullname, u.username, u.email, u.phone,
              u.is_active, u.permissions, u.work_schedule, u.created_at,
              u.color, u.chatwoot_agent_id, r.name AS role_name
       FROM administracion_usuarios u
       LEFT JOIN configuracion_roles r ON r.id = u.role_id
       ORDER BY u.created_at DESC`
    );

    return rows;
  } catch {
    const [rows] = await pool.query(
      `SELECT u.id, u.role_id, u.fullname, u.username, u.email, u.phone,
              u.is_active, u.permissions, u.work_schedule, u.created_at,
              u.color, u.chatwoot_agent_id, r.name AS role_name
       FROM administracion_usuarios u
       LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.created_at DESC`
    );

    return rows;
  }
}

async function attachAssignments(users) {
  if (!users.length) return users;
  const ids = users.map((user) => user.id);
  const placeholders = ids.map(() => "?").join(",");
  const [centrosRows] = await pool.query(
    `SELECT usuario_id, centro_id FROM administracion_usuario_centros WHERE usuario_id IN (${placeholders})`,
    ids
  );
  const [talleresRows] = await pool.query(
    `SELECT usuario_id, taller_id FROM administracion_usuario_talleres WHERE usuario_id IN (${placeholders})`,
    ids
  );
  const [mostradoresRows] = await pool.query(
    `SELECT usuario_id, mostrador_id FROM administracion_usuario_mostradores WHERE usuario_id IN (${placeholders})`,
    ids
  );
  const byId = new Map(users.map((user) => [user.id, user]));

  centrosRows.forEach((row) => byId.get(Number(row.usuario_id))?.centroIds.push(row.centro_id));
  talleresRows.forEach((row) => byId.get(Number(row.usuario_id))?.tallerIds.push(row.taller_id));
  mostradoresRows.forEach((row) => byId.get(Number(row.usuario_id))?.mostradorIds.push(row.mostrador_id));

  return users;
}

async function syncAssignments(connection, userId, payload) {
  const centroIds = payload.centroIds || [];
  const tallerIds = payload.tallerIds || [];
  const mostradorIds = payload.mostradorIds || [];

  await connection.query(`DELETE FROM administracion_usuario_centros WHERE usuario_id = ?`, [userId]);
  await connection.query(`DELETE FROM administracion_usuario_talleres WHERE usuario_id = ?`, [userId]);
  await connection.query(`DELETE FROM administracion_usuario_mostradores WHERE usuario_id = ?`, [userId]);

  for (const centroId of centroIds) {
    await connection.query(
      `INSERT INTO administracion_usuario_centros (usuario_id, centro_id) VALUES (?, ?)`,
      [userId, centroId]
    );
  }
  for (const tallerId of tallerIds) {
    await connection.query(
      `INSERT INTO administracion_usuario_talleres (usuario_id, taller_id) VALUES (?, ?)`,
      [userId, tallerId]
    );
  }
  for (const mostradorId of mostradorIds) {
    await connection.query(
      `INSERT INTO administracion_usuario_mostradores (usuario_id, mostrador_id) VALUES (?, ?)`,
      [userId, mostradorId]
    );
  }
}

function normalizeUserPayload(body) {
  return {
    roleId: body.roleId ? Number(body.roleId) : null,
    fullname: String(body.fullname || "").trim(),
    username: String(body.username || "").trim(),
    email: String(body.email || "").trim() || null,
    phone: String(body.phone || "").trim() || null,
    password: String(body.password || ""),
    isActive: body.isActive !== false,
    permissions: body.permissions || {},
    workSchedule: body.workSchedule || {},
    color: String(body.color || "#5e17eb").trim(),
    chatwootAgentId: body.chatwootAgentId ? Number(body.chatwootAgentId) : null,
    centroIds: (body.centroIds || []).map(Number).filter(Boolean),
    tallerIds: (body.tallerIds || []).map(Number).filter(Boolean),
    mostradorIds: (body.mostradorIds || []).map(Number).filter(Boolean),
  };
}

export async function GET() {
  try {
    const rows = await loadUserRows();
    const users = await attachAssignments(rows.map(mapUser));
    const options = await loadOptions();

    return NextResponse.json({ users, options });
  } catch (error) {
    console.error("Error loading users:", error);

    return NextResponse.json(
      { message: "No se pudieron cargar los usuarios." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const connection = await pool.getConnection();

  try {
    const payload = normalizeUserPayload(await request.json());

    if (!payload.fullname || !payload.username || !payload.password) {
      return NextResponse.json(
        { message: "Nombre, usuario y contrasena son obligatorios." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO administracion_usuarios
       (role_id, fullname, username, email, phone, password_hash, is_active,
        permissions, work_schedule, color, chatwoot_agent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.roleId,
        payload.fullname,
        payload.username,
        payload.email,
        payload.phone,
        passwordHash,
        payload.isActive ? 1 : 0,
        JSON.stringify(payload.permissions),
        JSON.stringify(payload.workSchedule),
        payload.color,
        payload.chatwootAgentId,
      ]
    );
    await syncAssignments(connection, result.insertId, payload);
    await connection.commit();

    return NextResponse.json({ ok: true, id: Number(result.insertId) }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating user:", error);

    return NextResponse.json(
      { message: "No se pudo crear el usuario." },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
