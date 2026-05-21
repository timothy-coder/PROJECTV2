import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { hasPerm } from "@/lib/permissions";

function canSeeAll(user) {
  return Boolean(hasPerm(user.permissions, ["agenda", "viewall"]) || hasPerm(user.permissions, ["oportunidades", "viewall"]) || hasPerm(user.permissions, ["leads", "viewall"]));
}

function canSeeAllClients(user) {
  return Boolean(hasPerm(user.permissions, ["clientes", "viewall"]));
}

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

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (
      !hasPerm(user.permissions, ["agenda", "view"]) &&
      !hasPerm(user.permissions, ["agenda", "viewall"]) &&
      !hasPerm(user.permissions, ["oportunidades", "view"]) &&
      !hasPerm(user.permissions, ["oportunidades", "viewall"]) &&
      !hasPerm(user.permissions, ["leads", "view"]) &&
      !hasPerm(user.permissions, ["leads", "viewall"])
    ) {
      return NextResponse.json({ message: "No tienes permiso para ver la agenda." }, { status: 403 });
    }
    const canAll = canSeeAll(user);
    const canAllClients = canSeeAllClients(user);
    const [assignedCenters] = await pool.query(
      `SELECT c.id, c.nombre
       FROM configuracion_centros c
       INNER JOIN administracion_usuario_centros uc ON uc.centro_id=c.id
       WHERE uc.usuario_id=?
       ORDER BY c.nombre ASC`,
      [user.id]
    );
    const [allCenters] = assignedCenters.length ? [assignedCenters] : await pool.query(`SELECT id,nombre FROM configuracion_centros ORDER BY nombre ASC`);
    const centerIds = allCenters.map((center) => center.id);
    const [schedules] = centerIds.length
      ? await pool.query(`SELECT centro_id, slot_minutes, week_json FROM ventas_agenda_centro WHERE centro_id IN (?)`, [centerIds])
      : [[]];
    const [rows] = await pool.query(
      `SELECT o.id, o.oportunidad_id, o.created_by, o.asignado_a, o.created_at, o.etapasconversion_id,
              CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente_nombre,
              e.nombre AS etapa_nombre, e.color AS etapa_color,
              au.fullname AS asignado_nombre, cu.fullname AS creado_nombre,
              d.fecha_agenda, d.hora_agenda, d.created_at AS detalle_created_at,
              a.detalle AS ultimo_detalle
       FROM ventas_oportunidades o
       INNER JOIN administracion_clientes c ON c.id=o.cliente_id
       INNER JOIN ventas_etapasconversion e ON e.id=o.etapasconversion_id
       INNER JOIN administracion_usuarios cu ON cu.id=o.created_by
       LEFT JOIN administracion_usuarios au ON au.id=o.asignado_a
       LEFT JOIN (
         SELECT od.*
         FROM ventas_oportunidades_detalles od
         INNER JOIN (
           SELECT oportunidad_padre_id, MAX(id) AS max_id FROM ventas_oportunidades_detalles GROUP BY oportunidad_padre_id
         ) x ON x.max_id=od.id
       ) d ON d.oportunidad_padre_id=o.id
       LEFT JOIN (
         SELECT act.*
         FROM ventas_oportunidades_actividades act
         INNER JOIN (
           SELECT oportunidad_id, MAX(id) AS max_id FROM ventas_oportunidades_actividades GROUP BY oportunidad_id
         ) ax ON ax.max_id=act.id
       ) a ON a.oportunidad_id=o.id
       ${canAll ? "" : "WHERE o.created_by=? OR o.asignado_a=?"}
       ORDER BY COALESCE(d.fecha_agenda, o.created_at) ASC, COALESCE(d.hora_agenda, '00:00:00') ASC`,
      canAll ? [] : [user.id, user.id]
    );
    const [clients] = await pool.query(
      `SELECT id, CONCAT(COALESCE(nombre,''),' ',COALESCE(apellido,'')) AS nombre
       FROM administracion_clientes
       ${canAllClients ? "" : "WHERE created_by = ?"}
       ORDER BY nombre ASC
       LIMIT 1000`,
      canAllClients ? [] : [user.id]
    );
    const [origins] = await pool.query(`SELECT id, name FROM configuracion_origenes_citas WHERE is_active=1 ORDER BY name ASC`);
    const [suborigins] = await pool.query(`SELECT id, origen_id, name FROM configuracion_suborigenes_citas WHERE is_active=1 ORDER BY name ASC`);
    const [users] = await pool.query(`SELECT id, fullname FROM administracion_usuarios WHERE is_active=1 ORDER BY fullname ASC`);
    const [timeStates] = await pool.query(`SELECT id,nombre,estado,minutos_desde,minutos_hasta,color_hexadecimal,descripcion FROM ventas_configuracion_estados_tiempo WHERE activo=1 ORDER BY minutos_desde ASC`);
    const [stages] = await pool.query(`SELECT id,nombre,color,sort_order FROM ventas_etapasconversion WHERE is_active=1 ORDER BY COALESCE(sort_order,id) ASC`);
    const now = new Date();
    return NextResponse.json({
      currentUser: { id: user.id, fullname: user.fullname, canViewAll: canAll },
      centers: allCenters,
      schedules: allCenters.map((center) => {
        const schedule = schedules.find((item) => Number(item.centro_id) === Number(center.id));
        return {
          centroId: center.id,
          slotMinutes: schedule?.slot_minutes || 30,
          week: safeJson(schedule?.week_json, defaultWeek()),
        };
      }),
      items: rows.map((row) => {
        const agendaDate = datePart(row.fecha_agenda);
        const agendaTime = timePart(row.hora_agenda);
        const agendaAt = agendaDate && agendaTime ? new Date(`${agendaDate}T${agendaTime}`) : null;
        const minutesFromAgenda = agendaAt ? Math.round((now.getTime() - agendaAt.getTime()) / 60000) : null;
        const timeState = minutesFromAgenda === null ? null : timeStates.find((state) => minutesFromAgenda >= Number(state.minutos_desde) && minutesFromAgenda <= Number(state.minutos_hasta));
        return {
          id: row.id,
          code: row.oportunidad_id,
          kind: String(row.oportunidad_id || "").startsWith("LD-") ? "lead" : "opportunity",
          clienteNombre: row.cliente_nombre.trim(),
          etapaId: row.etapasconversion_id,
          etapaNombre: row.etapa_nombre,
          etapaColor: row.etapa_color || "#2563eb",
          creadoPor: row.creado_nombre,
          asignadoA: row.asignado_a,
          asignadoNombre: row.asignado_nombre || "Sin asignar",
          createdBy: row.created_by,
          agendaDate,
          agendaTime,
          detail: row.ultimo_detalle || "",
          timeState: timeState ? { nombre: timeState.nombre, color: timeState.color_hexadecimal, descripcion: timeState.descripcion || "" } : null,
        };
      }),
      options: {
        clients: clients.map((row) => ({ id: row.id, nombre: row.nombre.trim() })),
        origins,
        suborigins: suborigins.map((row) => ({ id: row.id, origenId: row.origen_id, name: row.name })),
        users,
        stages: stages.map((row) => ({ id: row.id, nombre: row.nombre, color: row.color || "#2563eb", sortOrder: row.sort_order || row.id })),
      },
    });
  } catch (error) {
    console.error("Error loading sales agenda:", error);
    return NextResponse.json({ message: "No se pudo cargar la agenda." }, { status: 500 });
  }
}
