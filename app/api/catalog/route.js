import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [priceRows] = await pool.query(
      `SELECT p.id, p.marca_id, p.modelo_id, p.version, p.precio_base, p.existe,
              ma.name AS marca_name, mo.name AS modelo_name, mon.codigo AS moneda_codigo, mon.simbolo AS moneda_simbolo
       FROM ventas_precios p
       INNER JOIN administracion_marcas ma ON ma.id = p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id
       INNER JOIN configuracion_monedas mon ON mon.id = p.moneda_id
       ORDER BY ma.name ASC, mo.name ASC, p.version ASC`
    );
    const [groupRows] = await pool.query(
      `SELECT id, precio_id, nombre, orden, is_active FROM ventas_precio_specs_group ORDER BY precio_id ASC, orden ASC, nombre ASC`
    );
    const [itemRows] = await pool.query(
      `SELECT id, group_id, clave, valor, orden, is_active FROM ventas_precio_specs_item ORDER BY group_id ASC, orden ASC, clave ASC`
    );
    const itemsByGroup = itemRows.reduce((acc, row) => {
      const key = row.group_id;
      acc[key] = acc[key] || [];
      acc[key].push({ id: row.id, groupId: row.group_id, clave: row.clave, valor: row.valor, orden: row.orden, isActive: Boolean(row.is_active) });
      return acc;
    }, {});
    const groupsByPrice = groupRows.reduce((acc, row) => {
      const key = row.precio_id;
      acc[key] = acc[key] || [];
      acc[key].push({ id: row.id, precioId: row.precio_id, nombre: row.nombre, orden: row.orden, isActive: Boolean(row.is_active), items: itemsByGroup[row.id] || [] });
      return acc;
    }, {});

    return NextResponse.json({
      prices: priceRows.map((row) => ({
        id: row.id,
        marcaId: row.marca_id,
        modeloId: row.modelo_id,
        version: row.version,
        precioBase: Number(row.precio_base),
        existe: Boolean(row.existe),
        marcaName: row.marca_name,
        modeloName: row.modelo_name,
        monedaCodigo: row.moneda_codigo,
        monedaSimbolo: row.moneda_simbolo,
        groups: groupsByPrice[row.id] || [],
      })),
    });
  } catch (error) {
    console.error("Error loading catalog:", error);
    return NextResponse.json({ message: "No se pudo cargar el catalogo." }, { status: 500 });
  }
}
