import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const nombre = String(body?.nombre || "").trim();

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Centro invalido." }, { status: 400 });
    }

    if (!nombre) {
      return NextResponse.json(
        { message: "El nombre del centro es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `UPDATE configuracion_centros
       SET nombre = ?
       WHERE id = ?`,
      [nombre, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Centro no encontrado." }, { status: 404 });
    }

    const [rows] = await pool.query(
      `SELECT id, nombre, created_at
       FROM configuracion_centros
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    const centro = rows[0];

    return NextResponse.json({
      centro: {
        id: centro.id,
        nombre: centro.nombre,
        createdAt: centro.created_at,
      },
    });
  } catch (error) {
    console.error("Error updating configuration center:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar el centro." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Centro invalido." }, { status: 400 });
    }

    const [result] = await pool.query(
      `DELETE FROM configuracion_centros
       WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Centro no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting configuration center:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar el centro." },
      { status: 500 }
    );
  }
}
