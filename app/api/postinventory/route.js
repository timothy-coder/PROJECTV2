import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { calculateLogisticsRow, LOGISTICS_MONTH_KEYS } from "@/lib/logisticsClassification";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function mapStock(row) {
  return {
    id: row.id,
    productoId: row.producto_id,
    loteId: row.lote_id,
    loteLabel: `Lote ${row.lote_id}`,
    numeroParte: row.numero_parte || "",
    descripcion: row.descripcion || "",
    anaquelId: row.anaquel_id,
    nivelId: row.nivel_id,
    posicionId: row.posicion_id,
    anaquelCodigo: row.anaquel_codigo || "",
    anaquelDescripcion: row.anaquel_descripcion || "",
    nivelCodigo: row.codigo_nivel || "",
    posicion: row.posicion || "",
    tallerName: row.taller_name || "",
    mostradorName: row.mostrador_name || "",
    tallerId: row.taller_id,
    mostradorId: row.mostrador_id,
    canAccessLocation: Boolean(row.can_access_location),
    stock: Number(row.cantidad || 0),
    createdAt: row.created_at,
  };
}

function mapCombo(row, items) {
  const comboItems = items.filter((item) => item.comboId === row.id);
  return {
    id: row.id,
    codigo: row.codigo || "",
    nombre: row.nombre,
    descripcion: row.descripcion || "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: comboItems,
    itemCount: comboItems.length,
    totalCantidad: comboItems.reduce((sum, item) => sum + Number(item.cantidad || 0), 0),
  };
}

function mapSoldProduct(row) {
  return {
    id: row.id,
    productoId: row.producto_id,
    anio: Number(row.anio || 0),
    mes: Number(row.mes || 0),
    cantidad: Number(row.cantidad || 0),
    numeroParte: row.numero_parte || "",
    descripcion: row.descripcion || "",
  };
}

function monthRef(offset) {
  const date = new Date();
  date.setMonth(date.getMonth() - offset);
  return {
    anio: date.getFullYear(),
    mes: date.getMonth() + 1,
  };
}

function diffDays(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  return Math.max(Math.floor((now.getTime() - date.getTime()) / 86400000), 0);
}

function buildLogisticsResult(productRow, soldRows) {
  const monthRefs = LOGISTICS_MONTH_KEYS.map((key, index) => ({ key, ...monthRef(index + 1) }));
  const row = {
    stockActual: Number(productRow.stock_disponible ?? productRow.stock_total ?? 0),
    diasAlmacen: diffDays(productRow.fecha_ingreso),
    ...Object.fromEntries(LOGISTICS_MONTH_KEYS.map((key) => [key, 0])),
  };

  soldRows
    .filter((item) => Number(item.producto_id) === Number(productRow.id))
    .forEach((item) => {
      const month = monthRefs.find((ref) => Number(ref.anio) === Number(item.anio) && Number(ref.mes) === Number(item.mes));
      if (month) row[month.key] = Number(item.cantidad || 0);
    });

  return calculateLogisticsRow(row);
}

function mapSettings(row) {
  return {
    habilitarMarcaManual: Boolean(row?.habilitar_marca_manual),
    habilitarLotes: row ? Boolean(row.habilitar_lotes) : true,
    habilitarFechaVencimiento: row ? Boolean(row.habilitar_fecha_vencimiento) : true,
    habilitarProveedorEnLote: row ? Boolean(row.habilitar_proveedor_en_lote) : true,
    habilitarTipoMedida: row ? Boolean(row.habilitar_tipo_medida) : true,
    habilitarProcedencia: row ? Boolean(row.habilitar_procedencia) : false,
    habilitarAperturaCaja: row ? Boolean(row.habilitar_apertura_caja) : false,
    habilitarTaller: row ? Boolean(row.habilitar_taller) : true,
    habilitarMostrador: row ? Boolean(row.habilitar_mostrador) : true,
    tcReferencial: Number(row?.tc_referencial || 0),
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    const currentUserId = Number(user?.id || 0);
    const permissions = user?.permissions || {};
    const canViewAllLots = hasPerm(permissions, ["inventario", "lotes_viewall"]);
    const canViewOwnLots = hasPerm(permissions, ["inventario", "lotes_view"]) || hasPerm(permissions, ["inventario", "lotes"]);
    const lotScopeSql = canViewAllLots ? "" : canViewOwnLots ? "WHERE l.created_by = ?" : "WHERE 1 = 0";
    const lotScopeParams = canViewAllLots ? [] : canViewOwnLots ? [currentUserId] : [];

    const [productRows] = await pool.query(
      `SELECT p.id, p.numero_parte, p.descripcion, p.marca, p.procedencia, p.tipo_inventario_id, p.fecha_ingreso,
              p.stock_total, p.stock_usado, p.stock_disponible,
              p.precio_compra, p.precio_venta, p.moneda_id,
              t.nombre AS tipo_nombre,
              m.codigo AS moneda_codigo, m.nombre AS moneda_nombre, m.simbolo AS moneda_simbolo
       FROM posventa_productos p
       LEFT JOIN configuracion_inventario_tipo t ON t.id = p.tipo_inventario_id
       LEFT JOIN configuracion_monedas m ON m.id = p.moneda_id
       ORDER BY p.numero_parte ASC`
    );
    const [stockRows] = await pool.query(
      `SELECT u.id, u.lote_id, u.anaquel_id, u.nivel_id, u.posicion_id, u.cantidad, u.created_at,
              l.producto_id,
              p.numero_parte, p.descripcion,
              a.taller_id, a.mostrador_id,
              a.codigo AS anaquel_codigo, a.descripcion AS anaquel_descripcion,
              n.codigo_nivel, po.posicion,
              ta.nombre AS taller_name, mo.nombre AS mostrador_name,
              CASE
                WHEN (a.taller_id IS NOT NULL AND ut.usuario_id IS NOT NULL)
                  OR (a.mostrador_id IS NOT NULL AND um.usuario_id IS NOT NULL)
                  OR (a.taller_id IS NULL AND a.mostrador_id IS NULL)
                THEN 1 ELSE 0
              END AS can_access_location
       FROM posventa_lotes_ubicaciones u
       INNER JOIN posventa_productos_lotes l ON l.id = u.lote_id
       INNER JOIN posventa_productos p ON p.id = l.producto_id
       INNER JOIN almacen_anaqueles a ON a.id = u.anaquel_id
       LEFT JOIN almacen_anaquel_niveles n ON n.id = u.nivel_id
       LEFT JOIN almacen_nivel_posiciones po ON po.id = u.posicion_id
       LEFT JOIN configuracion_talleres ta ON ta.id = a.taller_id
       LEFT JOIN configuracion_mostradores mo ON mo.id = a.mostrador_id
       LEFT JOIN administracion_usuario_talleres ut
         ON ut.taller_id = a.taller_id AND ut.usuario_id = ?
       LEFT JOIN administracion_usuario_mostradores um
         ON um.mostrador_id = a.mostrador_id AND um.usuario_id = ?
       ORDER BY u.created_at DESC`
      ,
      [currentUserId, currentUserId]
    );
    const [typeRows] = await pool.query(
      `SELECT id, nombre FROM configuracion_inventario_tipo ORDER BY nombre ASC`
    );
    const [currencyRows] = await pool.query(
      `SELECT m.id, m.codigo, m.nombre, m.simbolo, m.is_active,
              CASE WHEN pm.moneda_id IS NOT NULL AND pm.is_active = 1 THEN 1 ELSE 0 END AS is_posventa_default
       FROM configuracion_monedas m
       LEFT JOIN configuracion_posventa_monedas pm ON pm.moneda_id = m.id
       WHERE m.is_active = 1
       ORDER BY m.codigo ASC`
    );
    const [allCurrencyRows] = await pool.query(
      `SELECT m.id, m.codigo, m.nombre, m.simbolo, m.is_active,
              CASE WHEN pm.moneda_id IS NOT NULL AND pm.is_active = 1 THEN 1 ELSE 0 END AS is_posventa_default
       FROM configuracion_monedas m
       LEFT JOIN configuracion_posventa_monedas pm ON pm.moneda_id = m.id
       WHERE m.is_active = 1
       ORDER BY m.codigo ASC`
    );
    const [[activeTax]] = await pool.query(
      `SELECT id, nombre, porcentaje
       FROM configuracion_impuestos
       WHERE is_active = 1
       ORDER BY id ASC
       LIMIT 1`
    );
    const [settingsRows] = await pool.query(
      `SELECT habilitar_marca_manual, habilitar_lotes, habilitar_fecha_vencimiento,
              habilitar_proveedor_en_lote, habilitar_tipo_medida, habilitar_procedencia,
              habilitar_apertura_caja, habilitar_taller, habilitar_mostrador, tc_referencial
       FROM configuracion_posventa_inventario
       ORDER BY id ASC
       LIMIT 1`
    );
    const [measureTypeRows] = await pool.query(
      `SELECT id, nombre, abreviatura
       FROM configuracion_tipos_medida
       ORDER BY nombre ASC`
    );
    const [providerRows] = await pool.query(
      `SELECT id, razon_social, nombre_comercial, ruc, is_active
       FROM administracion_proveedores
       WHERE is_active = 1
       ORDER BY razon_social ASC`
    );
    const [voucherTypeRows] = await pool.query(
      `SELECT id, codigo, nombre
       FROM configuracion_tipos_comprobante
       WHERE active_configuracion = 1
       ORDER BY nombre ASC`
    );
    const [productLotRows] = await pool.query(
      `SELECT l.id, l.producto_id, l.tipo_medida_id, l.proveedor_id, l.numero_factura, l.tipo_comprobante_id,
              l.fecha_vencimiento, l.precio_compra, l.moneda_id, l.tipo_cambio,
              l.margen_comercial, l.precio_venta_sin_igv, l.precio_venta_con_igv,
              l.stock_lote, l.stock_usado, l.created_by,
              l.stock_disponible, l.created_at,
              tc.codigo AS tipo_comprobante_codigo, tc.nombre AS tipo_comprobante_nombre,
              lm.codigo AS lote_moneda_codigo, lm.nombre AS lote_moneda_nombre, lm.simbolo AS lote_moneda_simbolo,
              tm.nombre AS tipo_medida_nombre, tm.abreviatura AS tipo_medida_abreviatura,
              pr.razon_social AS proveedor_nombre, pr.nombre_comercial AS proveedor_comercial,
              COALESCE(u.fullname, u.username) AS created_by_name,
              (
                SELECT COUNT(*)
                FROM posventa_lotes_ubicaciones plu
                WHERE plu.lote_id = l.id
              ) AS ubicaciones_total,
              (
                SELECT COUNT(*)
                FROM posventa_lotes_ubicaciones plu
                INNER JOIN almacen_anaqueles aa ON aa.id = plu.anaquel_id
                LEFT JOIN administracion_usuario_talleres aut
                  ON aut.taller_id = aa.taller_id AND aut.usuario_id = ?
                LEFT JOIN administracion_usuario_mostradores aum
                  ON aum.mostrador_id = aa.mostrador_id AND aum.usuario_id = ?
                WHERE plu.lote_id = l.id
                  AND (
                    (aa.taller_id IS NOT NULL AND aut.usuario_id IS NOT NULL)
                    OR (aa.mostrador_id IS NOT NULL AND aum.usuario_id IS NOT NULL)
                    OR (aa.taller_id IS NULL AND aa.mostrador_id IS NULL)
                  )
              ) AS ubicaciones_asignadas
       FROM posventa_productos_lotes l
       LEFT JOIN configuracion_tipos_comprobante tc ON tc.id = l.tipo_comprobante_id
       LEFT JOIN configuracion_monedas lm ON lm.id = l.moneda_id
       LEFT JOIN configuracion_tipos_medida tm ON tm.id = l.tipo_medida_id
       LEFT JOIN administracion_proveedores pr ON pr.id = l.proveedor_id
       LEFT JOIN administracion_usuarios u ON u.id = l.created_by
       ${lotScopeSql}
       ORDER BY l.created_at DESC`,
      [currentUserId, currentUserId, ...lotScopeParams]
    );
    const [centerRows] = await pool.query(
      `SELECT id, nombre FROM configuracion_centros ORDER BY nombre ASC`
    );
    const [workshopRows] = await pool.query(
      `SELECT id, centro_id, nombre FROM configuracion_talleres ORDER BY nombre ASC`
    );
    const [counterRows] = await pool.query(
      `SELECT id, centro_id, nombre FROM configuracion_mostradores ORDER BY nombre ASC`
    );
    const [locationLotRows] = await pool.query(
      `SELECT l.id, l.producto_id, p.numero_parte, p.descripcion
       FROM posventa_productos_lotes l
       INNER JOIN posventa_productos p ON p.id = l.producto_id
       ORDER BY p.numero_parte ASC, l.id DESC`
    );
    const [shelfRows] = await pool.query(
      `SELECT a.id, a.codigo, a.descripcion, a.taller_id, a.mostrador_id,
              ta.nombre AS taller_name, mo.nombre AS mostrador_name
       FROM almacen_anaqueles a
       LEFT JOIN configuracion_talleres ta ON ta.id = a.taller_id
       LEFT JOIN configuracion_mostradores mo ON mo.id = a.mostrador_id
       LEFT JOIN administracion_usuario_talleres ut
         ON ut.taller_id = a.taller_id AND ut.usuario_id = ?
       LEFT JOIN administracion_usuario_mostradores um
         ON um.mostrador_id = a.mostrador_id AND um.usuario_id = ?
       WHERE a.activo = 1
         AND (
           (a.taller_id IS NOT NULL AND ut.usuario_id IS NOT NULL)
           OR (a.mostrador_id IS NOT NULL AND um.usuario_id IS NOT NULL)
           OR (a.taller_id IS NULL AND a.mostrador_id IS NULL)
         )
       ORDER BY a.codigo ASC`,
      [currentUserId, currentUserId]
    );
    const [shelfLevelRows] = await pool.query(
      `SELECT id, anaquel_id, codigo_nivel, orden_nivel
       FROM almacen_anaquel_niveles
       WHERE activo = 1
       ORDER BY orden_nivel ASC`
    );
    const [shelfPositionRows] = await pool.query(
      `SELECT id, nivel_id, posicion
       FROM almacen_nivel_posiciones
       WHERE activo = 1
       ORDER BY posicion ASC`
    );
    const [comboRows] = await pool.query(
      `SELECT id, codigo, nombre, descripcion, is_active, created_at, updated_at
       FROM posventa_combos
       ORDER BY nombre ASC`
    );
    const [comboItemRows] = await pool.query(
      `SELECT ci.id, ci.combo_id, ci.producto_id, ci.cantidad, ci.precio_venta, ci.descuento_tipo, ci.descuento_valor, ci.created_at,
              p.numero_parte, p.descripcion
       FROM posventa_combo_items ci
       INNER JOIN posventa_productos p ON p.id = ci.producto_id
       ORDER BY p.numero_parte ASC`
    );
    const [soldProductRows] = await pool.query(
      `SELECT v.id, v.producto_id, v.anio, v.mes, v.cantidad,
              p.numero_parte, p.descripcion
       FROM posventa_productos_ventames v
       INNER JOIN posventa_productos p ON p.id = v.producto_id
       ORDER BY v.anio DESC, v.mes DESC, p.numero_parte ASC`
    );

    const stocks = stockRows.map(mapStock);
    const products = productRows.map((row) => ({
      ...(() => {
        const productStocks = stocks.filter((stock) => stock.productoId === row.id);
        const used = productStocks.reduce((sum, stock) => sum + Number(stock.stock || 0), 0);
        const total = Number(row.stock_total || 0);
        const logistics = buildLogisticsResult(row, soldProductRows);
        return {
          stockUsado: used,
          stockDisponible: Math.max(total - used, 0),
          stock: productStocks,
          tipoLogistico: logistics.tipo,
          respuestaFinalLogistica: logistics.respuestaFinal,
        };
      })(),
      id: row.id,
      numeroParte: row.numero_parte,
      descripcion: row.descripcion,
      marca: row.marca || "",
      procedencia: row.procedencia || "",
      tipoId: row.tipo_inventario_id,
      tipoNombre: row.tipo_nombre || "Sin tipo",
      fechaIngreso: row.fecha_ingreso,
      stockTotal: Number(row.stock_total || 0),
      precioCompra: Number(row.precio_compra || 0),
      precioVenta: Number(row.precio_venta || 0),
      monedaId: row.moneda_id,
      monedaCodigo: row.moneda_codigo || "",
      monedaNombre: row.moneda_nombre || "",
      monedaSimbolo: row.moneda_simbolo || "S/",
      lotes: productLotRows.filter((lot) => lot.producto_id === row.id).map((lot) => ({
        id: lot.id,
        productoId: lot.producto_id,
        tipoMedidaId: lot.tipo_medida_id,
        proveedorId: lot.proveedor_id,
        numeroFactura: lot.numero_factura || "",
        tipoComprobanteId: lot.tipo_comprobante_id,
        tipoComprobanteCodigo: lot.tipo_comprobante_codigo || "",
        tipoComprobanteNombre: lot.tipo_comprobante_nombre || "",
        fechaVencimiento: lot.fecha_vencimiento,
        precioCompra: Number(lot.precio_compra || 0),
        monedaId: lot.moneda_id,
        monedaCodigo: lot.lote_moneda_codigo || "",
        monedaNombre: lot.lote_moneda_nombre || "",
        monedaSimbolo: lot.lote_moneda_simbolo || "",
        tipoCambio: lot.tipo_cambio === null || lot.tipo_cambio === undefined ? "" : Number(lot.tipo_cambio || 0),
        margenComercial: lot.margen_comercial === null || lot.margen_comercial === undefined ? "" : Number(lot.margen_comercial || 0),
        precioVentaSinIgv: lot.precio_venta_sin_igv === null || lot.precio_venta_sin_igv === undefined ? "" : Number(lot.precio_venta_sin_igv || 0),
        precioVentaConIgv: lot.precio_venta_con_igv === null || lot.precio_venta_con_igv === undefined ? "" : Number(lot.precio_venta_con_igv || 0),
        stockLote: Number(lot.stock_lote || 0),
        stockUsado: Number(lot.stock_usado || 0),
        stockDisponible: Number(lot.stock_disponible || 0),
        tipoMedidaNombre: lot.tipo_medida_nombre || "",
        tipoMedidaAbreviatura: lot.tipo_medida_abreviatura || "",
        proveedorNombre: lot.proveedor_comercial || lot.proveedor_nombre || "",
        createdBy: lot.created_by,
        createdByName: lot.created_by_name || "",
        ubicacionesTotal: Number(lot.ubicaciones_total || 0),
        ubicacionesAsignadas: Number(lot.ubicaciones_asignadas || 0),
        canAccessLocation: Number(lot.ubicaciones_total || 0) === 0 || Number(lot.ubicaciones_total || 0) === Number(lot.ubicaciones_asignadas || 0),
        createdAt: lot.created_at,
      })),
    }));
    const comboItems = comboItemRows.map((row) => ({
      id: row.id,
      comboId: row.combo_id,
      productoId: row.producto_id,
      cantidad: Number(row.cantidad || 0),
      precioVenta: Number(row.precio_venta || 0),
      descuentoTipo: row.descuento_tipo || "monto",
      descuentoValor: Number(row.descuento_valor || 0),
      numeroParte: row.numero_parte,
      descripcion: row.descripcion,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      products,
      combos: comboRows.map((row) => mapCombo(row, comboItems)),
      soldProducts: soldProductRows.map(mapSoldProduct),
      stocks,
      options: {
        settings: mapSettings(settingsRows[0]),
        types: typeRows.map((row) => ({ id: row.id, nombre: row.nombre })),
        measureTypes: measureTypeRows.map((row) => ({ id: row.id, nombre: row.nombre, abreviatura: row.abreviatura || "" })),
        providers: providerRows.map((row) => ({ id: row.id, nombre: row.nombre_comercial || row.razon_social, razonSocial: row.razon_social, ruc: row.ruc || "" })),
        voucherTypes: voucherTypeRows.map((row) => ({ id: row.id, codigo: row.codigo, nombre: row.nombre })),
        currencies: currencyRows.map((row) => ({ id: row.id, codigo: row.codigo, nombre: row.nombre, simbolo: row.simbolo })),
        allCurrencies: allCurrencyRows.map((row) => ({ id: row.id, codigo: row.codigo, nombre: row.nombre, simbolo: row.simbolo, isDefaultPosventa: Boolean(row.is_posventa_default) })),
        defaultPostventaCurrencyId: allCurrencyRows.find((row) => Number(row.is_posventa_default) === 1)?.id || currencyRows[0]?.id || allCurrencyRows[0]?.id || null,
        activeTax: activeTax ? { id: activeTax.id, nombre: activeTax.nombre, porcentaje: Number(activeTax.porcentaje || 0) } : null,
        centers: centerRows.map((row) => ({ id: row.id, nombre: row.nombre })),
        workshops: workshopRows.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
        counters: counterRows.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
        lots: locationLotRows.map((row) => ({ id: row.id, productoId: row.producto_id, numeroParte: row.numero_parte, descripcion: row.descripcion, label: `${row.numero_parte} - Lote ${row.id}` })),
        shelves: shelfRows.map((row) => ({ id: row.id, codigo: row.codigo, descripcion: row.descripcion || "", tallerId: row.taller_id, mostradorId: row.mostrador_id, tallerName: row.taller_name || "", mostradorName: row.mostrador_name || "" })),
        shelfLevels: shelfLevelRows.map((row) => ({ id: row.id, anaquelId: row.anaquel_id, codigoNivel: row.codigo_nivel, ordenNivel: row.orden_nivel })),
        shelfPositions: shelfPositionRows.map((row) => ({ id: row.id, nivelId: row.nivel_id, posicion: row.posicion })),
      },
    });
  } catch (error) {
    console.error("Error loading post inventory:", error);
    return NextResponse.json({ message: "No se pudo cargar inventario." }, { status: 500 });
  }
}
