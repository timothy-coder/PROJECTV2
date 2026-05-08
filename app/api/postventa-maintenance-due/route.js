import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function datePart(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
}

function daysBetween(from, to) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.ceil((end - start) / 86400000);
}

function parseRanges(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function yearMatches(year, ranges) {
  if (!year || !ranges.length) return true;
  return ranges.some((range) => {
    const [start, end] = String(range).split("-").map(Number);
    return year >= start && year <= end;
  });
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (!hasPerm(user.permissions, ["oportunidadespv", "view"]) && !hasPerm(user.permissions, ["leadspv", "view"]) && !hasPerm(user.permissions, ["oportunidadespv", "viewall"])) {
      return NextResponse.json({ message: "No tienes permiso para ver proximos mantenimientos." }, { status: 403 });
    }
    const [vehicles] = await pool.query(
      `SELECT v.id, v.cliente_id, v.placas, v.vin, v.anio, v.kilometraje, v.fecha_ultima_visita,
              CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente_nombre,
              ma.name AS marca_nombre, mo.name AS modelo_nombre,
              av.kilometraje AS algoritmo_km, av.meses AS algoritmo_meses, av.anios AS algoritmo_anios,
              opp.id AS oportunidad_abierta_id, opp.oportunidad_id AS oportunidad_codigo,
              od.fecha_agenda, od.hora_agenda
       FROM administracion_vehiculos v
       INNER JOIN administracion_clientes c ON c.id=v.cliente_id
       LEFT JOIN administracion_marcas ma ON ma.id=v.marca_id
       LEFT JOIN administracion_modelos mo ON mo.id=v.modelo_id
       LEFT JOIN administracion_algoritmo_visita av ON av.marca_id=v.marca_id AND av.modelo_id=v.modelo_id
       LEFT JOIN posventa_oportunidades opp ON opp.vehiculo_id=v.id
       LEFT JOIN (
         SELECT d.*
         FROM posventa_oportunidades_detalles d
         INNER JOIN (SELECT oportunidad_padre_id, MAX(id) AS max_id FROM posventa_oportunidades_detalles GROUP BY oportunidad_padre_id) x ON x.max_id=d.id
       ) od ON od.oportunidad_padre_id=opp.id
       WHERE v.deleted_at IS NULL
       ORDER BY c.nombre ASC, v.id DESC`
    );
    const [frequencies] = await pool.query(`SELECT id,dias FROM configuracion_prospeccion_frecuencia ORDER BY dias DESC`);
    const today = new Date();
    const unique = new Map();
    for (const row of vehicles) {
      if (unique.has(row.id)) continue;
      const ranges = parseRanges(row.algoritmo_anios);
      const validAlgorithm = row.algoritmo_meses && yearMatches(Number(row.anio), ranges);
      const lastVisit = row.fecha_ultima_visita ? new Date(row.fecha_ultima_visita) : null;
      const nextByTime = validAlgorithm && lastVisit ? addMonths(lastVisit, row.algoritmo_meses) : null;
      const daysRemaining = nextByTime ? daysBetween(today, nextByTime) : null;
      const matchedFrequency = daysRemaining === null ? null : frequencies.find((item) => daysRemaining <= Number(item.dias));
      const reminderDate = nextByTime && matchedFrequency ? new Date(nextByTime) : null;
      if (reminderDate) reminderDate.setDate(reminderDate.getDate() - Number(matchedFrequency.dias));
      unique.set(row.id, {
        id: row.id,
        clienteId: row.cliente_id,
        clienteNombre: row.cliente_nombre.trim(),
        vehiculo: [row.modelo_nombre, row.marca_nombre].filter(Boolean).join(" - ") || row.placas || row.vin || "-",
        marca: row.marca_nombre || "",
        modelo: row.modelo_nombre || "",
        placa: row.placas || "",
        vin: row.vin || "",
        anio: row.anio,
        kilometraje: row.kilometraje,
        fechaUltimaVisita: datePart(row.fecha_ultima_visita),
        proximoMantenimiento: nextByTime ? datePart(nextByTime) : "",
        calculo: nextByTime ? "Tiempo" : "",
        diasRestantes: daysRemaining,
        recordatorio: reminderDate ? datePart(reminderDate) : "",
        estadoRecordatorio: daysRemaining === null ? "Sin algoritmo" : daysRemaining < 0 ? "Vencido" : matchedFrequency ? "Pendiente contacto" : "Programado",
        oportunidadId: row.oportunidad_abierta_id,
        oportunidadCodigo: row.oportunidad_codigo || "",
        fechaAgendada: row.fecha_agenda ? `${datePart(row.fecha_agenda)} ${String(row.hora_agenda || "").slice(0, 5)}` : "",
      });
    }
    const [origins] = await pool.query(`SELECT id,name FROM configuracion_origenes_citas WHERE is_active=1 ORDER BY name ASC`);
    const [suborigins] = await pool.query(`SELECT id,origen_id,name FROM configuracion_suborigenes_citas WHERE is_active=1 ORDER BY name ASC`);
    const [users] = await pool.query(`SELECT id,fullname FROM administracion_usuarios WHERE is_active=1 ORDER BY fullname ASC`);
    const [stages] = await pool.query(`SELECT id,nombre,color,sort_order FROM configuracion_posventa_etapasconversion WHERE is_active=1 ORDER BY COALESCE(sort_order,id) ASC`);
    return NextResponse.json({
      currentUser: { id: user.id, fullname: user.fullname, canViewAll: Boolean(hasPerm(user.permissions, ["oportunidadespv", "viewall"]) || hasPerm(user.permissions, ["leadspv", "viewall"])) },
      vehicles: Array.from(unique.values()),
      options: {
        origins: origins.map((row) => ({ id: row.id, name: row.name })),
        suborigins: suborigins.map((row) => ({ id: row.id, origenId: row.origen_id, name: row.name })),
        users: users.map((row) => ({ id: row.id, fullname: row.fullname })),
        stages: stages.map((row) => ({ id: row.id, nombre: row.nombre, color: row.color || "#2563eb", sortOrder: row.sort_order || row.id })),
      },
    });
  } catch (error) {
    console.error("Error loading maintenance due:", error);
    return NextResponse.json({ message: "No se pudo cargar proximos mantenimientos." }, { status: 500 });
  }
}
