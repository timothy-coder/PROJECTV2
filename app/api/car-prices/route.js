import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [priceRows] = await pool.query(
      `SELECT p.id, p.marca_id, p.modelo_id, p.version, p.moneda_id, p.precio_base,
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
      `SELECT h.vin, h.precio_id, h.numerofactura, h.preciocompra, h.precioventa,
              h.created_at, h.created_at_facturacion, h.created_at_llegadaalcentro,
              h.created_at_entrega, h.updated_at,
              p.version, ma.name AS marca_name, mo.name AS modelo_name, mon.simbolo AS moneda_simbolo
       FROM ventas_historial_carros h
       INNER JOIN ventas_precios p ON p.id = h.precio_id
       INNER JOIN administracion_marcas ma ON ma.id = p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id
       INNER JOIN configuracion_monedas mon ON mon.id = p.moneda_id
       ORDER BY h.created_at DESC`
    );

    return NextResponse.json({
      prices: priceRows.map((row) => ({
        id: row.id,
        marcaId: row.marca_id,
        modeloId: row.modelo_id,
        version: row.version,
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
      })),
    });
  } catch (error) {
    console.error("Error loading car prices:", error);
    return NextResponse.json({ message: "No se pudieron cargar los precios de carros." }, { status: 500 });
  }
}
