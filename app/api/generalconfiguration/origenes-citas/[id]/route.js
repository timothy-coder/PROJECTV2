import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapOrigen(row) {
  return {
    id: row.id,
    name: row.name,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Origen invalido." }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json(
        { message: "El nombre del origen es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `UPDATE configuracion_origenes_citas
       SET name = ?, is_active = ?
       WHERE id = ?`,
      [name, isActive, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Origen no encontrado." }, { status: 404 });
    }

    const [rows] = await pool.query(
      `SELECT id, name, is_active, created_at
       FROM configuracion_origenes_citas
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return NextResponse.json({ origen: mapOrigen(rows[0]) });
  } catch (error) {
    console.error("Error updating appointment origin:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar el origen." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Origen invalido." }, { status: 400 });
    }

    const [result] = await pool.query(
      `DELETE FROM configuracion_origenes_citas
       WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Origen no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting appointment origin:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar el origen." },
      { status: 500 }
    );
  }
}
