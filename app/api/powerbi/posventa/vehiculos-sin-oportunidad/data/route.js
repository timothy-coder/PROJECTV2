import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { datePart, daysBetween } from "@/lib/maintenanceNextVisit";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 100000;
const DEFAULT_LIMIT = 10000;

function clampNumber(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function clampOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
}

function addDaysTrunc(date, days) {
  const n = Number(days);
  if (!Number.isFinite(n)) return null;
  const next = new Date(date);
  next.setDate(next.getDate() + Math.floor(n));
  return next;
}

function parseRanges(value) {
  try {
    if (!value) return [];
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const text = String(value || "").trim();
    if (!text) return [];
    return text.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function yearMatches(year, ranges) {
  if (!year || !ranges.length) return true;
  return ranges.some((range) => {
    const [start, end] = String(range).split("-").map((item) => Number(String(item).trim()));
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return year >= start && year <= end;
  });
}

function pickT1T2DistinctDay(rows) {
  if (!Array.isArray(rows) || !rows.length) return { t1: null, t2: null };
  const t1 = rows[0];
  const day1 = datePart(t1.fecha_visita_taller);
  const t2 = rows.slice(1).find((item) => datePart(item.fecha_visita_taller) !== day1) || null;
  return { t1, t2 };
}

function pickProximo(today, candidates) {
  const valid = candidates.filter((item) => item?.date instanceof Date && !Number.isNaN(item.date.valueOf()));
  if (!valid.length) return { date: null, calculo: "" };
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  valid.sort((a, b) => {
    const aDay = new Date(a.date.getFullYear(), a.date.getMonth(), a.date.getDate()).getTime();
    const bDay = new Date(b.date.getFullYear(), b.date.getMonth(), b.date.getDate()).getTime();
    const distance = Math.abs(aDay - todayDay) - Math.abs(bDay - todayDay);
    if (distance !== 0) return distance;
    return aDay - bDay;
  });
  return { date: valid[0].date, calculo: valid[0].calculo };
}

function computeNextMaintenance(row, history) {
  const hasHistory = history.length > 0;
  const ranges = parseRanges(row.algoritmo_anios);
  const yearOk = yearMatches(Number(row.vehiculo_anio), ranges);
  const algoritmoMeses = row.algoritmo_meses != null ? Number(row.algoritmo_meses) : 0;
  const algoritmoKm = row.algoritmo_km != null ? Number(row.algoritmo_km) : 0;
  const hasAlgorithm = Boolean(yearOk && (algoritmoMeses > 0 || algoritmoKm > 0));
  let nextByTime = null;
  let nextByKm = null;

  if (hasHistory && hasAlgorithm) {
    const { t1, t2 } = pickT1T2DistinctDay(history);
    const v1 = t1?.fecha_visita_taller ? new Date(t1.fecha_visita_taller) : null;
    const v2 = t2?.fecha_visita_taller ? new Date(t2.fecha_visita_taller) : null;
    const k1 = t1?.kilometraje_taller != null ? Number(t1.kilometraje_taller) : null;
    const k2 = t2?.kilometraje_taller != null ? Number(t2.kilometraje_taller) : null;
    const baseForTime = v2 || v1;

    nextByTime = algoritmoMeses > 0 && baseForTime ? addMonths(baseForTime, algoritmoMeses) : null;

    if (algoritmoKm > 0 && v1 && v2 && k1 != null && k2 != null) {
      const diasEntre = daysBetween(v2, v1);
      const deltaKm = k1 - k2;
      if (diasEntre > 0 && deltaKm > 0) {
        const kmDiario = deltaKm / diasEntre;
        if (kmDiario > 0) nextByKm = addDaysTrunc(v2, algoritmoKm / kmDiario);
      }
    }
  }

  const picked = pickProximo(new Date(), [
    { date: nextByTime, calculo: "Tiempo" },
    { date: nextByKm, calculo: "KM" },
  ]);
  const daysRemaining = picked.date ? daysBetween(new Date(), picked.date) : null;

  return {
    proximo_mantenimiento: picked.date ? datePart(picked.date) : "",
    tipo_prediccion: picked.calculo || (!hasHistory ? "Sin historial" : !hasAlgorithm ? "Sin algoritmo" : ""),
    dias_restantes: daysRemaining,
  };
}

function hasPowerBiToken(request) {
  const configuredToken = process.env.POWERBI_API_TOKEN;
  if (!configuredToken) return false;

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const headerToken = request.headers.get("x-powerbi-token");
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const receivedToken = queryToken || headerToken || bearerToken;

  return receivedToken === configuredToken;
}

function canReadPowerBiPosventaVehicles(user) {
  const permissions = user?.permissions || {};
  return Boolean(
    hasPerm(permissions, ["proximosmantenimientos", "view"]) ||
      hasPerm(permissions, ["proximosmantenimientos", "viewall"]) ||
      hasPerm(permissions, ["home", "posventaview"]) ||
      hasPerm(permissions, ["home", "posventaviewall"]) ||
      hasPerm(permissions, ["home", "posventa"]) ||
      hasPerm(permissions, ["home", "viewall"])
  );
}

function canViewAllDashboard(user) {
  const permissions = user?.permissions || {};
  return Boolean(
    hasPerm(permissions, ["proximosmantenimientos", "view"]) ||
      hasPerm(permissions, ["proximosmantenimientos", "viewall"]) ||
      hasPerm(permissions, ["home", "posventaviewall"]) ||
      hasPerm(permissions, ["home", "viewall"])
  );
}

export async function GET(request) {
  try {
    let scopeUserId = null;
    if (!hasPowerBiToken(request)) {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ message: "No autorizado." }, { status: 401 });
      }
      if (!canReadPowerBiPosventaVehicles(user)) {
        return NextResponse.json({ message: "No tienes permiso para consultar vehiculos sin oportunidad de PostVenta." }, { status: 403 });
      }
      if (!canViewAllDashboard(user)) {
        scopeUserId = user.id;
      }
    }

    const url = new URL(request.url);
    const limit = clampNumber(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const page = clampNumber(url.searchParams.get("page"), 0, 999999);
    const offset = page > 0 ? (page - 1) * limit : clampOffset(url.searchParams.get("offset"));
    const withMeta = url.searchParams.get("withMeta") === "1";
    const query = String(url.searchParams.get("q") || "").trim();
    const brand = String(url.searchParams.get("brand") || "").trim().toLowerCase();
    const model = String(url.searchParams.get("model") || "").trim().toLowerCase();

    const where = [
      "v.deleted_at IS NULL",
      "NOT EXISTS (SELECT 1 FROM posventa_oportunidades o WHERE o.vehiculo_id = v.id)",
    ];
    const params = [];

    if (scopeUserId) {
      where.push("c.created_by = ?");
      params.push(scopeUserId);
    }

    if (query) {
      const like = `%${query}%`;
      where.push(
        `(CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) LIKE ?
          OR c.identificacion_fiscal LIKE ?
          OR c.celular LIKE ?
          OR c.email LIKE ?
          OR v.placas LIKE ?
          OR v.vin LIKE ?
          OR ma.name LIKE ?
          OR mo.name LIKE ?)`
      );
      params.push(like, like, like, like, like, like, like, like);
    }

    if (brand) {
      where.push("LOWER(TRIM(ma.name)) = ?");
      params.push(brand);
    }

    if (model) {
      where.push("LOWER(TRIM(mo.name)) = ?");
      params.push(model);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const baseFrom = `
      FROM administracion_vehiculos v
      INNER JOIN administracion_clientes c ON c.id = v.cliente_id
      LEFT JOIN administracion_marcas ma ON ma.id = v.marca_id
      LEFT JOIN administracion_modelos mo ON mo.id = v.modelo_id
      LEFT JOIN administracion_algoritmo_visita av ON av.marca_id = v.marca_id AND av.modelo_id = v.modelo_id
      LEFT JOIN departamentos dep ON dep.id = c.departamento_id
      LEFT JOIN provincias prov ON prov.id = c.provincia_id
      LEFT JOIN distritos dist ON dist.id = c.distrito_id
      LEFT JOIN (
        SELECT h.*
        FROM administracion_vehiculos_historial_mantenimientos h
        INNER JOIN (
          SELECT vehiculo_id, MAX(id) AS max_id
          FROM administracion_vehiculos_historial_mantenimientos
          GROUP BY vehiculo_id
        ) latest_history ON latest_history.max_id = h.id
      ) mh ON mh.vehiculo_id = v.id
      ${whereSql}`;

    const [[countRow]] = withMeta
      ? await pool.query(`SELECT COUNT(DISTINCT v.id) AS total ${baseFrom}`, params)
      : [[{ total: 0 }]];

    const [rows] = await pool.query(
      `SELECT
          v.id AS vehiculo_id,
          v.cliente_id,
          v.placas AS vehiculo_placa,
          v.vin AS vehiculo_vin,
          v.anio AS vehiculo_anio,
          v.color AS vehiculo_color,
          v.kilometraje AS vehiculo_kilometraje,
          v.fecha_ultima_visita AS vehiculo_fecha_ultima_visita,
          v.created_at AS vehiculo_created_at,
          c.nombre AS cliente_nombre,
          c.apellido AS cliente_apellido,
          CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente_nombre_completo,
          c.email AS cliente_email,
          c.celular AS cliente_celular,
          c.tipo_identificacion AS cliente_tipo_identificacion,
          c.identificacion_fiscal AS cliente_numero_documento,
          c.nombre_comercial AS cliente_nombre_comercial,
          c.created_at AS cliente_created_at,
          dep.nombre AS cliente_departamento,
          prov.nombre AS cliente_provincia,
          dist.nombre AS cliente_distrito,
          ma.id AS marca_id,
          ma.name AS marca_nombre,
          mo.id AS modelo_id,
          mo.name AS modelo_nombre,
          av.kilometraje AS algoritmo_km,
          av.meses AS algoritmo_meses,
          av.anios AS algoritmo_anios,
          mh.id AS ultimo_mantenimiento_id,
          mh.fecha_visita_taller AS ultimo_mantenimiento_fecha,
          mh.kilometraje_taller AS ultimo_mantenimiento_kilometraje
       ${baseFrom}
       ORDER BY v.created_at DESC, v.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const vehicleIds = rows.map((row) => row.vehiculo_id).filter(Boolean);
    const historyByVehicleId = new Map();
    if (vehicleIds.length) {
      const placeholders = vehicleIds.map(() => "?").join(",");
      const [historyRows] = await pool.query(
        `SELECT vehiculo_id, id, fecha_visita_taller, kilometraje_taller
         FROM (
           SELECT h.vehiculo_id, h.id, h.fecha_visita_taller, h.kilometraje_taller,
                  ROW_NUMBER() OVER (PARTITION BY h.vehiculo_id ORDER BY h.fecha_visita_taller DESC, h.id DESC) AS rn
           FROM administracion_vehiculos_historial_mantenimientos h
           WHERE h.vehiculo_id IN (${placeholders})
         ) x
         WHERE x.rn <= 30
         ORDER BY x.vehiculo_id ASC, x.fecha_visita_taller DESC, x.id DESC`,
        vehicleIds
      );
      for (const history of historyRows) {
        if (!historyByVehicleId.has(history.vehiculo_id)) historyByVehicleId.set(history.vehiculo_id, []);
        historyByVehicleId.get(history.vehiculo_id).push(history);
      }
    }

    const enrichedRows = rows.map((row) => ({
      ...row,
      ...computeNextMaintenance(row, historyByVehicleId.get(row.vehiculo_id) || []),
    }));

    if (withMeta) {
      const [brands] = await pool.query(
        `SELECT DISTINCT ma.name
         FROM administracion_vehiculos v
         INNER JOIN administracion_clientes c ON c.id = v.cliente_id
         LEFT JOIN administracion_marcas ma ON ma.id = v.marca_id
         WHERE v.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM posventa_oportunidades o WHERE o.vehiculo_id = v.id)
           AND ma.name IS NOT NULL AND ma.name <> ''
         ORDER BY ma.name ASC`
      );
      const [models] = await pool.query(
        `SELECT DISTINCT mo.name, ma.name AS marca_name
         FROM administracion_vehiculos v
         INNER JOIN administracion_clientes c ON c.id = v.cliente_id
         LEFT JOIN administracion_marcas ma ON ma.id = v.marca_id
         LEFT JOIN administracion_modelos mo ON mo.id = v.modelo_id
         WHERE v.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM posventa_oportunidades o WHERE o.vehiculo_id = v.id)
           AND mo.name IS NOT NULL AND mo.name <> ''
         ORDER BY mo.name ASC`
      );
      const currentPage = page > 0 ? page : Math.floor(offset / limit) + 1;
      const total = Number(countRow?.total || 0);
      return NextResponse.json({
        rows: enrichedRows,
        meta: {
          total,
          page: currentPage,
          limit,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
        options: {
          brands: brands.map((item) => item.name),
          models: models.map((item) => ({ name: item.name, brand: item.marca_name || "" })),
        },
      });
    }

    return NextResponse.json(enrichedRows);
  } catch (error) {
    console.error("Error loading PostVenta vehicles without opportunity:", error);
    return NextResponse.json({ message: "No se pudo cargar vehiculos sin oportunidad de PostVenta." }, { status: 500 });
  }
}
