import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapMostrador(row) {
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
      return NextResponse.json({ message: "Mostrador invalido." }, { status: 400 });
    }

    if (!Number.isInteger(centroId) || centroId <= 0) {
      return NextResponse.json({ message: "Selecciona un centro valido." }, { status: 400 });
    }

    if (!nombre) {
      return NextResponse.json(
        { message: "El nombre del mostrador es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `UPDATE configuracion_mostradores
       SET centro_id = ?, nombre = ?
       WHERE id = ?`,
      [centroId, nombre, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Mostrador no encontrado." }, { status: 404 });
    }

    const [rows] = await pool.query(
      `SELECT id, centro_id, nombre, created_at
       FROM configuracion_mostradores
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return NextResponse.json({ mostrador: mapMostrador(rows[0]) });
  } catch (error) {
    console.error("Error updating counter:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar el mostrador." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Mostrador invalido." }, { status: 400 });
    }

    const [result] = await pool.query(
      `DELETE FROM configuracion_mostradores
       WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Mostrador no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting counter:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar el mostrador." },
      { status: 500 }
    );
  }
}
