import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function datePart(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function timePart(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function safeJson(value, fallback) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value || fallback;
  } catch {
    return fallback;
  }
}

function defaultWeek() {
  return {
    monday: { active: true, start: "08:00", end: "18:00" },
    tuesday: { active: true, start: "08:00", end: "18:00" },
    wednesday: { active: true, start: "08:00", end: "18:00" },
    thursday: { active: true, start: "08:00", end: "18:00" },
    friday: { active: true, start: "08:00", end: "18:00" },
    saturday: { active: false, start: "08:00", end: "18:00" },
    sunday: { active: false, start: "08:00", end: "18:00" },
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (!hasPerm(user.permissions, ["citas", "view"]) && !hasPerm(user.permissions, ["oportunidadespv", "view"]) && !hasPerm(user.permissions, ["leadspv", "view"])) {
      return NextResponse.json({ message: "No tienes permiso para ver la agenda de PostVenta." }, { status: 403 });
    }
    const canAll = Boolean(hasPerm(user.permissions, ["citas", "viewall"]) || hasPerm(user.permissions, ["oportunidadespv", "viewall"]) || hasPerm(user.permissions, ["leadspv", "viewall"]));
    const [centers] = await pool.query(`SELECT id,nombre FROM configuracion_centros ORDER BY nombre ASC`);
    const [schedules] = centers.length
      ? await pool.query(`SELECT centro_id, slot_minutes, week_json FROM configuracion_posventa_citas_centro WHERE centro_id IN (?)`, [centers.map((center) => center.id)])
      : [[]];
    const [rows] = await pool.query(
      `SELECT o.id, o.oportunidad_id, o.created_by, o.asignado_a, o.etapasconversionpv_id,
              CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente_nombre,
              e.nombre AS etapa_nombre, e.color AS etapa_color,
              au.fullname AS asignado_nombre,
              d.fecha_agenda, d.hora_agenda,
              a.detalle AS ultimo_detalle
       FROM posventa_oportunidades o
       INNER JOIN administracion_clientes c ON c.id=o.cliente_id
       INNER JOIN configuracion_posventa_etapasconversion e ON e.id=o.etapasconversionpv_id
       LEFT JOIN administracion_usuarios au ON au.id=o.asignado_a
       LEFT JOIN (
         SELECT od.*
         FROM posventa_oportunidades_detalles od
         INNER JOIN (SELECT oportunidad_padre_id, MAX(id) AS max_id FROM posventa_oportunidades_detalles GROUP BY oportunidad_padre_id) x ON x.max_id=od.id
       ) d ON d.oportunidad_padre_id=o.id
       LEFT JOIN (
         SELECT act.*
         FROM posventa_oportunidades_actividades act
         INNER JOIN (SELECT oportunidad_id, MAX(id) AS max_id FROM posventa_oportunidades_actividades GROUP BY oportunidad_id) ax ON ax.max_id=act.id
       ) a ON a.oportunidad_id=o.id
       ${canAll ? "" : "WHERE o.created_by=? OR o.asignado_a=?"}
       ORDER BY COALESCE(d.fecha_agenda, o.created_at) ASC, COALESCE(d.hora_agenda, '00:00:00') ASC`,
      canAll ? [] : [user.id, user.id]
    );
    return NextResponse.json({
      currentUser: { id: user.id, fullname: user.fullname, canViewAll: canAll },
      centers,
      schedules: centers.map((center) => {
        const schedule = schedules.find((item) => Number(item.centro_id) === Number(center.id));
        return { centroId: center.id, slotMinutes: schedule?.slot_minutes || 30, week: safeJson(schedule?.week_json, defaultWeek()) };
      }),
      items: rows.map((row) => ({
        id: row.id,
        code: row.oportunidad_id,
        kind: String(row.oportunidad_id || "").startsWith("LDPV-") ? "lead" : "opportunity",
        clienteNombre: row.cliente_nombre.trim(),
        etapaId: row.etapasconversionpv_id,
        etapaNombre: row.etapa_nombre,
        etapaColor: row.etapa_color || "#2563eb",
        asignadoA: row.asignado_a,
        asignadoNombre: row.asignado_nombre || "Sin asignar",
        createdBy: row.created_by,
        agendaDate: datePart(row.fecha_agenda),
        agendaTime: timePart(row.hora_agenda),
        detail: row.ultimo_detalle || "",
      })),
      options: { users: [] },
    });
  } catch (error) {
    console.error("Error loading postventa agenda:", error);
    return NextResponse.json({ message: "No se pudo cargar la agenda de PostVenta." }, { status: 500 });
  }
}
