import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [accessoryRows] = await pool.query(
      `SELECT a.id, a.marca_id, a.modelo_id, a.detalle, a.numero_parte, a.precio, a.precio_venta,
              a.impuesto_id, a.moneda_id, a.created_at, a.updated_at,
              ma.name AS marca_name, mo.name AS modelo_name,
              im.nombre AS impuesto_nombre, im.porcentaje AS impuesto_porcentaje,
              mon.codigo AS moneda_codigo, mon.simbolo AS moneda_simbolo
       FROM ventas_accesorios_disponibles a
       INNER JOIN administracion_marcas ma ON ma.id = a.marca_id
       INNER JOIN administracion_modelos mo ON mo.id = a.modelo_id
       LEFT JOIN configuracion_impuestos im ON im.id = a.impuesto_id
       INNER JOIN configuracion_monedas mon ON mon.id = a.moneda_id
       ORDER BY a.id DESC`
    );
    const [brandRows] = await pool.query(`SELECT id, name FROM administracion_marcas ORDER BY name ASC`);
    const [modelRows] = await pool.query(`SELECT id, marca_id, name FROM administracion_modelos ORDER BY name ASC`);
    const [currencyRows] = await pool.query(
      `SELECT id, codigo, nombre, simbolo FROM configuracion_monedas WHERE is_active = 1 ORDER BY codigo ASC`
    );
    const [taxRows] = await pool.query(
      `SELECT id, nombre, porcentaje FROM configuracion_impuestos WHERE is_active = 1 ORDER BY nombre ASC`
    );

    return NextResponse.json({
      accessories: accessoryRows.map((row) => ({
        id: row.id,
        marcaId: row.marca_id,
        modeloId: row.modelo_id,
        detalle: row.detalle,
        numeroParte: row.numero_parte,
        precio: Number(row.precio),
        precioVenta: row.precio_venta === null ? null : Number(row.precio_venta),
        impuestoId: row.impuesto_id,
        monedaId: row.moneda_id,
        marcaName: row.marca_name,
        modeloName: row.modelo_name,
        impuestoName: row.impuesto_nombre || "",
        impuestoPorcentaje: row.impuesto_porcentaje === null ? null : Number(row.impuesto_porcentaje),
        monedaCodigo: row.moneda_codigo,
        monedaSimbolo: row.moneda_simbolo,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      options: {
        brands: brandRows.map((row) => ({ id: row.id, name: row.name })),
        models: modelRows.map((row) => ({ id: row.id, marcaId: row.marca_id, name: row.name })),
        currencies: currencyRows.map((row) => ({ id: row.id, codigo: row.codigo, nombre: row.nombre, simbolo: row.simbolo })),
        taxes: taxRows.map((row) => ({ id: row.id, nombre: row.nombre, porcentaje: Number(row.porcentaje) })),
      },
    });
  } catch (error) {
    console.error("Error loading accessories:", error);
    return NextResponse.json({ message: "No se pudieron cargar accesorios." }, { status: 500 });
  }
}
