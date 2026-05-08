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

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const tipo = String(body?.tipo || "");
    const monedaId = body?.monedaId ? Number(body.monedaId) : null;
    const nombre = String(body?.nombre || "").trim();
    const precioHora = Number(body?.precioHora);
    const activo = body?.activo === false ? 0 : 1;

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Tarifa invalida." }, { status: 400 });
    }

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
      `UPDATE configuracion_tarifas
       SET tipo = ?, moneda_id = ?, nombre = ?, precio_hora = ?, activo = ?
       WHERE id = ?`,
      [tipo, monedaId, nombre, precioHora, activo, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Tarifa no encontrada." }, { status: 404 });
    }

    const [rows] = await pool.query(
      `SELECT t.id, t.tipo, t.moneda_id, t.nombre, t.precio_hora, t.activo,
              t.created_at, t.updated_at, m.codigo AS moneda_codigo, m.simbolo AS moneda_simbolo
       FROM configuracion_tarifas t
       LEFT JOIN configuracion_monedas m ON m.id = t.moneda_id
       WHERE t.id = ?
       LIMIT 1`,
      [id]
    );

    return NextResponse.json({ tarifa: mapTarifa(rows[0]) });
  } catch (error) {
    console.error("Error updating rate:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar la tarifa." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Tarifa invalida." }, { status: 400 });
    }

    const [result] = await pool.query(
      `DELETE FROM configuracion_tarifas
       WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Tarifa no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting rate:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar la tarifa." },
      { status: 500 }
    );
  }
}
