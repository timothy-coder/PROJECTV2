import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapSubmotivo(row) {
  return {
    id: row.id,
    motivoId: row.motivo_id,
    nombre: row.nombre,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const motivoId = Number(body?.motivoId);
    const nombre = String(body?.nombre || "").trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Submotivo invalido." }, { status: 400 });
    }

    if (!Number.isInteger(motivoId) || motivoId <= 0) {
      return NextResponse.json({ message: "Selecciona un motivo valido." }, { status: 400 });
    }

    if (!nombre) {
      return NextResponse.json(
        { message: "El nombre del submotivo es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `UPDATE configuracion_submotivos_citas
       SET motivo_id = ?, nombre = ?, is_active = ?
       WHERE id = ?`,
      [motivoId, nombre, isActive, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Submotivo no encontrado." }, { status: 404 });
    }

    const [rows] = await pool.query(
      `SELECT id, motivo_id, nombre, is_active, created_at
       FROM configuracion_submotivos_citas
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return NextResponse.json({ submotivo: mapSubmotivo(rows[0]) });
  } catch (error) {
    console.error("Error updating appointment subreason:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar el submotivo." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Submotivo invalido." }, { status: 400 });
    }

    const [result] = await pool.query(
      `DELETE FROM configuracion_submotivos_citas
       WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Submotivo no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting appointment subreason:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar el submotivo." },
      { status: 500 }
    );
  }
}
