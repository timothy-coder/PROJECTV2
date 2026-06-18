import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function parseRoles(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    return JSON.parse(value).filter(Boolean);
  } catch {
    return [];
  }
}

function mapLink(row) {
  return {
    id: Number(row.id),
    link: row.link,
    isForDesktop: Boolean(row.is_for_desktop),
    isForMobile: Boolean(row.is_for_mobile),
    roles: parseRoles(row.roles),
  };
}

function normalizePayload(body) {
  const link = String(body?.link || "").trim();
  const roleIds = Array.isArray(body?.roleIds) ? body.roleIds.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
  return {
    link,
    isForDesktop: body?.isForDesktop ? 1 : 0,
    isForMobile: body?.isForMobile ? 1 : 0,
    roleIds: [...new Set(roleIds)],
  };
}

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT l.id, l.link, l.is_for_desktop, l.is_for_mobile,
              COALESCE(
                JSON_ARRAYAGG(
                  CASE WHEN r.id IS NULL THEN NULL ELSE JSON_OBJECT('id', r.id, 'name', r.name) END
                ),
                JSON_ARRAY()
              ) AS roles
       FROM configuracion_links l
       LEFT JOIN configuracion_roles_links rl ON rl.link_id = l.id
       LEFT JOIN configuracion_roles r ON r.id = rl.role_id
       GROUP BY l.id, l.link, l.is_for_desktop, l.is_for_mobile
       ORDER BY l.id DESC`
    );
    const [roles] = await pool.query(`SELECT id, name FROM configuracion_roles ORDER BY name ASC`);

    return NextResponse.json({
      links: rows.map(mapLink).map((link) => ({ ...link, roles: link.roles.filter(Boolean) })),
      roles: roles.map((role) => ({ id: Number(role.id), name: role.name })),
    });
  } catch (error) {
    console.error("Error loading configuration links:", error);
    return NextResponse.json({ message: "No se pudieron cargar los links." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = normalizePayload(body);

    if (!payload.link) {
      return NextResponse.json({ message: "El link es obligatorio." }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        `INSERT INTO configuracion_links (link, is_for_desktop, is_for_mobile)
         VALUES (?, ?, ?)`,
        [payload.link, payload.isForDesktop, payload.isForMobile]
      );
      if (payload.roleIds.length) {
        await connection.query(
          `INSERT INTO configuracion_roles_links (role_id, link_id) VALUES ?`,
          [payload.roleIds.map((roleId) => [roleId, result.insertId])]
        );
      }
      await connection.commit();
      const [rows] = await pool.query(
        `SELECT l.id, l.link, l.is_for_desktop, l.is_for_mobile,
                COALESCE(JSON_ARRAYAGG(CASE WHEN r.id IS NULL THEN NULL ELSE JSON_OBJECT('id', r.id, 'name', r.name) END), JSON_ARRAY()) AS roles
         FROM configuracion_links l
         LEFT JOIN configuracion_roles_links rl ON rl.link_id = l.id
         LEFT JOIN configuracion_roles r ON r.id = rl.role_id
         WHERE l.id = ?
         GROUP BY l.id, l.link, l.is_for_desktop, l.is_for_mobile
         LIMIT 1`,
        [result.insertId]
      );

      const link = mapLink(rows[0]);
      return NextResponse.json({ link: { ...link, roles: link.roles.filter(Boolean) } }, { status: 201 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error creating configuration link:", error);
    return NextResponse.json({ message: "No se pudo crear el link." }, { status: 500 });
  }
}
