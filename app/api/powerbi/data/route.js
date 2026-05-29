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

function canReadPowerBiData(user) {
  const permissions = user?.permissions || {};
  return Boolean(
    hasPerm(permissions, ["oportunidades", "viewall"]) ||
      hasPerm(permissions, ["cotizacion", "viewall"]) ||
      hasPerm(permissions, ["reservas", "viewall"])
  );
}

const POWERBI_QUERY = `
SELECT
  o.created_at AS fechacreacionoportunidad,
  o.oportunidad_id AS codigodeoportunidad,
  o.id AS oportunidad_db_id,
  voll.fecha_agenda AS fecha_agenda,
  voll.hora_agenda AS hora_agenda,
  tk.token AS token,
  u.fullname AS usuarionombreasignadoaoportunidad,
  u.username AS usuarioasignadoaoportunidad,
  us.fullname AS usuarionombrecreadoroportunidad,
  us.username AS usuariocreadoroportunidad,
  c.id_lead AS LEADford,
  CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, '')) AS nombreapelidocomlpetoclietne,
  c.email AS correocleinte,
  c.celular AS celular,
  c.tipo_identificacion AS tipoidentifcaion,
  c.identificacion_fiscal AS numoeridentificaion,
  c.fecha_nacimiento AS fechanacimeintolceitne,
  c.ocupacion AS ocupacioncleitne,
  c.domicilio AS domicilio,
  c.nombreconyugue AS nombreconyugue,
  c.dniconyugue AS dniconyugue,
  c.created_at AS fehcacreaciocliente,
  d.nombre AS nombredepar,
  p.nombre AS nombreprovi,
  di.nombre AS nombreditri,
  usu.fullname AS nombreusuariocreacioncliente,
  oc.name AS origennombre,
  os.name AS suboigennombre,
  ve.nombre AS etapanombre,
  ve.descripcion AS valoretapa,
  ve.color AS coloretapa,
  vc.id AS cotizacion_id,
  vc.precio_base AS preciocotizacion,
  vc.anio AS \`añocarro\`,
  vc.sku AS diasvalidezcotizacion,
  vc.color_externo AS colorexternocarro,
  vc.color_interno AS colorinternocarro,
  vc.tc_referencial AS tcreferencial,
  vc.\`descuento_vehículo\` AS descuentovehiculomonto,
  vc.\`descuento_vehículo_porcentaje\` AS descuentovehiculoporcentaje,
  vc.estado AS estadocotizacion,
  vc.descuento_total_accesorios AS descuentototaccesorios,
  vc.descuento_total_regalos AS desucentototaslregalos,
  vc.observaciones AS observacionescotizacion,
  vc.otros_productos AS otroproducotcotizacion,
  vc.precio_tramite AS preciotramitecotizcaion,
  vc.created_at AS fechacreaciocotizacion,
  vrd.detalle AS regalodetalle,
  vrd.lote AS regalolote,
  vrd.precio_compra AS regalopreciocompra,
  vrd.precio_venta AS regaloprecioventa,
  vrd.created_at AS regalofechacreciaon,
  m.codigo AS monedacodigoregalo,
  m.nombre AS monedanombreregalo,
  m.simbolo AS monedasimboloregalo,
  i.nombre AS impuestonombreregalo,
  i.porcentaje AS impuestoporcentajeregalo,
  vcr.cantidad AS regalocantidad,
  vcr.precio_unitario AS regalopreciounitario,
  vcr.subtotal AS regalosubtotal,
  vcr.descuento_porcentaje AS regalodescuento_porcentaje,
  vcr.descuento_monto AS regalodescuento_monto,
  vcr.total AS regalototal,
  vcr.created_at AS regalocreated_at,
  vad.detalle AS accesoriodetalle,
  vad.numero_parte AS accesorionumeorparte,
  vad.precio AS accesoriopreiocompra,
  vad.precio_venta AS accesoriopreioventa,
  vad.created_at AS accesoriofechacracion,
  mo.codigo AS monedacodigoaccesorio,
  mo.nombre AS monedanombreaccesorio,
  mo.simbolo AS monedasimboloaccesorio,
  im.nombre AS impuestonombreaccesorio,
  im.porcentaje AS impuestoporcentajeaccesorio,
  vr.id AS reserva_id,
  vr.estado AS estadoreserva,
  vr.observaciones AS observacionesreserva,
  vrdt.id AS reserva_detalle_id,
  vrdt.tipo_comprobante AS tipocomporbante,
  vrdt.tipo_persona AS tipopersona,
  vrdt.numero_motor AS numeromotor,
  vrdt.tc_referencial AS tiporeferencial,
  vrdt.total AS total,
  vrdt.vin AS reserva_vin,
  vrdt.vin_existe AS vinexiste,
  vrdt.usovehiculo AS usovehiculo,
  vrdt.placa AS plca,
  vrdt.dsctotienda AS dsctotienda,
  vrdt.dsctotiendaporcentaje AS dsctotiendaporcentaje,
  vrdt.dsctobonoretoma AS dsctobonoretoma,
  vrdt.dsctonper AS dsctonper,
  vrdt.glp AS glp,
  vrdt.tarjetaplaca AS tarjetaplaca,
  vrdt.flete AS flete,
  vrdt.cuota_inicial AS cuota_inicial,
  vrdt.cantidad AS cantidad,
  vrdt.precio_unitario AS precio_unitario,
  vrdt.subtotal AS subtotal,
  vrdt.descripcion AS descripcion,
  vrdt.origen_fondos AS origen_fondos,
  vrdt.codigo AS codigo,
  vrdt.campana AS campana,
  vrdt.dni AS dni,
  vrdt.telefono2 AS telefono2,
  vrdt.forma_pago AS forma_pago,
  vrdt.banco AS banco,
  vrdt.tipo_credito AS tipo_credito,
  vrdt.glp_sn AS glp_sn,
  vrdt.tarjeta_sn AS tarjeta_sn,
  vrdt.flete_sn AS flete_sn,
  vrdt.created_at AS reserva_detalle_created_at,
  vrdp.entidad_financiera AS entidad_financiera,
  vrdp.numero_operacion AS numero_operacion,
  vrdp.monto AS monto_deposito,
  vrdp.fecha_deposito AS fecha_deposito,
  vrdp.observacion AS observacion_deposito,
  vrdp.created_at AS deposito_created_at,
  vrco.nombre AS copropietario_nombre,
  vrco.apellido AS copropietario_apellido,
  vrco.email AS copropietario_email,
  vrco.celular AS copropietario_celular,
  vrco.tipo_identificacion AS copropietario_tipo_identificacion,
  vrco.numero_documento AS copropietario_numero_documento,
  vrco.nombre_comercial AS copropietario_nombre_comercial,
  vp.precio_base AS preciocatalogo,
  vp.combustible AS combnuistilbe,
  vp.version,
  vp.created_at AS precio_catalogo_created_at,
  ma.name AS marca_catalogo,
  moy.name AS modelo_catalogo,
  mon.nombre AS moneda_catalogo,
  vhc.vin AS historial_vin,
  vhc.color_externo AS historial_color_externo,
  vhc.color_interno AS historial_color_interno,
  vhc.numero_motor AS historial_numero_motor,
  vhc.numerofactura AS historial_numerofactura,
  vhc.preciocompra AS historial_preciocompra,
  vhc.precioventa AS historial_precioventa,
  vhc.created_at AS historial_created_at,
  vhc.created_at_facturacion AS historial_created_at_facturacion,
  vhc.created_at_llegadaalcentro AS historial_created_at_llegadaalcentro,
  vhc.created_at_entrega AS historial_created_at_entrega,
  mar.name AS marca_historial,
  model.name AS modelo_historial,
  mone.nombre AS moneda_historial,
  voc.detalle AS cierreoportunidaddetalle,
  cvcd.detalle AS motivocierreoportunidad,
  vhce.numero_factura AS evento_numero_factura,
  vhce.fecha_facturacion AS evento_fecha_facturacion,
  vhce.fecha_entrega_cliente AS evento_fecha_entrega_cliente,
  vhce.fecha_entrega_placa AS evento_fecha_entrega_placa,
  vhce.kilometraje AS evento_kilometraje,
  vcep.vistas_totales AS cotizacion_vistas_totales,
  vcvh.fecha_hora AS cotizacion_vista_fecha_hora,
  voc.created_at as fechacreacioncierre
FROM ventas_oportunidades o
LEFT JOIN (
  SELECT vod.*
  FROM ventas_oportunidades_detalles vod
  INNER JOIN (
    SELECT oportunidad_padre_id, MAX(id) AS max_id
    FROM ventas_oportunidades_detalles
    GROUP BY oportunidad_padre_id
  ) latest_vod ON latest_vod.max_id = vod.id
) voll ON voll.oportunidad_padre_id = o.id
LEFT JOIN ventas_oportunidad_tokens tk ON tk.oportunidad_id = o.id
LEFT JOIN administracion_usuarios u ON u.id = o.asignado_a
LEFT JOIN administracion_clientes c ON c.id = o.cliente_id
LEFT JOIN administracion_usuarios usu ON c.created_by = usu.id
LEFT JOIN configuracion_origenes_citas oc ON oc.id = o.origen_id
LEFT JOIN configuracion_suborigenes_citas os ON os.id = o.suborigen_id
LEFT JOIN ventas_etapasconversion ve ON ve.id = o.etapasconversion_id
LEFT JOIN administracion_usuarios us ON us.id = o.created_by
LEFT JOIN ventas_cotizaciones vc ON vc.oportunidad_id = o.id
LEFT JOIN ventas_cotizaciones_regalos vcr ON vcr.cotizacion_id = vc.id
LEFT JOIN ventas_cotizaciones_accesorios vca ON vca.cotizacion_id = vc.id
LEFT JOIN ventas_regalos_disponibles vrd ON vrd.id = vcr.regalo_id
LEFT JOIN ventas_accesorios_disponibles vad ON vad.id = vca.accesorio_id
LEFT JOIN ventas_cotizacion_enlaces_publicos vcep ON vcep.cotizacion_id = vc.id
LEFT JOIN ventas_cotizacion_vistas_historial vcvh ON vcvh.enlace_id = vcep.id
LEFT JOIN configuracion_monedas m ON m.id = vrd.moneda_id
LEFT JOIN configuracion_impuestos i ON i.id = vrd.impuesto_id
LEFT JOIN configuracion_monedas mo ON mo.id = vad.moneda_id
LEFT JOIN configuracion_impuestos im ON im.id = vad.impuesto_id
LEFT JOIN departamentos d ON c.departamento_id = d.id
LEFT JOIN provincias p ON p.id = c.provincia_id
LEFT JOIN distritos di ON di.id = c.distrito_id
LEFT JOIN ventas_reservas vr ON vr.oportunidad_id = o.id
LEFT JOIN ventas_reserva_detalles vrdt ON vrdt.reserva_id = vr.id AND vrdt.cotizacion_id = vc.id AND vrdt.oportunidad_id = o.id
LEFT JOIN ventas_reserva_depositos vrdp ON vrdp.detalle_id = vrdt.id
LEFT JOIN ventas_reservas_copropietarios vrco ON vrco.reserva_id = vr.id
LEFT JOIN ventas_precios vp ON vp.id = vc.precio_id
LEFT JOIN administracion_marcas ma ON ma.id = vp.marca_id
LEFT JOIN administracion_modelos moy ON moy.id = vp.modelo_id
LEFT JOIN configuracion_monedas mon ON mon.id = vp.moneda_id
LEFT JOIN ventas_historial_carros vhc ON vhc.vin = vrdt.vin AND vhc.precio_id = vp.id
LEFT JOIN administracion_marcas mar ON mar.id = vp.marca_id
LEFT JOIN administracion_modelos model ON model.id = vp.modelo_id
LEFT JOIN configuracion_monedas mone ON mone.id = vp.moneda_id
LEFT JOIN ventas_oportunidades_cierres voc ON voc.oportunidad_id = o.id
LEFT JOIN configuracion_ventas_cierres_detalle cvcd ON cvcd.id = voc.cierre_detalle_id
LEFT JOIN ventas_historial_carros_eventos vhce ON vhce.vin = vhc.vin
ORDER BY o.created_at DESC, o.id DESC
`;

export async function GET(request) {
  try {
    if (!hasPowerBiToken(request)) {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ message: "No autorizado." }, { status: 401 });
      }
      if (!canReadPowerBiData(user)) {
        return NextResponse.json({ message: "No tienes permiso para consultar esta data." }, { status: 403 });
      }
    }

    const url = new URL(request.url);
    const limit = clampNumber(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const offset = clampOffset(url.searchParams.get("offset"));
    const [rows] = await pool.query(`${POWERBI_QUERY} LIMIT ${limit} OFFSET ${offset}`);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error loading Power BI data:", error);
    return NextResponse.json({ message: "No se pudo cargar la data para Power BI." }, { status: 500 });
  }
}
