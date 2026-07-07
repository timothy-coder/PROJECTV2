import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { updateVehicleNextMaintenanceDate } from "@/lib/maintenanceNextVisit";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function canRecalculate(permissions) {
  return (
    hasPerm(permissions, ["clientes", "vehicles"]) ||
    hasPerm(permissions, ["clientes", "maintenance_import"]) ||
    hasPerm(permissions, ["proximosmantenimientos", "view"]) ||
    hasPerm(permissions, ["proximosmantenimientos", "viewall"])
  );
}

export async function POST() {
  const connection = await pool.getConnection();

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    if (!canRecalculate(user.permissions || {})) {
      return NextResponse.json({ message: "No tienes permiso para recalcular mantenimientos." }, { status: 403 });
    }

    const canViewAll = Boolean(
      hasPerm(user.permissions || {}, ["clientes", "viewall"]) ||
      hasPerm(user.permissions || {}, ["proximosmantenimientos", "viewall"])
    );
    const ownershipWhere = canViewAll ? "" : "AND c.created_by = ?";
    const ownershipParams = canViewAll ? [] : [user.id];

    const [vehicles] = await connection.query(
      `SELECT v.id
       FROM administracion_vehiculos v
       LEFT JOIN administracion_clientes c ON c.id = v.cliente_id
       WHERE v.deleted_at IS NULL ${ownershipWhere}
       ORDER BY v.id ASC`,
      ownershipParams
    );

    await connection.beginTransaction();

    let updated = 0;
    for (const vehicle of vehicles) {
      await updateVehicleNextMaintenanceDate(connection, vehicle.id);
      updated += 1;
    }

    await connection.commit();

    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    await connection.rollback();
    console.error("Error recalculating vehicle maintenance:", error);
    return NextResponse.json(
      { message: "No se pudo recalcular los mantenimientos." },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
