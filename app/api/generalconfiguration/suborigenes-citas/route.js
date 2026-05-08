import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapSuborigen(row) {
  return {
    id: row.id,
    origenId: row.origen_id,
    origenName: row.origen_name || "",
    name: row.name,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const origenId = Number(searchParams.get("origenId"));
    const filterByOrigin = Number.isInteger(origenId) && origenId > 0;
    const params = [];

    let query = `
      SELECT s.id, s.origen_id, s.name, s.is_active, s.created_at, o.name AS origen_name
      FROM configuracion_suborigenes_citas s
      LEFT JOIN configuracion_origenes_citas o ON o.id = s.origen_id
    `;

    if (filterByOrigin) {
      query += ` WHERE s.origen_id = ?`;
      params.push(origenId);
    }

    query += ` ORDER BY s.name ASC`;

    const [rows] = await pool.query(query, params);

    return NextResponse.json({ suborigenes: rows.map(mapSuborigen) });
  } catch (error) {
    console.error("Error loading appointment suborigins:", error);

    return NextResponse.json(
      { message: "No se pudieron cargar los suborigenes." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const origenId = Number(body?.origenId);
    const name = String(body?.name || "").trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!Number.isInteger(origenId) || origenId <= 0) {
      return NextResponse.json({ message: "Selecciona un origen valido." }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json(
        { message: "El nombre del suborigen es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_suborigenes_citas (origen_id, name, is_active)
       VALUES (?, ?, ?)`,
      [origenId, name, isActive]
    );

    const [rows] = await pool.query(
      `SELECT s.id, s.origen_id, s.name, s.is_active, s.created_at, o.name AS origen_name
       FROM configuracion_suborigenes_citas s
       LEFT JOIN configuracion_origenes_citas o ON o.id = s.origen_id
       WHERE s.id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ suborigen: mapSuborigen(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error creating appointment suborigin:", error);

    return NextResponse.json(
      { message: "No se pudo crear el suborigen." },
      { status: 500 }
    );
  }
}
