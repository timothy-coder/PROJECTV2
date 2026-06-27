import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function limitParam(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 10;
  return Math.min(parsed, 100);
}

function pageParam(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 1;
  return parsed;
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = limitParam(url.searchParams.get("limit"));
    const page = pageParam(url.searchParams.get("page"));
    const withOptions = url.searchParams.get("options") === "1";
    const offset = (page - 1) * limit;
    const roleId = user.role?.id || 0;
    const [[stats]] = await pool.query(
      `SELECT
          COUNT(DISTINCT n.id) AS total,
          COUNT(DISTINCT CASE WHEN COALESCE(nu.leida, n.leida, 0) = 0 THEN n.id END) AS unread
       FROM notificaciones n
       LEFT JOIN notificacion_usuarios nu
         ON nu.notificacion_id = n.id
        AND nu.usuario_id = ?
       LEFT JOIN notificacion_roles nr
         ON nr.notificacion_id = n.id
        AND nr.role_id = ?
       WHERE (nu.usuario_id IS NOT NULL OR nr.role_id IS NOT NULL)
         AND n.created_at <= NOW()`,
      [user.id, roleId]
    );
    const [rows] = await pool.query(
      `SELECT
          n.id,
          n.titulo,
          n.mensaje,
          n.tipo,
          n.icono,
          n.url,
          n.created_at,
          n.updated_at,
          COALESCE(MAX(nu.leida), n.leida, 0) AS leida,
          MAX(nu.leida_at) AS leida_at
       FROM notificaciones n
       LEFT JOIN notificacion_usuarios nu
         ON nu.notificacion_id = n.id
        AND nu.usuario_id = ?
       LEFT JOIN notificacion_roles nr
         ON nr.notificacion_id = n.id
        AND nr.role_id = ?
       WHERE (nu.usuario_id IS NOT NULL OR nr.role_id IS NOT NULL)
         AND n.created_at <= NOW()
       GROUP BY n.id
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ? OFFSET ?`,
      [user.id, roleId, limit, offset]
    );

    const notifications = rows.map((row) => ({
      id: row.id,
      title: row.titulo,
      message: row.mensaje,
      type: row.tipo || "info",
      icon: row.icono || "",
      url: row.url || "",
      read: Boolean(row.leida),
      readAt: row.leida_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const response = {
      unread: Number(stats?.unread || 0),
      notifications,
      meta: {
        total: Number(stats?.total || 0),
        page,
        limit,
        pages: Math.max(1, Math.ceil(Number(stats?.total || 0) / limit)),
      },
    };

    if (withOptions && hasPerm(user.permissions || {}, ["notificaciones", "send"])) {
      const [roles] = await pool.query(`SELECT id, name FROM configuracion_roles ORDER BY name ASC`);
      const [users] = await pool.query(
        `SELECT u.id, u.fullname, u.username, u.role_id, r.name AS role_name
         FROM administracion_usuarios u
         LEFT JOIN configuracion_roles r ON r.id = u.role_id
         WHERE u.is_active = 1
         ORDER BY u.fullname ASC, u.username ASC`
      );
      response.options = {
        canSend: true,
        roles: roles.map((role) => ({ id: Number(role.id), name: role.name })),
        users: users.map((item) => ({
          id: Number(item.id),
          name: item.fullname || item.username,
          username: item.username || "",
          roleId: item.role_id ? Number(item.role_id) : null,
          roleName: item.role_name || "",
        })),
      };
    } else {
      response.options = { canSend: false, roles: [], users: [] };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error loading notifications:", error);
    return NextResponse.json({ message: "No se pudieron cargar las notificaciones." }, { status: 500 });
  }
}

function normalizeNotificationPayload(body) {
  const roleIds = Array.isArray(body?.roleIds) ? body.roleIds.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
  const userIds = Array.isArray(body?.userIds) ? body.userIds.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
  const allowedTypes = new Set(["info", "success", "warning", "error"]);

  return {
    title: String(body?.title || "").trim(),
    message: String(body?.message || "").trim(),
    type: allowedTypes.has(body?.type) ? body.type : "info",
    icon: String(body?.icon || "").trim() || null,
    url: String(body?.url || "").trim() || null,
    roleIds: [...new Set(roleIds)],
    userIds: [...new Set(userIds)],
  };
}

export async function POST(request) {
  const connection = await pool.getConnection();

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    }
    if (!hasPerm(user.permissions || {}, ["notificaciones", "send"])) {
      return NextResponse.json({ message: "No tienes permiso para enviar notificaciones." }, { status: 403 });
    }

    const payload = normalizeNotificationPayload(await request.json());
    if (!payload.title || !payload.message) {
      return NextResponse.json({ message: "Titulo y mensaje son obligatorios." }, { status: 400 });
    }
    if (!payload.roleIds.length && !payload.userIds.length) {
      return NextResponse.json({ message: "Selecciona al menos un rol o usuario." }, { status: 400 });
    }

    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO notificaciones (titulo, mensaje, tipo, icono, url)
       VALUES (?, ?, ?, ?, ?)`,
      [payload.title, payload.message, payload.type, payload.icon, payload.url]
    );

    if (payload.roleIds.length) {
      await connection.query(
        `INSERT IGNORE INTO notificacion_roles (notificacion_id, role_id) VALUES ?`,
        [payload.roleIds.map((roleId) => [result.insertId, roleId])]
      );
    }
    if (payload.userIds.length) {
      await connection.query(
        `INSERT IGNORE INTO notificacion_usuarios (notificacion_id, usuario_id) VALUES ?`,
        [payload.userIds.map((userId) => [result.insertId, userId])]
      );
    }

    await connection.commit();
    return NextResponse.json({ ok: true, id: Number(result.insertId) }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating notification:", error);
    return NextResponse.json({ message: "No se pudo enviar la notificacion." }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function PATCH(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const markAll = body?.all === true;
    const notificationId = Number(body?.notificationId || 0);

    if (!markAll && !notificationId) {
      return NextResponse.json({ message: "Notificacion invalida." }, { status: 400 });
    }

    if (markAll) {
      const roleId = user.role?.id || 0;
      const [rows] = await pool.query(
        `SELECT DISTINCT n.id
         FROM notificaciones n
         LEFT JOIN notificacion_usuarios nu
           ON nu.notificacion_id = n.id
          AND nu.usuario_id = ?
         LEFT JOIN notificacion_roles nr
           ON nr.notificacion_id = n.id
          AND nr.role_id = ?
         WHERE (nu.usuario_id IS NOT NULL OR nr.role_id IS NOT NULL)
           AND n.created_at <= NOW()`,
        [user.id, roleId]
      );

      if (rows.length) {
        await pool.query(
          `INSERT INTO notificacion_usuarios (notificacion_id, usuario_id, leida, leida_at)
           VALUES ?
           ON DUPLICATE KEY UPDATE leida = 1, leida_at = NOW()`,
          [rows.map((row) => [row.id, user.id, 1, new Date()])]
        );
      }

      return NextResponse.json({ ok: true });
    }

    const [[allowed]] = await pool.query(
      `SELECT n.id
       FROM notificaciones n
       LEFT JOIN notificacion_usuarios nu
         ON nu.notificacion_id = n.id
        AND nu.usuario_id = ?
       LEFT JOIN notificacion_roles nr
         ON nr.notificacion_id = n.id
        AND nr.role_id = ?
       WHERE n.id = ?
         AND (nu.usuario_id IS NOT NULL OR nr.role_id IS NOT NULL)
         AND n.created_at <= NOW()
       LIMIT 1`,
      [user.id, user.role?.id || 0, notificationId]
    );

    if (!allowed?.id) {
      return NextResponse.json({ message: "No tienes acceso a esta notificacion." }, { status: 403 });
    }

    await pool.query(
      `INSERT INTO notificacion_usuarios (notificacion_id, usuario_id, leida, leida_at)
       VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE leida = 1, leida_at = NOW()`,
      [notificationId, user.id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return NextResponse.json({ message: "No se pudo marcar la notificacion como leida." }, { status: 500 });
  }
}
