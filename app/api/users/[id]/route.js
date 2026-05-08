import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { pool } from "@/lib/db";

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

async function syncAssignments(connection, userId, payload) {
  await connection.query(`DELETE FROM administracion_usuario_centros WHERE usuario_id = ?`, [userId]);
  await connection.query(`DELETE FROM administracion_usuario_talleres WHERE usuario_id = ?`, [userId]);
  await connection.query(`DELETE FROM administracion_usuario_mostradores WHERE usuario_id = ?`, [userId]);

  for (const centroId of payload.centroIds) {
    await connection.query(
      `INSERT INTO administracion_usuario_centros (usuario_id, centro_id) VALUES (?, ?)`,
      [userId, centroId]
    );
  }
  for (const tallerId of payload.tallerIds) {
    await connection.query(
      `INSERT INTO administracion_usuario_talleres (usuario_id, taller_id) VALUES (?, ?)`,
      [userId, tallerId]
    );
  }
  for (const mostradorId of payload.mostradorIds) {
    await connection.query(
      `INSERT INTO administracion_usuario_mostradores (usuario_id, mostrador_id) VALUES (?, ?)`,
      [userId, mostradorId]
    );
  }
}

export async function PUT(request, { params }) {
  const connection = await pool.getConnection();

  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const payload = normalizeUserPayload(await request.json());

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Usuario invalido." }, { status: 400 });
    }

    if (!payload.fullname || !payload.username) {
      return NextResponse.json(
        { message: "Nombre y usuario son obligatorios." },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    if (payload.password) {
      const passwordHash = await bcrypt.hash(payload.password, 10);
      await connection.query(
        `UPDATE administracion_usuarios
         SET role_id = ?, fullname = ?, username = ?, email = ?, phone = ?,
             password_hash = ?, is_active = ?, permissions = ?, work_schedule = ?,
             color = ?, chatwoot_agent_id = ?
         WHERE id = ?`,
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
          id,
        ]
      );
    } else {
      await connection.query(
        `UPDATE administracion_usuarios
         SET role_id = ?, fullname = ?, username = ?, email = ?, phone = ?,
             is_active = ?, permissions = ?, work_schedule = ?,
             color = ?, chatwoot_agent_id = ?
         WHERE id = ?`,
        [
          payload.roleId,
          payload.fullname,
          payload.username,
          payload.email,
          payload.phone,
          payload.isActive ? 1 : 0,
          JSON.stringify(payload.permissions),
          JSON.stringify(payload.workSchedule),
          payload.color,
          payload.chatwootAgentId,
          id,
        ]
      );
    }

    await syncAssignments(connection, id, payload);
    await connection.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating user:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar el usuario." },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Usuario invalido." }, { status: 400 });
    }

    const [result] = await pool.query(`DELETE FROM administracion_usuarios WHERE id = ?`, [id]);

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting user:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar el usuario." },
      { status: 500 }
    );
  }
}
