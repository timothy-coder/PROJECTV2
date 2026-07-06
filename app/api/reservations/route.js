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
              d.total, d.vin, d.placa, d.numero_motor, d.cuota_inicial,
              p.marca_id, p.modelo_id, p.version,
              ma.name AS marca_nombre, mo.name AS modelo_nombre,
              ev.id AS car_event_id
       FROM ventas_reservas r
       LEFT JOIN ventas_oportunidades o ON o.id=r.oportunidad_id
       LEFT JOIN administracion_clientes c ON c.id=o.cliente_id
       LEFT JOIN administracion_usuarios u ON u.id=r.created_by
       LEFT JOIN ventas_reserva_detalles d ON d.reserva_id=r.id
       LEFT JOIN ventas_cotizaciones q ON q.id=d.cotizacion_id
       LEFT JOIN ventas_precios p ON p.id=q.precio_id
       LEFT JOIN administracion_marcas ma ON ma.id=p.marca_id
       LEFT JOIN administracion_modelos mo ON mo.id=p.modelo_id
       LEFT JOIN (
         SELECT e1.*
         FROM ventas_historial_carros_eventos e1
         INNER JOIN (
           SELECT vin, MAX(id) AS id
           FROM ventas_historial_carros_eventos
           WHERE vin IS NOT NULL AND vin <> ''
           GROUP BY vin
         ) latest_event ON latest_event.id=e1.id
       ) ev ON ev.vin=d.vin
       WHERE ${viewAll ? "1=1" : "r.created_by=?"}
       ORDER BY CASE WHEN r.estado='firmado' THEN 1 ELSE 0 END ASC, r.created_at DESC`,
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
        placa: row.placa || "",
        numeroMotor: row.numero_motor || "",
        marcaId: row.marca_id || null,
        modeloId: row.modelo_id || null,
        marca: row.marca_nombre || "",
        modelo: row.modelo_nombre || "",
        version: row.version || "",
        modeloNota: [row.marca_nombre, row.modelo_nombre, row.version].filter(Boolean).join(" "),
        faltaDatosCarro: row.estado === "firmado" && (!row.vin || !row.car_event_id),
        cuotaInicial: row.cuota_inicial === null ? null : Number(row.cuota_inicial),
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Error loading reservations:", error);
    return NextResponse.json({ message: "No se pudieron cargar las reservas." }, { status: 500 });
  }
}
