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

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const payload = normalizePayload(body);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Link invalido." }, { status: 400 });
    }
    if (!payload.link) {
      return NextResponse.json({ message: "El link es obligatorio." }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        `UPDATE configuracion_links
         SET link = ?, is_for_desktop = ?, is_for_mobile = ?
         WHERE id = ?`,
        [payload.link, payload.isForDesktop, payload.isForMobile, id]
      );

      if (!result.affectedRows) {
        await connection.rollback();
        return NextResponse.json({ message: "Link no encontrado." }, { status: 404 });
      }

      await connection.query(`DELETE FROM configuracion_roles_links WHERE link_id = ?`, [id]);
      if (payload.roleIds.length) {
        await connection.query(
          `INSERT INTO configuracion_roles_links (role_id, link_id) VALUES ?`,
          [payload.roleIds.map((roleId) => [roleId, id])]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const [rows] = await pool.query(
      `SELECT l.id, l.link, l.is_for_desktop, l.is_for_mobile,
              COALESCE(JSON_ARRAYAGG(CASE WHEN r.id IS NULL THEN NULL ELSE JSON_OBJECT('id', r.id, 'name', r.name) END), JSON_ARRAY()) AS roles
       FROM configuracion_links l
       LEFT JOIN configuracion_roles_links rl ON rl.link_id = l.id
       LEFT JOIN configuracion_roles r ON r.id = rl.role_id
       WHERE l.id = ?
       GROUP BY l.id, l.link, l.is_for_desktop, l.is_for_mobile
       LIMIT 1`,
      [id]
    );
    const link = mapLink(rows[0]);
    return NextResponse.json({ link: { ...link, roles: link.roles.filter(Boolean) } });
  } catch (error) {
    console.error("Error updating configuration link:", error);
    return NextResponse.json({ message: "No se pudo actualizar el link." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Link invalido." }, { status: 400 });
    }

    const [result] = await pool.query(`DELETE FROM configuracion_links WHERE id = ?`, [id]);
    if (!result.affectedRows) {
      return NextResponse.json({ message: "Link no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting configuration link:", error);
    return NextResponse.json({ message: "No se pudo eliminar el link." }, { status: 500 });
  }
}
