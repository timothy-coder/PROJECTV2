import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapMaintenance(row, subitems = []) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    isActive: Boolean(row.is_active),
    mantenimientoId: row.mantenimiento_id || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subitems: subitems.filter((item) => item.posventaMantenimientoId === row.id),
  };
}

export async function GET() {
  try {
    const [maintenanceRows] = await pool.query(
      `SELECT id, name, description, is_active, mantenimiento_id, created_at, updated_at
       FROM posventa_mantenimiento
       ORDER BY name ASC`
    );
    const [subRows] = await pool.query(
      `SELECT s.id, s.name, s.description, s.posventamantenimiento_id, s.is_active, s.created_at, s.updated_at,
              m.name AS mantenimiento_name
       FROM posventa_submantenimiento s
       LEFT JOIN posventa_mantenimiento m ON m.id = s.posventamantenimiento_id
       ORDER BY m.name ASC, s.name ASC`
    );

    const subitems = subRows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || "",
      posventaMantenimientoId: row.posventamantenimiento_id,
      mantenimientoName: row.mantenimiento_name || "",
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    const maintenances = maintenanceRows.map((row) => mapMaintenance(row, subitems));

    return NextResponse.json({ maintenances, subitems });
  } catch (error) {
    console.error("Error loading maintenance:", error);
    return NextResponse.json({ message: "No se pudieron cargar mantenimientos." }, { status: 500 });
  }
}
