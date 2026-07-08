import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { isActiveMaintenanceSubitem, loadMaintenanceSubitems, updateVehicleNextMaintenanceDate } from "@/lib/maintenanceNextVisit";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function datePart(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function timePart(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  return String(value).slice(11, 16) || String(value).slice(0, 5);
}

function dateTimeValue(date, time) {
  const normalizedTime = String(time || "").length === 5 ? `${time}:00` : String(time || "00:00:00").slice(0, 8);
  return `${date} ${normalizedTime}`;
}

function numberValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isFinalizedStatus(value) {
  return String(value || "").toLowerCase().startsWith("finalizad");
}

async function stageIdByNames(connection, names) {
  const normalized = names.map((name) => String(name).toLowerCase());
  const [rows] = await connection.query(
    `SELECT id
     FROM configuracion_posventa_etapasconversion
     WHERE LOWER(nombre) IN (?)
     ORDER BY id ASC
     LIMIT 1`,
    [normalized]
  );
  return rows[0]?.id || null;
}

function mapAppointment(row) {
  return {
    id: row.id,
    centroId: row.centro_id,
    centroNombre: row.centro_nombre || "",
    tallerId: row.taller_id,
    tallerNombre: row.taller_nombre || "",
    clienteId: row.cliente_id,
    clienteNombre: String(row.cliente_nombre || "").trim(),
    vehiculoId: row.vehiculo_id,
    vehiculoNombre: [row.modelo_nombre, row.marca_nombre].filter(Boolean).join(" - ") || row.placas || row.vin || "-",
    asesorId: row.asesor_id,
    asesorNombre: row.asesor_nombre || "Sin asesor",
    origenId: row.origen_id,
    origenNombre: row.origen_nombre || "",
    oportunidadId: row.oportunidadespv_id,
    oportunidadCodigo: row.oportunidad_codigo || "",
    startDate: datePart(row.start_at),
    startTime: timePart(row.start_at),
    endDate: datePart(row.end_at),
    endTime: timePart(row.end_at),
    estado: row.estado || "pendiente",
    tipoServicio: row.tipo_servicio,
    notaCliente: row.nota_cliente || "",
    notaInterna: row.nota_interna || "",
    createdBy: row.created_by,
    creadoPorNombre: row.creado_por_nombre || "",
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (!hasPerm(user.permissions, ["citas", "view"]) && !hasPerm(user.permissions, ["citas", "viewall"])) {
      return NextResponse.json({ message: "No tienes permiso para ver citas de PostVenta." }, { status: 403 });
    }
    const canAll = hasPerm(user.permissions, ["citas", "viewall"]);
    const [rows] = await pool.query(
      `SELECT pc.*, cc.nombre AS centro_nombre, ct.nombre AS taller_nombre,
              CONCAT(COALESCE(cl.nombre,''),' ',COALESCE(cl.apellido,'')) AS cliente_nombre,
              v.placas, v.vin, ma.name AS marca_nombre, mo.name AS modelo_nombre,
              asesor.fullname AS asesor_nombre, creador.fullname AS creado_por_nombre,
              oc.name AS origen_nombre, op.oportunidad_id AS oportunidad_codigo
       FROM posventa_citas pc
       INNER JOIN configuracion_centros cc ON cc.id=pc.centro_id
       LEFT JOIN configuracion_talleres ct ON ct.id=pc.taller_id
       INNER JOIN administracion_clientes cl ON cl.id=pc.cliente_id
       LEFT JOIN administracion_vehiculos v ON v.id=pc.vehiculo_id
       LEFT JOIN administracion_marcas ma ON ma.id=v.marca_id
       LEFT JOIN administracion_modelos mo ON mo.id=v.modelo_id
       LEFT JOIN administracion_usuarios asesor ON asesor.id=pc.asesor_id
       INNER JOIN administracion_usuarios creador ON creador.id=pc.created_by
       LEFT JOIN configuracion_origenes_citas oc ON oc.id=pc.origen_id
       LEFT JOIN posventa_oportunidades op ON op.id=pc.oportunidadespv_id
       ${canAll ? "" : "WHERE pc.created_by=? OR pc.asesor_id=?"}
       ORDER BY pc.start_at DESC, pc.id DESC`,
      canAll ? [] : [user.id, user.id]
    );
    const maintenanceSubitems = await loadMaintenanceSubitems(pool);
    return NextResponse.json({ currentUser: { id: user.id, fullname: user.fullname, canViewAll: canAll }, appointments: rows.map(mapAppointment), maintenanceSubitems });
  } catch (error) {
    console.error("Error loading postventa appointments:", error);
    return NextResponse.json({ message: "No se pudieron cargar las citas de PostVenta." }, { status: 500 });
  }
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (!hasPerm(user.permissions, ["citas", "create"])) {
      return NextResponse.json({ message: "No tienes permiso para crear citas de PostVenta." }, { status: 403 });
    }
    const body = await request.json();
    if (!body.oportunidadId || !body.centroId || !body.startDate || !body.startTime || !body.tipoServicio) {
      return NextResponse.json({ message: "Completa oportunidad, centro, fecha, hora y tipo de servicio." }, { status: 400 });
    }
    const [[opportunity]] = await connection.query(
      `SELECT id, cliente_id, vehiculo_id, origen_id FROM posventa_oportunidades WHERE id=? LIMIT 1`,
      [Number(body.oportunidadId)]
    );
    if (!opportunity) return NextResponse.json({ message: "Oportunidad no encontrada." }, { status: 404 });
    const startAt = dateTimeValue(body.startDate, body.startTime);
    const endAt = dateTimeValue(body.endDate || body.startDate, body.endTime || body.startTime);
    const shouldRegisterMaintenance = isFinalizedStatus(body.estado);
    const maintenanceKm = numberValue(body.kilometrajeTaller ?? body.kilometraje);
    const submantenimientoId = body.submantenimientoId ? Number(body.submantenimientoId) : null;
    if (shouldRegisterMaintenance && !opportunity.vehiculo_id) {
      return NextResponse.json({ message: "La oportunidad no tiene vehiculo para registrar mantenimiento." }, { status: 400 });
    }
    if (shouldRegisterMaintenance && maintenanceKm === null) {
      return NextResponse.json({ message: "Ingresa el kilometraje para finalizar la cita." }, { status: 400 });
    }
    if (shouldRegisterMaintenance && !submantenimientoId) {
      return NextResponse.json({ message: "Selecciona el submantenimiento realizado." }, { status: 400 });
    }
    if (shouldRegisterMaintenance) {
      if (!(await isActiveMaintenanceSubitem(connection, submantenimientoId))) {
        return NextResponse.json({ message: "El submantenimiento seleccionado no es valido." }, { status: 400 });
      }
    }
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO posventa_citas
       (centro_id, taller_id, cliente_id, vehiculo_id, asesor_id, origen_id, oportunidadespv_id, start_at, end_at, estado, created_by, tipo_servicio, nota_cliente, nota_interna)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(body.centroId),
        body.tallerId ? Number(body.tallerId) : null,
        opportunity.cliente_id,
        opportunity.vehiculo_id || null,
        body.asesorId ? Number(body.asesorId) : null,
        body.origenId ? Number(body.origenId) : opportunity.origen_id || null,
        opportunity.id,
        startAt,
        endAt,
        body.estado || "pendiente",
        user.id,
        body.tipoServicio,
        body.notaCliente || null,
        body.notaInterna || null,
      ]
    );
    const nextStageId = shouldRegisterMaintenance
      ? await stageIdByNames(connection, ["Cita efectiva"])
      : await stageIdByNames(connection, ["Agendado", "Agendada"]);
    if (nextStageId) {
      await connection.query(`UPDATE posventa_oportunidades SET etapasconversionpv_id=? WHERE id=?`, [nextStageId, opportunity.id]);
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
         VALUES (?, ?, ?, ?)`,
        [opportunity.id, nextStageId, shouldRegisterMaintenance ? `Cita efectiva: ${body.startDate} ${body.startTime}` : `Cita agendada: ${body.startDate} ${body.startTime}`, user.id]
      );
    }
    if (shouldRegisterMaintenance) {
      await connection.query(
        `INSERT INTO administracion_vehiculos_historial_mantenimientos
         (vehiculo_id, fecha_visita_taller, kilometraje_taller, submantenimiento_id, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [opportunity.vehiculo_id, startAt, maintenanceKm, submantenimientoId, user.id]
      );
      await updateVehicleNextMaintenanceDate(connection, opportunity.vehiculo_id);
    }
    await connection.commit();
    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating postventa appointment:", error);
    return NextResponse.json({ message: "No se pudo crear la cita de PostVenta." }, { status: 500 });
  } finally {
    connection.release();
  }
}
