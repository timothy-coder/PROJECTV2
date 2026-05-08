import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

const VALID_TYPES = new Set(["mano_obra", "panos"]);

function mapTarifa(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    monedaId: row.moneda_id,
    monedaCodigo: row.moneda_codigo || "",
    monedaSimbolo: row.moneda_simbolo || "",
    nombre: row.nombre,
    precioHora: Number(row.precio_hora),
    activo: Boolean(row.activo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = String(searchParams.get("tipo") || "");

    if (!VALID_TYPES.has(tipo)) {
      return NextResponse.json({ tarifas: [] });
    }

    const [rows] = await pool.query(
      `SELECT t.id, t.tipo, t.moneda_id, t.nombre, t.precio_hora, t.activo,
              t.created_at, t.updated_at, m.codigo AS moneda_codigo, m.simbolo AS moneda_simbolo
       FROM configuracion_tarifas t
       LEFT JOIN configuracion_monedas m ON m.id = t.moneda_id
       WHERE t.tipo = ?
       ORDER BY t.nombre ASC`,
      [tipo]
    );

    return NextResponse.json({ tarifas: rows.map(mapTarifa) });
  } catch (error) {
    console.error("Error loading rates:", error);

    return NextResponse.json(
      { message: "No se pudieron cargar las tarifas." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const tipo = String(body?.tipo || "");
    const monedaId = body?.monedaId ? Number(body.monedaId) : null;
    const nombre = String(body?.nombre || "").trim();
    const precioHora = Number(body?.precioHora);
    const activo = body?.activo === false ? 0 : 1;

    if (!VALID_TYPES.has(tipo)) {
      return NextResponse.json({ message: "Tipo de tarifa invalido." }, { status: 400 });
    }

    if (!nombre || Number.isNaN(precioHora) || precioHora < 0) {
      return NextResponse.json(
        { message: "Nombre y precio/hora valido son obligatorios." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_tarifas (tipo, moneda_id, nombre, precio_hora, activo)
       VALUES (?, ?, ?, ?, ?)`,
      [tipo, monedaId, nombre, precioHora, activo]
    );

    const [rows] = await pool.query(
      `SELECT t.id, t.tipo, t.moneda_id, t.nombre, t.precio_hora, t.activo,
              t.created_at, t.updated_at, m.codigo AS moneda_codigo, m.simbolo AS moneda_simbolo
       FROM configuracion_tarifas t
       LEFT JOIN configuracion_monedas m ON m.id = t.moneda_id
       WHERE t.id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ tarifa: mapTarifa(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("Error creating rate:", error);

    return NextResponse.json(
      { message: "No se pudo crear la tarifa." },
      { status: 500 }
    );
  }
}
