import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapImpuesto(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    porcentaje: Number(row.porcentaje),
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
    const nombre = String(body?.nombre || "").trim();
    const porcentaje = Number(body?.porcentaje);
    const isActive = body?.isActive === false ? 0 : 1;

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Impuesto invalido." }, { status: 400 });
    }

    if (!nombre || Number.isNaN(porcentaje) || porcentaje < 0) {
      return NextResponse.json(
        { message: "Nombre y porcentaje valido son obligatorios." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `UPDATE configuracion_impuestos
       SET nombre = ?, porcentaje = ?, is_active = ?
       WHERE id = ?`,
      [nombre, porcentaje, isActive, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Impuesto no encontrado." }, { status: 404 });
    }

    const [rows] = await pool.query(
      `SELECT id, nombre, porcentaje, is_active, created_at, updated_at
       FROM configuracion_impuestos
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return NextResponse.json({ impuesto: mapImpuesto(rows[0]) });
  } catch (error) {
    console.error("Error updating tax:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar el impuesto." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Impuesto invalido." }, { status: 400 });
    }

    const [result] = await pool.query(
      `DELETE FROM configuracion_impuestos
       WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Impuesto no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting tax:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar el impuesto." },
      { status: 500 }
    );
  }
}
