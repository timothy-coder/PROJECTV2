import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [priceRows] = await pool.query(
      `SELECT p.id, p.marca_id, p.modelo_id, p.version, p.combustible, p.moneda_id, p.precio_base,
              p.en_stock, p.existe, p.tiempo_entrega_dias, p.created_at, p.updated_at,
              ma.name AS marca_name, mo.name AS modelo_name,
              mon.codigo AS moneda_codigo, mon.simbolo AS moneda_simbolo
       FROM ventas_precios p
       INNER JOIN administracion_marcas ma ON ma.id = p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id
       INNER JOIN configuracion_monedas mon ON mon.id = p.moneda_id
       ORDER BY ma.name ASC, mo.name ASC, p.version ASC`
    );
    const [brandRows] = await pool.query(`SELECT id, name FROM administracion_marcas ORDER BY name ASC`);
    const [modelRows] = await pool.query(`SELECT id, marca_id, name FROM administracion_modelos ORDER BY name ASC`);
    const [currencyRows] = await pool.query(
      `SELECT id, codigo, nombre, simbolo FROM configuracion_monedas WHERE is_active = 1 ORDER BY codigo ASC`
    );
    const [historyRows] = await pool.query(
      `SELECT h.vin, h.precio_id, h.color_externo, h.color_interno, h.numero_motor,
              h.numerofactura, h.preciocompra, h.precioventa,
              h.created_at, h.created_at_facturacion, h.created_at_llegadaalcentro,
              h.created_at_entrega, h.updated_at,
              COALESCE(ev.eventos_count, 0) AS eventos_count,
              ev.ultimo_evento_at,
              rd.reserva_id AS reserva_id,
              r.estado AS reserva_estado,
              o.oportunidad_id AS oportunidad_code,
              p.version, ma.name AS marca_name, mo.name AS modelo_name, mon.simbolo AS moneda_simbolo
       FROM ventas_historial_carros h
       INNER JOIN ventas_precios p ON p.id = h.precio_id
       INNER JOIN administracion_marcas ma ON ma.id = p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id
       INNER JOIN configuracion_monedas mon ON mon.id = p.moneda_id
       LEFT JOIN ventas_reserva_detalles rd ON rd.vin = h.vin
       LEFT JOIN ventas_reservas r ON r.id = rd.reserva_id
       LEFT JOIN ventas_oportunidades o ON o.id = r.oportunidad_id
       LEFT JOIN (
         SELECT vin, COUNT(*) AS eventos_count, MAX(created_at) AS ultimo_evento_at
         FROM ventas_historial_carros_eventos
         GROUP BY vin
       ) ev ON ev.vin = h.vin
       ORDER BY h.created_at DESC`
    );
    const [soldRows] = await pool.query(
      `SELECT e.id AS evento_id, e.vin, e.numero_factura, e.fecha_facturacion,
              e.fecha_entrega_cliente, e.fecha_entrega_placa, e.placa, e.kilometraje,
              e.observacion, e.created_at AS evento_created_at, e.updated_at AS evento_updated_at,
              h.precio_id, h.color_externo, h.color_interno, h.numero_motor,
              h.numerofactura AS historial_numero_factura, h.preciocompra, h.precioventa,
              h.created_at, h.created_at_llegadaalcentro, h.updated_at,
              rd.reserva_id AS reserva_id,
              r.estado AS reserva_estado,
              o.oportunidad_id AS oportunidad_code,
              p.version, ma.name AS marca_name, mo.name AS modelo_name, mon.simbolo AS moneda_simbolo
       FROM ventas_historial_carros_eventos e
       INNER JOIN ventas_historial_carros h ON h.vin = e.vin
       INNER JOIN ventas_precios p ON p.id = h.precio_id
       INNER JOIN administracion_marcas ma ON ma.id = p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id
       INNER JOIN configuracion_monedas mon ON mon.id = p.moneda_id
       LEFT JOIN ventas_reserva_detalles rd ON rd.vin = h.vin
       LEFT JOIN ventas_reservas r ON r.id = rd.reserva_id
       LEFT JOIN ventas_oportunidades o ON o.id = r.oportunidad_id
       ORDER BY e.created_at DESC, e.id DESC`
    );
    const [pendingPurchaseRows] = await pool.query(
      `SELECT r.id AS reserva_id, r.estado, r.created_at,
              COALESCE(o.oportunidad_id, '-') AS oportunidad_code,
              CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente,
              q.anio, q.color_externo, q.color_interno,
              p.id AS precio_id, p.version, ma.name AS marca_name, mo.name AS modelo_name
       FROM ventas_reservas r
       INNER JOIN ventas_reserva_detalles d ON d.reserva_id = r.id
       INNER JOIN ventas_cotizaciones q ON q.id = d.cotizacion_id
       INNER JOIN ventas_precios p ON p.id = q.precio_id
       INNER JOIN administracion_marcas ma ON ma.id = p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id
       LEFT JOIN ventas_oportunidades o ON o.id = r.oportunidad_id
       LEFT JOIN administracion_clientes c ON c.id = o.cliente_id
       WHERE (d.vin IS NULL OR d.vin = '') AND COALESCE(d.vin_existe, 0) = 0
       ORDER BY r.created_at DESC`
    );

    return NextResponse.json({
      prices: priceRows.map((row) => ({
        id: row.id,
        marcaId: row.marca_id,
        modeloId: row.modelo_id,
        version: row.version,
        combustible: row.combustible || "GASOLINA",
        monedaId: row.moneda_id,
        precioBase: Number(row.precio_base),
        enStock: Boolean(row.en_stock),
        existe: Boolean(row.existe),
        tiempoEntregaDias: Number(row.tiempo_entrega_dias || 0),
        marcaName: row.marca_name,
        modeloName: row.modelo_name,
        monedaCodigo: row.moneda_codigo,
        monedaSimbolo: row.moneda_simbolo,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      options: {
        brands: brandRows.map((row) => ({ id: row.id, name: row.name })),
        models: modelRows.map((row) => ({ id: row.id, marcaId: row.marca_id, name: row.name })),
        currencies: currencyRows.map((row) => ({ id: row.id, codigo: row.codigo, nombre: row.nombre, simbolo: row.simbolo })),
      },
      history: historyRows.map((row) => ({
        vin: row.vin,
        precioId: row.precio_id,
        numeroFactura: row.numerofactura || "",
        colorExterno: row.color_externo || "",
        colorInterno: row.color_interno || "",
        numeroMotor: row.numero_motor || "",
        precioCompra: row.preciocompra === null ? null : Number(row.preciocompra),
        precioVenta: row.precioventa === null ? null : Number(row.precioventa),
        marcaName: row.marca_name,
        modeloName: row.modelo_name,
        version: row.version,
        monedaSimbolo: row.moneda_simbolo,
        createdAt: row.created_at,
        facturacionAt: row.created_at_facturacion,
        llegadaCentroAt: row.created_at_llegadaalcentro,
        entregaAt: row.created_at_entrega,
        updatedAt: row.updated_at,
        reservaId: row.reserva_id || null,
        reservaEstado: row.reserva_estado || "",
        oportunidadCode: row.oportunidad_code || "",
        enReserva: Boolean(row.reserva_id),
        vendido: Number(row.eventos_count || 0) > 0,
        eventosCount: Number(row.eventos_count || 0),
        ultimoEventoAt: row.ultimo_evento_at,
      })),
      soldHistory: soldRows.map((row) => ({
        eventId: row.evento_id,
        vin: row.vin,
        precioId: row.precio_id,
        numeroFactura: row.numero_factura || "",
        historialNumeroFactura: row.historial_numero_factura || "",
        colorExterno: row.color_externo || "",
        colorInterno: row.color_interno || "",
        numeroMotor: row.numero_motor || "",
        precioCompra: row.preciocompra === null ? null : Number(row.preciocompra),
        precioVenta: row.precioventa === null ? null : Number(row.precioventa),
        marcaName: row.marca_name,
        modeloName: row.modelo_name,
        version: row.version,
        monedaSimbolo: row.moneda_simbolo,
        createdAt: row.evento_created_at,
        historialCreatedAt: row.created_at,
        facturacionAt: row.fecha_facturacion,
        llegadaCentroAt: row.created_at_llegadaalcentro,
        entregaAt: row.fecha_entrega_cliente,
        entregaPlacaAt: row.fecha_entrega_placa,
        placa: row.placa || "",
        kilometraje: row.kilometraje === null ? null : Number(row.kilometraje),
        observacion: row.observacion || "",
        updatedAt: row.evento_updated_at,
        reservaId: row.reserva_id || null,
        reservaEstado: row.reserva_estado || "",
        oportunidadCode: row.oportunidad_code || "",
        enReserva: Boolean(row.reserva_id),
        vendido: true,
        eventosCount: 1,
        ultimoEventoAt: row.evento_created_at,
      })),
      pendingPurchases: pendingPurchaseRows.map((row) => ({
        reservaId: row.reserva_id,
        estado: row.estado || "",
        oportunidadCode: row.oportunidad_code || "-",
        cliente: String(row.cliente || "").trim() || "-",
        precioId: row.precio_id,
        marcaName: row.marca_name,
        modeloName: row.modelo_name,
        version: row.version,
        anio: row.anio || "",
        colorExterno: row.color_externo || "",
        colorInterno: row.color_interno || "",
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Error loading car prices:", error);
    return NextResponse.json({ message: "No se pudieron cargar los precios de carros." }, { status: 500 });
  }
}
