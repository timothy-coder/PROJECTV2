import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function normalizeVehicle(body) {
  return {
    clienteId: Number(body.clienteId),
    placas: String(body.placas || "").trim() || null,
    vin: String(body.vin || "").trim() || null,
    marcaId: body.marcaId ? Number(body.marcaId) : null,
    modeloId: body.modeloId ? Number(body.modeloId) : null,
    anio: body.anio ? Number(body.anio) : null,
    color: String(body.color || "").trim() || null,
    kilometraje: body.kilometraje ? Number(body.kilometraje) : null,
    fechaUltimaVisita: body.fechaUltimaVisita || null,
  };
}

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const payload = normalizeVehicle(await request.json());

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Vehiculo invalido." }, { status: 400 });
    }

    const [result] = await pool.query(
      `UPDATE administracion_vehiculos
       SET cliente_id = ?, placas = ?, vin = ?, marca_id = ?, modelo_id = ?,
           anio = ?, color = ?, kilometraje = ?, fecha_ultima_visita = ?
       WHERE id = ?`,
      [
        payload.clienteId,
        payload.placas,
        payload.vin,
        payload.marcaId,
        payload.modeloId,
        payload.anio,
        payload.color,
        payload.kilometraje,
        payload.fechaUltimaVisita,
        id,
      ]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Vehiculo no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating vehicle:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar el vehiculo." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Vehiculo invalido." }, { status: 400 });
    }

    const [result] = await pool.query(
      `UPDATE administracion_vehiculos SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Vehiculo no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting vehicle:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar el vehiculo." },
      { status: 500 }
    );
  }
}
