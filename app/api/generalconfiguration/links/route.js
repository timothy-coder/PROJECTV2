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

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT id, link, is_for_desktop, is_for_mobile
       FROM configuracion_links
       ORDER BY id DESC`
    );

    return NextResponse.json({ links: rows.map(mapLink) });
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

    const [result] = await pool.query(
      `INSERT INTO configuracion_links (link, is_for_desktop, is_for_mobile)
       VALUES (?, ?, ?)`,
      [payload.link, payload.isForDesktop, payload.isForMobile]
    );
    const [rows] = await pool.query(
      `SELECT id, link, is_for_desktop, is_for_mobile
       FROM configuracion_links
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ link: mapLink(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error creating configuration link:", error);
    return NextResponse.json({ message: "No se pudo crear el link." }, { status: 500 });
  }
}
