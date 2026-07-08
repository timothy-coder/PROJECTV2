import { NextResponse } from "next/server";

import { POWERBI_POSVENTA_QUERY } from "@/app/api/powerbi/posventa/data/route";
import { pool } from "@/lib/db";
import { preventiveMaintenanceHistoryExists } from "@/lib/maintenanceNextVisit";
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

function canReadPowerBiPosventaConsolidated(user) {
  const permissions = user?.permissions || {};
  return Boolean(
    hasPerm(permissions, ["home", "posventaview"]) ||
      hasPerm(permissions, ["home", "posventaviewall"]) ||
      hasPerm(permissions, ["home", "posventa"]) ||
      hasPerm(permissions, ["home", "viewall"])
  );
}

function canViewAllDashboard(user) {
  const permissions = user?.permissions || {};
  return Boolean(hasPerm(permissions, ["home", "posventaviewall"]) || hasPerm(permissions, ["home", "viewall"]));
}

function buildVehiclesWithoutOpportunityQuery({ query, brand, model, scopeUserId }) {
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

  if (scopeUserId) {
    where.push("c.created_by = ?");
    params.push(scopeUserId);
  }

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
        WHERE ${preventiveMaintenanceHistoryExists("administracion_vehiculos_historial_mantenimientos")}
        GROUP BY vehiculo_id
      ) latest_history ON latest_history.max_id = h.id
    ) mh ON mh.vehiculo_id = v.id
    WHERE ${where.join(" AND ")}`;

  return { baseFrom, params };
}

async function loadVehiclesWithoutOpportunity({ limit, offset, page, withMeta, query, brand, model, scopeUserId }) {
  const { baseFrom, params } = buildVehiclesWithoutOpportunityQuery({ query, brand, model, scopeUserId });
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

  const total = Number(countRow?.total || 0);
  return {
    rows,
    meta: withMeta
      ? {
          total,
          page,
          limit,
          pages: Math.max(1, Math.ceil(total / limit)),
        }
      : { total: rows.length, page, limit, pages: 1 },
  };
}

function normalizeOpportunityRow(row) {
  return {
    tipo_registro: "oportunidad_posventa",
    tiene_oportunidad: true,
    ...row,
  };
}

function normalizeVehicleWithoutOpportunityRow(row) {
  return {
    tipo_registro: "vehiculo_sin_oportunidad",
    tiene_oportunidad: false,
    fechacreacionoportunidadpv: null,
    fechaactualizacionoportunidadpv: null,
    codigooportunidadpv: null,
    oportunidadpv_db_id: null,
    detalleoportunidadpv: null,
    fecha_agenda: null,
    hora_agenda: null,
    cliente_id: row.cliente_id,
    nombreapellidocliente: row.cliente_nombre_completo,
    correocliente: row.cliente_email,
    celularcliente: row.cliente_celular,
    tipoidentificacioncliente: row.cliente_tipo_identificacion,
    numeroidentificacioncliente: row.cliente_numero_documento,
    fechanacimientocliente: null,
    ocupacioncliente: null,
    domiciliocliente: null,
    fechacreacioncliente: row.cliente_created_at,
    departamento: row.cliente_departamento,
    provincia: row.cliente_provincia,
    distrito: row.cliente_distrito,
    vehiculo_id: row.vehiculo_id,
    vehiculo_placa: row.vehiculo_placa,
    vehiculo_vin: row.vehiculo_vin,
    vehiculo_anio: row.vehiculo_anio,
    vehiculo_color: row.vehiculo_color,
    vehiculo_kilometraje: row.vehiculo_kilometraje,
    vehiculo_marca: row.marca_nombre,
    vehiculo_modelo: row.modelo_nombre,
    vehiculo_fecha_ultima_visita: row.vehiculo_fecha_ultima_visita,
    vehiculo_created_at: row.vehiculo_created_at,
    ultimo_mantenimiento_id: row.ultimo_mantenimiento_id,
    ultimo_mantenimiento_fecha: row.ultimo_mantenimiento_fecha,
    ultimo_mantenimiento_kilometraje: row.ultimo_mantenimiento_kilometraje,
    origen_nombre: null,
    suborigen_nombre: null,
    etapa_nombre: "Sin oportunidad",
    etapa_valor: null,
    etapa_color: null,
    usuario_creador_nombre: null,
    usuario_creador_username: null,
    usuario_asignado_nombre: null,
    usuario_asignado_username: null,
    ultima_actividad_detalle: null,
    ultima_actividad_created_at: null,
    cita_id: null,
    cita_start_at: null,
    cita_end_at: null,
    cita_estado: null,
    cita_tipo_servicio: null,
    cita_nota_cliente: null,
    cita_nota_interna: null,
    cita_created_at: null,
    cita_centro: null,
    cita_taller: null,
    cita_asesor_nombre: null,
    cita_origen_nombre: null,
    cierre_detalle: null,
    cierre_created_at: null,
    cierre_creado_por: null,
    cotizacion_id: null,
    cotizacion_tipo: null,
    cotizacion_descripcion: null,
    cotizacion_estado: null,
    cotizacion_subtotal_productos: null,
    cotizacion_subtotal_mano_obra: null,
    cotizacion_subtotal_extras: null,
    cotizacion_descuento_porcentaje: null,
    cotizacion_descuento_monto: null,
    cotizacion_monto_total: null,
    cotizacion_horas_trabajo: null,
    cotizacion_tarifa_hora: null,
    cotizacion_incluir_igv: null,
    cotizacion_impuesto_porcentaje: null,
    cotizacion_public_token: null,
    cotizacion_created_at: null,
    cotizacion_updated_at: null,
    cotizacion_usuario_nombre: null,
    cotizacion_moneda_codigo: null,
    cotizacion_moneda_nombre: null,
    cotizacion_moneda_simbolo: null,
    cotizacion_impuesto_nombre: null,
    cotizacion_impuesto_porcentaje_config: null,
    cotizacion_centro: null,
    cotizacion_taller: null,
    cotizacion_mostrador: null,
    cotizacion_tarifa_nombre: null,
    cotizacion_producto_id: null,
    cotizacion_producto_cantidad: null,
    cotizacion_producto_precio_unitario: null,
    cotizacion_producto_subtotal: null,
    cotizacion_producto_descuento_porcentaje: null,
    producto_numero_parte: null,
    producto_descripcion: null,
    producto_stock_total: null,
    producto_stock_disponible: null,
    producto_precio_compra: null,
    producto_precio_venta: null,
    cotizacion_extra_id: null,
    cotizacion_extra_descripcion: null,
    cotizacion_extra_monto: null,
    cotizacion_extra_descuento_tipo: null,
    cotizacion_extra_descuento_valor: null,
    cotizacion_vista_id: null,
    cotizacion_vista_ip: null,
    cotizacion_vista_user_agent: null,
    cotizacion_vista_fecha: null,
  };
}

export async function GET(request) {
  try {
    let scopeUserId = null;
    if (!hasPowerBiToken(request)) {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ message: "No autorizado." }, { status: 401 });
      }
      if (!canReadPowerBiPosventaConsolidated(user)) {
        return NextResponse.json({ message: "No tienes permiso para consultar la data consolidada de PostVenta." }, { status: 403 });
      }
      if (!canViewAllDashboard(user)) {
        scopeUserId = user.id;
      }
    }

    const url = new URL(request.url);
    const withMeta = url.searchParams.get("withMeta") === "1";

    const oportunidadesLimit = clampNumber(url.searchParams.get("oportunidadesLimit") || url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const oportunidadesOffset = clampOffset(url.searchParams.get("oportunidadesOffset") || url.searchParams.get("offset"));

    const vehiculosLimit = clampNumber(url.searchParams.get("vehiculosLimit") || url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const vehiculosPage = clampNumber(url.searchParams.get("vehiculosPage") || url.searchParams.get("page"), 1, 999999);
    const vehiculosOffset = url.searchParams.get("vehiculosPage") || url.searchParams.get("page")
      ? (vehiculosPage - 1) * vehiculosLimit
      : clampOffset(url.searchParams.get("vehiculosOffset") || url.searchParams.get("offset"));

    const vehicleQuery = String(url.searchParams.get("q") || "").trim();
    const vehicleBrand = String(url.searchParams.get("brand") || "").trim().toLowerCase();
    const vehicleModel = String(url.searchParams.get("model") || "").trim().toLowerCase();

    const scopeSql = scopeUserId ? "WHERE (o.created_by = ? OR o.asignado_a = ?)" : "";
    const opportunitiesQuery = POWERBI_POSVENTA_QUERY.replace("ORDER BY o.created_at DESC, o.id DESC", `${scopeSql} ORDER BY o.created_at DESC, o.id DESC`);
    const [opportunities] = await pool.query(
      `${opportunitiesQuery} LIMIT ${oportunidadesLimit} OFFSET ${oportunidadesOffset}`,
      scopeUserId ? [scopeUserId, scopeUserId] : []
    );
    const vehicles = await loadVehiclesWithoutOpportunity({
      limit: vehiculosLimit,
      offset: vehiculosOffset,
      page: vehiculosPage,
      withMeta,
      query: vehicleQuery,
      brand: vehicleBrand,
      model: vehicleModel,
      scopeUserId,
    });

    const data = [
      ...opportunities.map(normalizeOpportunityRow),
      ...vehicles.rows.map(normalizeVehicleWithoutOpportunityRow),
    ];

    if (withMeta) {
      return NextResponse.json({
        rows: data,
        meta: {
          total: data.length,
          oportunidades: {
            total: opportunities.length,
            limit: oportunidadesLimit,
            offset: oportunidadesOffset,
          },
          vehiculosSinOportunidad: vehicles.meta,
        },
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error loading consolidated PostVenta Power BI data:", error);
    return NextResponse.json({ message: "No se pudo cargar la data consolidada de PostVenta." }, { status: 500 });
  }
}
