import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [giftRows] = await pool.query(
      `SELECT g.id, g.detalle, g.lote, g.precio_compra, g.precio_venta, g.impuesto_id,
              g.regalo_tienda, g.moneda_id, g.created_at, g.updated_at,
              im.nombre AS impuesto_nombre, im.porcentaje AS impuesto_porcentaje,
              mon.codigo AS moneda_codigo, mon.simbolo AS moneda_simbolo
       FROM ventas_regalos_disponibles g
       LEFT JOIN configuracion_impuestos im ON im.id = g.impuesto_id
       INNER JOIN configuracion_monedas mon ON mon.id = g.moneda_id
       ORDER BY g.id DESC`
    );
    const [currencyRows] = await pool.query(
      `SELECT id, codigo, nombre, simbolo FROM configuracion_monedas WHERE is_active = 1 ORDER BY codigo ASC`
    );
    const [taxRows] = await pool.query(
      `SELECT id, nombre, porcentaje FROM configuracion_impuestos WHERE is_active = 1 ORDER BY nombre ASC`
    );

    return NextResponse.json({
      gifts: giftRows.map((row) => ({
        id: row.id,
        detalle: row.detalle,
        lote: row.lote || "",
        precioCompra: Number(row.precio_compra),
        precioVenta: row.precio_venta === null ? null : Number(row.precio_venta),
        impuestoId: row.impuesto_id,
        regaloTienda: Boolean(row.regalo_tienda),
        monedaId: row.moneda_id,
        impuestoName: row.impuesto_nombre || "",
        impuestoPorcentaje: row.impuesto_porcentaje === null ? null : Number(row.impuesto_porcentaje),
        monedaCodigo: row.moneda_codigo,
        monedaSimbolo: row.moneda_simbolo,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      options: {
        currencies: currencyRows.map((row) => ({ id: row.id, codigo: row.codigo, nombre: row.nombre, simbolo: row.simbolo })),
        taxes: taxRows.map((row) => ({ id: row.id, nombre: row.nombre, porcentaje: Number(row.porcentaje) })),
      },
    });
  } catch (error) {
    console.error("Error loading gifts:", error);
    return NextResponse.json({ message: "No se pudieron cargar regalos." }, { status: 500 });
  }
}
