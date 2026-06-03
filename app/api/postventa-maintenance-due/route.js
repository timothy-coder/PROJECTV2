import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { datePart, daysBetween } from "@/lib/maintenanceNextVisit";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
}

function addDaysTrunc(date, days) {
  const n = Number(days);
  if (!Number.isFinite(n)) return null;
  const next = new Date(date);
  next.setDate(next.getDate() + Math.floor(n)); // trunc como tu ejemplo
  return next;
}

function parseRanges(value) {
  try {
    if (!value) return [];
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const txt = String(value || "").trim();
    if (!txt) return [];
    return txt.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

function yearMatches(year, ranges) {
  if (!year || !ranges.length) return true;
  return ranges.some((range) => {
    const [start, end] = String(range).split("-").map((n) => Number(String(n).trim()));
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return year >= start && year <= end;
  });
}

/**
 * rows vienen ORDER BY fecha_visita_taller DESC, id DESC.
 * - T1: último registro
 * - T2: penúltimo registro con día distinto a T1 (si hay mismo día, se ignoran)
 */
function pickT1T2DistinctDay(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { t1: null, t2: null };

  const t1 = rows[0];
  const day1 = datePart(t1.fecha_visita_taller);

  let t2 = null;
  for (let i = 1; i < rows.length; i++) {
    if (datePart(rows[i].fecha_visita_taller) !== day1) {
      t2 = rows[i];
      break;
    }
  }
  return { t1, t2 };
}

/**
 * Reglas de selección:
 * - Si hay futuras (>= hoy): elegir la menor (más cercana futura).
 * - Si todas vencidas (< hoy): elegir la menor (la que pasó primero).
 */
function pickProximo(today, candidates) {
  const valid = candidates.filter((c) => c?.date instanceof Date && !Number.isNaN(c.date.valueOf()));
  if (!valid.length) return { date: null, calculo: "" };

  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  // todas vencidas: elegir la que pasó primero (más antigua)
  valid.sort((a, b) => {
    const aDay = new Date(a.date.getFullYear(), a.date.getMonth(), a.date.getDate()).getTime();
    const bDay = new Date(b.date.getFullYear(), b.date.getMonth(), b.date.getDate()).getTime();
    const distance = Math.abs(aDay - todayDay) - Math.abs(bDay - todayDay);
    if (distance !== 0) return distance;
    return aDay - bDay;
  });
  return { date: valid[0].date, calculo: valid[0].calculo };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });

    if (
      !hasPerm(user.permissions, ["oportunidadespv", "view"]) &&
      !hasPerm(user.permissions, ["leadspv", "view"]) &&
      !hasPerm(user.permissions, ["oportunidadespv", "viewall"])
    ) {
      return NextResponse.json({ message: "No tienes permiso para ver proximos mantenimientos." }, { status: 403 });
    }

    const [vehicles] = await pool.query(
      `SELECT
          v.id, v.cliente_id, v.placas, v.vin, v.anio, v.kilometraje, v.fecha_ultima_visita, v.color,
          CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente_nombre,
          c.nombre AS cliente_nombre_raw, c.apellido AS cliente_apellido, c.email AS cliente_email,
          c.celular AS cliente_celular, c.tipo_identificacion, c.identificacion_fiscal,
          c.fecha_nacimiento, c.ocupacion, c.domicilio, c.nombre_comercial,
          ma.name AS marca_nombre, mo.name AS modelo_nombre,
          av.kilometraje AS algoritmo_km, av.meses AS algoritmo_meses, av.anios AS algoritmo_anios,
          opp.id AS oportunidad_abierta_id, opp.oportunidad_id AS oportunidad_codigo,
          od.fecha_agenda, od.hora_agenda,
          cierre.detalle AS cierre_detalle, cierre_config.detalle AS cierre_motivo
       FROM administracion_vehiculos v
       INNER JOIN administracion_clientes c ON c.id=v.cliente_id
       LEFT JOIN administracion_marcas ma ON ma.id=v.marca_id
       LEFT JOIN administracion_modelos mo ON mo.id=v.modelo_id
       LEFT JOIN administracion_algoritmo_visita av ON av.marca_id=v.marca_id AND av.modelo_id=v.modelo_id
       LEFT JOIN (
         SELECT *
         FROM (
           SELECT o.*, ROW_NUMBER() OVER (PARTITION BY o.vehiculo_id ORDER BY o.created_at DESC, o.id DESC) AS rn
           FROM posventa_oportunidades o
         ) latest_opp
         WHERE latest_opp.rn=1
       ) opp ON opp.vehiculo_id=v.id
       LEFT JOIN (
         SELECT d.*
         FROM posventa_oportunidades_detalles d
         INNER JOIN (
           SELECT oportunidad_padre_id, MAX(id) AS max_id
           FROM posventa_oportunidades_detalles
           GROUP BY oportunidad_padre_id
         ) x ON x.max_id=d.id
       ) od ON od.oportunidad_padre_id=opp.id
       LEFT JOIN (
         SELECT *
         FROM (
           SELECT pc.*, ROW_NUMBER() OVER (PARTITION BY pc.oportunidad_id ORDER BY pc.created_at DESC, pc.id DESC) AS rn
           FROM posventa_oportunidades_cierres pc
         ) latest_close
         WHERE latest_close.rn=1
       ) cierre ON cierre.oportunidad_id=opp.id
       LEFT JOIN configuracion_posventas_cierres_detalle cierre_config ON cierre_config.id=cierre.cierre_detalle_id
       WHERE v.deleted_at IS NULL
       ORDER BY c.nombre ASC, v.id DESC`
    );

    const [frequencies] = await pool.query(
      `SELECT id,dias FROM configuracion_prospeccion_frecuencia ORDER BY dias DESC`
    );

    // Historial (MySQL 8+): últimos 30 por cliente
    const vehicleIds = Array.from(new Set(vehicles.map((v) => v.id).filter(Boolean)));
    const historyByVehicleId = new Map();
    const opportunitiesByVehicleId = new Map();

    if (vehicleIds.length) {
      const placeholders = vehicleIds.map(() => "?").join(",");
      const [historyRows] = await pool.query(
        `
        SELECT vehiculo_id, id, fecha_visita_taller, kilometraje_taller, created_by, created_at, updated_at
        FROM (
          SELECT
            h.vehiculo_id,
            h.id,
            h.fecha_visita_taller,
            h.kilometraje_taller,
            h.created_by,
            h.created_at,
            h.updated_at,
            ROW_NUMBER() OVER (PARTITION BY h.vehiculo_id ORDER BY h.fecha_visita_taller DESC, h.id DESC) AS rn
          FROM administracion_vehiculos_historial_mantenimientos h
          WHERE h.vehiculo_id IN (${placeholders})
        ) x
        WHERE x.rn <= 30
        ORDER BY x.vehiculo_id ASC, x.fecha_visita_taller DESC, x.id DESC
        `,
        vehicleIds
      );

      for (const r of historyRows) {
        if (!historyByVehicleId.has(r.vehiculo_id)) historyByVehicleId.set(r.vehiculo_id, []);
        historyByVehicleId.get(r.vehiculo_id).push(r);
      }

      const [opportunityRows] = await pool.query(
        `SELECT
           o.id,
           o.vehiculo_id,
           o.oportunidad_id,
           o.created_at,
           e.nombre AS etapa_nombre,
           e.color AS etapa_color,
           d.fecha_agenda,
           d.hora_agenda,
           cierre.detalle AS cierre_detalle,
           cierre_config.detalle AS cierre_motivo
         FROM posventa_oportunidades o
         LEFT JOIN configuracion_posventa_etapasconversion e ON e.id=o.etapasconversionpv_id
         LEFT JOIN (
           SELECT d.*
           FROM posventa_oportunidades_detalles d
           INNER JOIN (
             SELECT oportunidad_padre_id, MAX(id) AS max_id
             FROM posventa_oportunidades_detalles
             GROUP BY oportunidad_padre_id
           ) x ON x.max_id=d.id
         ) d ON d.oportunidad_padre_id=o.id
         LEFT JOIN (
           SELECT *
           FROM (
             SELECT pc.*, ROW_NUMBER() OVER (PARTITION BY pc.oportunidad_id ORDER BY pc.created_at DESC, pc.id DESC) AS rn
             FROM posventa_oportunidades_cierres pc
           ) latest_close
           WHERE latest_close.rn=1
         ) cierre ON cierre.oportunidad_id=o.id
         LEFT JOIN configuracion_posventas_cierres_detalle cierre_config ON cierre_config.id=cierre.cierre_detalle_id
         WHERE o.vehiculo_id IN (${placeholders})
           AND o.oportunidad_id LIKE 'OPPV-%'
         ORDER BY o.vehiculo_id ASC, o.created_at DESC, o.id DESC`,
        vehicleIds
      );

      for (const opportunity of opportunityRows) {
        if (!opportunitiesByVehicleId.has(opportunity.vehiculo_id)) {
          opportunitiesByVehicleId.set(opportunity.vehiculo_id, []);
        }
        opportunitiesByVehicleId.get(opportunity.vehiculo_id).push({
          id: opportunity.id,
          code: opportunity.oportunidad_id || "",
          etapaNombre: opportunity.etapa_nombre || "",
          etapaColor: opportunity.etapa_color || "#2563eb",
          fechaAgendada: opportunity.fecha_agenda
            ? `${datePart(opportunity.fecha_agenda)} ${String(opportunity.hora_agenda || "").slice(0, 5)}`
            : "",
          estado: opportunity.cierre_detalle || opportunity.cierre_motivo ? "Cerrado" : opportunity.etapa_nombre || "",
          cierreMotivo: opportunity.cierre_motivo || opportunity.cierre_detalle || "",
          createdAt: opportunity.created_at,
        });
      }
    }

    const today = new Date();
    const unique = new Map();

    for (const row of vehicles) {
      if (unique.has(row.id)) continue;

      const history = historyByVehicleId.get(row.id) || [];
      const hasHistory = history.length > 0;

      // ✅ si NO hay historial: no calcular nada
      // (aunque exista algoritmo)
      const ranges = parseRanges(row.algoritmo_anios);
      const yearOk = yearMatches(Number(row.anio), ranges);

      const algoritmoMeses = row.algoritmo_meses != null ? Number(row.algoritmo_meses) : 0;
      const algoritmoKm = row.algoritmo_km != null ? Number(row.algoritmo_km) : 0;

      const hasAlgorithm = Boolean(yearOk && (algoritmoMeses > 0 || algoritmoKm > 0));

      let nextByTime = null;
      let nextByKm = null;

      if (hasHistory && hasAlgorithm) {
        const { t1, t2 } = pickT1T2DistinctDay(history);

        const v1 = t1?.fecha_visita_taller ? new Date(t1.fecha_visita_taller) : null; // T1
        const v2 = t2?.fecha_visita_taller ? new Date(t2.fecha_visita_taller) : null; // T2 (puede no existir)
        const k1 = t1?.kilometraje_taller != null ? Number(t1.kilometraje_taller) : null;
        const k2 = t2?.kilometraje_taller != null ? Number(t2.kilometraje_taller) : null;

        // ✅ Si hay 2 registros (T2 existe): tiempo usa T2
        // ✅ Si solo hay 1 registro: tiempo usa T1 (solo tiempo)
        const baseForTime = v2 || v1;

        nextByTime = algoritmoMeses > 0 && baseForTime ? addMonths(baseForTime, algoritmoMeses) : null;

        // ✅ KM SOLO si existe T2 (dos registros con fecha distinta)
        if (algoritmoKm > 0 && v1 && v2 && k1 != null && k2 != null) {
          const diasEntre = daysBetween(v2, v1); // (v1 - v2)
          const deltaKm = k1 - k2;

          if (diasEntre > 0 && deltaKm > 0) {
            const kmDiario = deltaKm / diasEntre;
            if (kmDiario > 0) {
              const diasFaltantes = algoritmoKm / kmDiario;
              nextByKm = addDaysTrunc(v2, diasFaltantes); // T2 + diasFaltantes(trunc)
            }
          }
        }
      }

      const picked = pickProximo(today, [
        { date: nextByTime, calculo: "Tiempo" },
        { date: nextByKm, calculo: "KM" },
      ]);

      const proximo = row.fecha_ultima_visita ? new Date(row.fecha_ultima_visita) : null;
      const calculo = "";

      const daysRemaining = proximo ? daysBetween(today, proximo) : null;

      const matchedFrequency =
        daysRemaining === null ? null : frequencies.find((item) => daysRemaining <= Number(item.dias));

      const reminderDate = proximo && matchedFrequency ? new Date(proximo) : null;
      if (reminderDate) reminderDate.setDate(reminderDate.getDate() - Number(matchedFrequency.dias));

      // ✅ estados según tu regla
      const isClosed = Boolean(row.cierre_detalle || row.cierre_motivo);
      const estadoRecordatorio = isClosed
        ? "Cerrado"
        : !hasHistory
        ? "Sin historial"
        : !hasAlgorithm
          ? "Sin algoritmo"
          : !proximo
            ? "Sin historial"
            : daysRemaining < 0
              ? "Vencido"
              : matchedFrequency
                ? "Pendiente contacto"
                : "Programado";

      unique.set(row.id, {
        id: row.id,
        clienteId: row.cliente_id,
        clienteNombre: row.cliente_nombre.trim(),
        cliente: {
          id: row.cliente_id,
          nombre: row.cliente_nombre_raw || "",
          apellido: row.cliente_apellido || "",
          nombreCompleto: row.cliente_nombre.trim(),
          email: row.cliente_email || "",
          celular: row.cliente_celular || "",
          tipoIdentificacion: row.tipo_identificacion || "",
          identificacionFiscal: row.identificacion_fiscal || "",
          fechaNacimiento: datePart(row.fecha_nacimiento),
          ocupacion: row.ocupacion || "",
          domicilio: row.domicilio || "",
          nombreComercial: row.nombre_comercial || "",
        },
        vehiculo: [row.modelo_nombre, row.marca_nombre].filter(Boolean).join(" - ") || row.placas || row.vin || "-",
        marca: row.marca_nombre || "",
        modelo: row.modelo_nombre || "",
        version: "",
        placa: row.placas || "",
        vin: row.vin || "",
        anio: row.anio,
        color: row.color || "",
        kilometraje: row.kilometraje,
        historialMantenimientos: history.map((item) => ({
          id: item.id,
          fechaVisitaTaller: datePart(item.fecha_visita_taller),
          kilometrajeTaller: item.kilometraje_taller,
          createdBy: item.created_by,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),

        fechaUltimaVisita: datePart(row.fecha_ultima_visita),

        proximoMantenimiento: proximo ? datePart(proximo) : "",
        calculo, // "Tiempo" o "KM"
        diasRestantes: daysRemaining,
        recordatorio: reminderDate ? datePart(reminderDate) : "",
        estadoRecordatorio,
        cierreMotivo: row.cierre_motivo || row.cierre_detalle || "",

        oportunidadId: row.oportunidad_abierta_id,
        oportunidadCodigo: row.oportunidad_codigo || "",
        fechaAgendada: row.fecha_agenda ? `${datePart(row.fecha_agenda)} ${String(row.hora_agenda || "").slice(0, 5)}` : "",
        oportunidades: opportunitiesByVehicleId.get(row.id) || [],
      });
    }

    const [origins] = await pool.query(
      `SELECT id,name FROM configuracion_origenes_citas WHERE is_active=1 ORDER BY name ASC`
    );
    const [suborigins] = await pool.query(
      `SELECT id,origen_id,name FROM configuracion_suborigenes_citas WHERE is_active=1 ORDER BY name ASC`
    );
    const [users] = await pool.query(
      `SELECT id,fullname FROM administracion_usuarios WHERE is_active=1 ORDER BY fullname ASC`
    );
    const [stages] = await pool.query(
      `SELECT id,nombre,color,sort_order FROM configuracion_posventa_etapasconversion WHERE is_active=1 ORDER BY COALESCE(sort_order,id) ASC`
    );
    const [closings] = await pool.query(
      `SELECT id, detalle FROM configuracion_posventas_cierres_detalle ORDER BY id DESC`
    );

    return NextResponse.json({
      currentUser: {
        id: user.id,
        fullname: user.fullname,
        canViewAll: Boolean(
          hasPerm(user.permissions, ["oportunidadespv", "viewall"]) || hasPerm(user.permissions, ["leadspv", "viewall"])
        ),
      },
      vehicles: Array.from(unique.values()),
      options: {
        origins: origins.map((row) => ({ id: row.id, name: row.name })),
        suborigins: suborigins.map((row) => ({ id: row.id, origenId: row.origen_id, name: row.name })),
        users: users.map((row) => ({ id: row.id, fullname: row.fullname })),
        stages: stages.map((row) => ({
          id: row.id,
          nombre: row.nombre,
          color: row.color || "#2563eb",
          sortOrder: row.sort_order || row.id,
        })),
        closings: closings.map((row) => ({ id: row.id, detalle: row.detalle })),
      },
    });
  } catch (error) {
    console.error("Error loading maintenance due:", error);
    return NextResponse.json({ message: "No se pudo cargar proximos mantenimientos." }, { status: 500 });
  }
}
