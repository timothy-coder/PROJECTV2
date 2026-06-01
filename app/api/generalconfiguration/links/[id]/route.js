import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapLink(row) {
  return {
    id: Number(row.id),
    link: row.link,
    isForDesktop: Boolean(row.is_for_desktop),
    isForMobile: Boolean(row.is_for_mobile),
  };
}

function normalizePayload(body) {
  const link = String(body?.link || "").trim();
  return {
    link,
    isForDesktop: body?.isForDesktop ? 1 : 0,
    isForMobile: body?.isForMobile ? 1 : 0,
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

    const [result] = await pool.query(
      `UPDATE configuracion_links
       SET link = ?, is_for_desktop = ?, is_for_mobile = ?
       WHERE id = ?`,
      [payload.link, payload.isForDesktop, payload.isForMobile, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Link no encontrado." }, { status: 404 });
    }

    const [rows] = await pool.query(
      `SELECT id, link, is_for_desktop, is_for_mobile
       FROM configuracion_links
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return NextResponse.json({ link: mapLink(rows[0]) });
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
