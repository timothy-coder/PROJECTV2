import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
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
    hasPerm(permissions, ["oportunidadespv", "view"]) ||
    hasPerm(permissions, ["oportunidadespv", "viewall"]) ||
      hasPerm(permissions, ["leadspv", "view"]) ||
      hasPerm(permissions, ["leadspv", "viewall"]) ||
      hasPerm(permissions, ["clientes", "view"]) ||
      hasPerm(permissions, ["clientes", "viewall"])
  );
}

export async function GET(request) {
  try {
    if (!hasPowerBiToken(request)) {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ message: "No autorizado." }, { status: 401 });
      }
      if (!canReadPowerBiPosventaVehicles(user)) {
        return NextResponse.json({ message: "No tienes permiso para consultar vehiculos sin oportunidad de PostVenta." }, { status: 403 });
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
          mh.id AS ultimo_mantenimiento_id,
          mh.fecha_visita_taller AS ultimo_mantenimiento_fecha,
          mh.kilometraje_taller AS ultimo_mantenimiento_kilometraje
       ${baseFrom}
       ORDER BY v.created_at DESC, v.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    if (withMeta) {
      const currentPage = page > 0 ? page : Math.floor(offset / limit) + 1;
      const total = Number(countRow?.total || 0);
      return NextResponse.json({
        rows,
        meta: {
          total,
          page: currentPage,
          limit,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error loading PostVenta vehicles without opportunity:", error);
    return NextResponse.json({ message: "No se pudo cargar vehiculos sin oportunidad de PostVenta." }, { status: 500 });
  }
}
