import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapTaller(row) {
  return {
    id: row.id,
    centroId: row.centro_id,
    nombre: row.nombre,
    createdAt: row.created_at,
  };
}

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const centroId = Number(body?.centroId);
    const nombre = String(body?.nombre || "").trim();

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Taller invalido." }, { status: 400 });
    }

    if (!Number.isInteger(centroId) || centroId <= 0) {
      return NextResponse.json({ message: "Selecciona un centro valido." }, { status: 400 });
    }

    if (!nombre) {
      return NextResponse.json(
        { message: "El nombre del taller es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `UPDATE configuracion_talleres
       SET centro_id = ?, nombre = ?
       WHERE id = ?`,
      [centroId, nombre, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Taller no encontrado." }, { status: 404 });
    }

    const [rows] = await pool.query(
      `SELECT id, centro_id, nombre, created_at
       FROM configuracion_talleres
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return NextResponse.json({ taller: mapTaller(rows[0]) });
  } catch (error) {
    console.error("Error updating workshop:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar el taller." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Taller invalido." }, { status: 400 });
    }

    const [result] = await pool.query(
      `DELETE FROM configuracion_talleres
       WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Taller no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting workshop:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar el taller." },
      { status: 500 }
    );
  }
}
