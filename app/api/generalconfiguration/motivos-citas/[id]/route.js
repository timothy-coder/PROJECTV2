import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapMotivo(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    submotivos: [],
  };
}

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const nombre = String(body?.nombre || "").trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Motivo invalido." }, { status: 400 });
    }

    if (!nombre) {
      return NextResponse.json(
        { message: "El nombre del motivo es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `UPDATE configuracion_motivos_citas
       SET nombre = ?, is_active = ?
       WHERE id = ?`,
      [nombre, isActive, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Motivo no encontrado." }, { status: 404 });
    }

    const [rows] = await pool.query(
      `SELECT id, nombre, is_active, created_at
       FROM configuracion_motivos_citas
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return NextResponse.json({ motivo: mapMotivo(rows[0]) });
  } catch (error) {
    console.error("Error updating appointment reason:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar el motivo." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Motivo invalido." }, { status: 400 });
    }

    const [result] = await pool.query(
      `DELETE FROM configuracion_motivos_citas
       WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Motivo no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting appointment reason:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar el motivo." },
      { status: 500 }
    );
  }
}
