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

export async function POST(request) {
  try {
    const payload = normalizeVehicle(await request.json());

    if (!payload.clienteId || !payload.placas) {
      return NextResponse.json(
        { message: "Cliente y placa son obligatorios." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO administracion_vehiculos
       (cliente_id, placas, vin, marca_id, modelo_id, anio, color,
        kilometraje, fecha_ultima_visita, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE())`,
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
      ]
    );

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating vehicle:", error);

    return NextResponse.json(
      { message: "No se pudo crear el vehiculo." },
      { status: 500 }
    );
  }
}
