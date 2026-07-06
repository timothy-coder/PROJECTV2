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

function canReadPowerBiPosventaData(user) {
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

export const POWERBI_POSVENTA_QUERY = `
SELECT
  o.created_at AS fechacreacionoportunidadpv,
  o.updated_at AS fechaactualizacionoportunidadpv,
  o.oportunidad_id AS codigooportunidadpv,
  o.id AS oportunidadpv_db_id,
  o.detalle AS detalleoportunidadpv,
  d.fecha_agenda AS fecha_agenda,
  d.hora_agenda AS hora_agenda,
  c.id AS cliente_id,
  CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, '')) AS nombreapellidocliente,
  c.email AS correocliente,
  c.celular AS celularcliente,
  c.tipo_identificacion AS tipoidentificacioncliente,
  c.identificacion_fiscal AS numeroidentificacioncliente,
  c.fecha_nacimiento AS fechanacimientocliente,
  c.ocupacion AS ocupacioncliente,
  c.domicilio AS domiciliocliente,
  c.created_at AS fechacreacioncliente,
  dep.nombre AS departamento,
  prov.nombre AS provincia,
  dist.nombre AS distrito,
  veh.id AS vehiculo_id,
  veh.placas AS vehiculo_placa,
  veh.vin AS vehiculo_vin,
  veh.anio AS vehiculo_anio,
  veh.color AS vehiculo_color,
  veh.kilometraje AS vehiculo_kilometraje,
  marca.name AS vehiculo_marca,
  modelo.name AS vehiculo_modelo,
  origen.name AS origen_nombre,
  suborigen.name AS suborigen_nombre,
  etapa.nombre AS etapa_nombre,
  etapa.descripcion AS etapa_valor,
  etapa.color AS etapa_color,
  creador.fullname AS usuario_creador_nombre,
  creador.username AS usuario_creador_username,
  asignado.fullname AS usuario_asignado_nombre,
  asignado.username AS usuario_asignado_username,
  act.detalle AS ultima_actividad_detalle,
  act.created_at AS ultima_actividad_created_at,
  cita.id AS cita_id,
  cita.start_at AS cita_start_at,
  cita.end_at AS cita_end_at,
  cita.estado AS cita_estado,
  cita.tipo_servicio AS cita_tipo_servicio,
  cita.nota_cliente AS cita_nota_cliente,
  cita.nota_interna AS cita_nota_interna,
  cita.created_at AS cita_created_at,
  centro.nombre AS cita_centro,
  taller.nombre AS cita_taller,
  cita_asesor.fullname AS cita_asesor_nombre,
  cita_origen.name AS cita_origen_nombre,
  cierre.detalle AS cierre_detalle,
  cierre_config.detalle AS cierre_motivo_configurado,
  cierre.created_at AS cierre_created_at,
  cierre_creador.fullname AS cierre_creado_por,
  cot.id AS cotizacion_id,
  cot.tipo AS cotizacion_tipo,
  cot.descripcion AS cotizacion_descripcion,
  cot.estado AS cotizacion_estado,
  cot.subtotal_productos AS cotizacion_subtotal_productos,
  cot.subtotal_mano_obra AS cotizacion_subtotal_mano_obra,
  cot.subtotal_extras AS cotizacion_subtotal_extras,
  cot.descuento_porcentaje AS cotizacion_descuento_porcentaje,
  cot.descuento_monto AS cotizacion_descuento_monto,
  cot.monto_total AS cotizacion_monto_total,
  cot.horas_trabajo AS cotizacion_horas_trabajo,
  cot.tarifa_hora AS cotizacion_tarifa_hora,
  cot.incluir_igv AS cotizacion_incluir_igv,
  cot.impuesto_porcentaje AS cotizacion_impuesto_porcentaje,
  cot.public_token AS cotizacion_public_token,
  cot.created_at AS cotizacion_created_at,
  cot.updated_at AS cotizacion_updated_at,
  cot_usuario.fullname AS cotizacion_usuario_nombre,
  cot_moneda.codigo AS cotizacion_moneda_codigo,
  cot_moneda.nombre AS cotizacion_moneda_nombre,
  cot_moneda.simbolo AS cotizacion_moneda_simbolo,
  cot_impuesto.nombre AS cotizacion_impuesto_nombre,
  cot_impuesto.porcentaje AS cotizacion_impuesto_porcentaje_config,
  cot_centro.nombre AS cotizacion_centro,
  cot_taller.nombre AS cotizacion_taller,
  cot_mostrador.nombre AS cotizacion_mostrador,
  tarifa.nombre AS cotizacion_tarifa_nombre,
  cp.id AS cotizacion_producto_id,
  cp.cantidad AS cotizacion_producto_cantidad,
  cp.precio_unitario AS cotizacion_producto_precio_unitario,
  cp.subtotal AS cotizacion_producto_subtotal,
  cp.descuento_porcentaje AS cotizacion_producto_descuento_porcentaje,
  prod.numero_parte AS producto_numero_parte,
  prod.descripcion AS producto_descripcion,
  prod.stock_total AS producto_stock_total,
  prod.stock_disponible AS producto_stock_disponible,
  prod.precio_compra AS producto_precio_compra,
  prod.precio_venta AS producto_precio_venta,
  extra.id AS cotizacion_extra_id,
  extra.descripcion AS cotizacion_extra_descripcion,
  extra.monto AS cotizacion_extra_monto,
  extra.descuento_tipo AS cotizacion_extra_descuento_tipo,
  extra.descuento_valor AS cotizacion_extra_descuento_valor,
  vista.id AS cotizacion_vista_id,
  vista.ip_address AS cotizacion_vista_ip,
  vista.user_agent AS cotizacion_vista_user_agent,
  vista.viewed_at AS cotizacion_vista_fecha
FROM posventa_oportunidades o
LEFT JOIN administracion_clientes c ON c.id = o.cliente_id
LEFT JOIN departamentos dep ON dep.id = c.departamento_id
LEFT JOIN provincias prov ON prov.id = c.provincia_id
LEFT JOIN distritos dist ON dist.id = c.distrito_id
LEFT JOIN administracion_vehiculos veh ON veh.id = o.vehiculo_id
LEFT JOIN administracion_marcas marca ON marca.id = veh.marca_id
LEFT JOIN administracion_modelos modelo ON modelo.id = veh.modelo_id
LEFT JOIN configuracion_origenes_citas origen ON origen.id = o.origen_id
LEFT JOIN configuracion_suborigenes_citas suborigen ON suborigen.id = o.suborigen_id
LEFT JOIN configuracion_posventa_etapasconversion etapa ON etapa.id = o.etapasconversionpv_id
LEFT JOIN administracion_usuarios creador ON creador.id = o.created_by
LEFT JOIN administracion_usuarios asignado ON asignado.id = o.asignado_a
LEFT JOIN (
  SELECT detail.*
  FROM posventa_oportunidades_detalles detail
  INNER JOIN (
    SELECT oportunidad_padre_id, MAX(id) AS max_id
    FROM posventa_oportunidades_detalles
    GROUP BY oportunidad_padre_id
  ) latest_detail ON latest_detail.max_id = detail.id
) d ON d.oportunidad_padre_id = o.id
LEFT JOIN (
  SELECT activity.*
  FROM posventa_oportunidades_actividades activity
  INNER JOIN (
    SELECT oportunidad_id, MAX(id) AS max_id
    FROM posventa_oportunidades_actividades
    GROUP BY oportunidad_id
  ) latest_activity ON latest_activity.max_id = activity.id
) act ON act.oportunidad_id = o.id
LEFT JOIN posventa_citas cita ON cita.oportunidadespv_id = o.id
LEFT JOIN configuracion_centros centro ON centro.id = cita.centro_id
LEFT JOIN configuracion_talleres taller ON taller.id = cita.taller_id
LEFT JOIN administracion_usuarios cita_asesor ON cita_asesor.id = cita.asesor_id
LEFT JOIN configuracion_origenes_citas cita_origen ON cita_origen.id = cita.origen_id
LEFT JOIN posventa_oportunidades_cierres cierre ON cierre.oportunidad_id = o.id
LEFT JOIN configuracion_posventas_cierres_detalle cierre_config ON cierre_config.id = cierre.cierre_detalle_id
LEFT JOIN administracion_usuarios cierre_creador ON cierre_creador.id = cierre.created_by
LEFT JOIN posventa_cotizaciones cot ON cot.cliente_id = o.cliente_id
LEFT JOIN administracion_usuarios cot_usuario ON cot_usuario.id = cot.usuario_id
LEFT JOIN configuracion_monedas cot_moneda ON cot_moneda.id = cot.moneda_id
LEFT JOIN configuracion_impuestos cot_impuesto ON cot_impuesto.id = cot.impuesto_id
LEFT JOIN configuracion_centros cot_centro ON cot_centro.id = cot.centro_id
LEFT JOIN configuracion_talleres cot_taller ON cot_taller.id = cot.taller_id
LEFT JOIN configuracion_mostradores cot_mostrador ON cot_mostrador.id = cot.mostrador_id
LEFT JOIN configuracion_tarifas tarifa ON tarifa.id = cot.tarifa_id
LEFT JOIN posventa_cotizacion_productos cp ON cp.cotizacion_id = cot.id
LEFT JOIN posventa_productos prod ON prod.id = cp.producto_id
LEFT JOIN posventa_cotizacion_extras extra ON extra.cotizacion_id = cot.id
LEFT JOIN posventa_cotizaciones_views vista ON vista.cotizacion_id = cot.id
ORDER BY o.created_at DESC, o.id DESC
`;

export async function GET(request) {
  try {
    let scopeUserId = null;
    if (!hasPowerBiToken(request)) {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ message: "No autorizado." }, { status: 401 });
      }
      if (!canReadPowerBiPosventaData(user)) {
        return NextResponse.json({ message: "No tienes permiso para consultar esta data." }, { status: 403 });
      }
      if (!canViewAllDashboard(user)) {
        scopeUserId = user.id;
      }
    }

    const url = new URL(request.url);
    const limit = clampNumber(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const offset = clampOffset(url.searchParams.get("offset"));
    const withMeta = url.searchParams.get("withMeta") === "1";
    const scopeSql = scopeUserId ? "WHERE (o.created_by = ? OR o.asignado_a = ?)" : "";
    const query = POWERBI_POSVENTA_QUERY.replace("ORDER BY o.created_at DESC, o.id DESC", `${scopeSql} ORDER BY o.created_at DESC, o.id DESC`);
    const [rows] = await pool.query(`${query} LIMIT ${limit} OFFSET ${offset}`, scopeUserId ? [scopeUserId, scopeUserId] : []);

    if (withMeta) {
      const [timeRows] = await pool.query(
        `SELECT id, nombre, estado, minutos_desde, minutos_hasta, color_hexadecimal, descripcion
         FROM configuracion_posventa_estados_tiempo
         WHERE activo = 1
         ORDER BY minutos_desde ASC`
      );
      return NextResponse.json({
        rows,
        timeStates: timeRows.map((row) => ({
          id: row.id,
          nombre: row.nombre,
          estado: row.estado,
          minutosDesde: row.minutos_desde,
          minutosHasta: row.minutos_hasta,
          colorHexadecimal: row.color_hexadecimal,
          descripcion: row.descripcion || "",
        })),
      });
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error loading Power BI PostVenta data:", error);
    return NextResponse.json({ message: "No se pudo cargar la data de PostVenta para Power BI." }, { status: 500 });
  }
}
