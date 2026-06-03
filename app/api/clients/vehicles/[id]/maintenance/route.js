import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { updateVehicleNextMaintenanceDate } from "@/lib/maintenanceNextVisit";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function numberValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dateTimeValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  const clean = String(value).trim();
  if (!clean) return null;
  return clean.length <= 10 ? `${clean} 00:00:00` : clean.replace("T", " ").slice(0, 19);
}

function canManageMaintenance(permissions) {
  return (
    hasPerm(permissions, ["clientes", "vehicles"]) ||
    hasPerm(permissions, ["clientes", "maintenance_import"])
  );
}

export async function POST(request, { params }) {
  const connection = await pool.getConnection();

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    if (!canManageMaintenance(user.permissions || {})) {
      return NextResponse.json({ message: "No tienes permiso para registrar mantenimientos." }, { status: 403 });
    }

    const { id: rawId } = await params;
    const vehicleId = Number(rawId);
    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      return NextResponse.json({ message: "Vehiculo invalido." }, { status: 400 });
    }

    const body = await request.json();
    const fechaVisita = dateTimeValue(body.fechaVisitaTaller ?? body.fechaVisita ?? body.fecha);
    const kilometraje = numberValue(body.kilometrajeTaller ?? body.kilometraje);

    if (!fechaVisita) {
      return NextResponse.json({ message: "La fecha de visita es obligatoria." }, { status: 400 });
    }

    await connection.beginTransaction();

    const [[vehicle]] = await connection.query(
      `SELECT id FROM administracion_vehiculos WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [vehicleId]
    );

    if (!vehicle?.id) {
      await connection.rollback();
      return NextResponse.json({ message: "Vehiculo no encontrado." }, { status: 404 });
    }

    await connection.query(
      `INSERT INTO administracion_vehiculos_historial_mantenimientos
       (vehiculo_id, fecha_visita_taller, kilometraje_taller, created_by)
       VALUES (?, ?, ?, ?)`,
      [vehicleId, fechaVisita, kilometraje, user.id]
    );

    const nextDate = await updateVehicleNextMaintenanceDate(connection, vehicleId);
    await connection.commit();

    return NextResponse.json({ ok: true, nextDate });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating vehicle maintenance:", error);
    return NextResponse.json(
      { message: "No se pudo registrar el mantenimiento." },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
