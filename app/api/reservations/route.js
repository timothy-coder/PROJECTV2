import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function canSeeAll(user) {
  return Boolean(hasPerm(user.permissions, ["reservas", "viewall"]));
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const viewAll = canSeeAll(user);
    const [rows] = await pool.query(
      `SELECT r.id, r.oportunidad_id, r.created_by, r.estado, r.observaciones, r.created_at,
              o.oportunidad_id AS oportunidad_code,
              CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente,
              u.fullname AS creado_por,
              d.total, d.vin, d.cuota_inicial
       FROM ventas_reservas r
       LEFT JOIN ventas_oportunidades o ON o.id=r.oportunidad_id
       LEFT JOIN administracion_clientes c ON c.id=o.cliente_id
       LEFT JOIN administracion_usuarios u ON u.id=r.created_by
       LEFT JOIN ventas_reserva_detalles d ON d.reserva_id=r.id
       WHERE ${viewAll ? "1=1" : "r.created_by=?"}
       ORDER BY r.created_at DESC`,
      viewAll ? [] : [user.id]
    );
    const stats = {
      total: rows.length,
      firmadas: rows.filter((row) => row.estado === "firmado").length,
      pendientes: rows.filter((row) => ["borrador", "subsanado"].includes(row.estado)).length,
      revisar: rows.filter((row) => ["enviado_firma", "observado"].includes(row.estado)).length,
    };
    return NextResponse.json({
      currentUser: { id: user.id, canViewAll: viewAll },
      stats,
      reservations: rows.map((row) => ({
        id: row.id,
        oportunidadId: row.oportunidad_id,
        oportunidadCode: row.oportunidad_code || "-",
        cliente: String(row.cliente || "").trim() || "-",
        creadoPor: row.creado_por || "-",
        estado: row.estado || "borrador",
        observaciones: row.observaciones || "",
        total: row.total === null ? null : Number(row.total),
        vin: row.vin || "",
        cuotaInicial: row.cuota_inicial === null ? null : Number(row.cuota_inicial),
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Error loading reservations:", error);
    return NextResponse.json({ message: "No se pudieron cargar las reservas." }, { status: 500 });
  }
}
