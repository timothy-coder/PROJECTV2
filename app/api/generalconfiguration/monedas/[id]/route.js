import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapMoneda(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    simbolo: row.simbolo,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const codigo = String(body?.codigo || "").trim().toUpperCase();
    const nombre = String(body?.nombre || "").trim();
    const simbolo = String(body?.simbolo || "").trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Moneda invalida." }, { status: 400 });
    }

    if (!codigo || !nombre || !simbolo) {
      return NextResponse.json(
        { message: "Codigo, nombre y simbolo son obligatorios." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `UPDATE configuracion_monedas
       SET codigo = ?, nombre = ?, simbolo = ?, is_active = ?
       WHERE id = ?`,
      [codigo, nombre, simbolo, isActive, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Moneda no encontrada." }, { status: 404 });
    }

    const [rows] = await pool.query(
      `SELECT id, codigo, nombre, simbolo, is_active, created_at, updated_at
       FROM configuracion_monedas
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return NextResponse.json({ moneda: mapMoneda(rows[0]) });
  } catch (error) {
    console.error("Error updating currency:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar la moneda." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Moneda invalida." }, { status: 400 });
    }

    const [result] = await pool.query(
      `DELETE FROM configuracion_monedas
       WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Moneda no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting currency:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar la moneda." },
      { status: 500 }
    );
  }
}
