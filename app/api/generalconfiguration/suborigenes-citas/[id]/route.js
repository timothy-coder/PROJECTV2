import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapSuborigen(row) {
  return {
    id: row.id,
    origenId: row.origen_id,
    origenName: row.origen_name || "",
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
    const origenId = Number(body?.origenId);
    const name = String(body?.name || "").trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Suborigen invalido." }, { status: 400 });
    }

    if (!Number.isInteger(origenId) || origenId <= 0) {
      return NextResponse.json({ message: "Selecciona un origen valido." }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json(
        { message: "El nombre del suborigen es obligatorio." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `UPDATE configuracion_suborigenes_citas
       SET origen_id = ?, name = ?, is_active = ?
       WHERE id = ?`,
      [origenId, name, isActive, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Suborigen no encontrado." }, { status: 404 });
    }

    const [rows] = await pool.query(
      `SELECT s.id, s.origen_id, s.name, s.is_active, s.created_at, o.name AS origen_name
       FROM configuracion_suborigenes_citas s
       LEFT JOIN configuracion_origenes_citas o ON o.id = s.origen_id
       WHERE s.id = ?
       LIMIT 1`,
      [id]
    );

    return NextResponse.json({ suborigen: mapSuborigen(rows[0]) });
  } catch (error) {
    console.error("Error updating appointment suborigin:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar el suborigen." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Suborigen invalido." }, { status: 400 });
    }

    const [result] = await pool.query(
      `DELETE FROM configuracion_suborigenes_citas
       WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Suborigen no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting appointment suborigin:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar el suborigen." },
      { status: 500 }
    );
  }
}
