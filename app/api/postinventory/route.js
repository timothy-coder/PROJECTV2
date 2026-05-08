import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapStock(row) {
  return {
    id: row.id,
    productoId: row.producto_id,
    centroId: row.centro_id,
    tallerId: row.taller_id,
    mostradorId: row.mostrador_id,
    centroName: row.centro_name || "",
    tallerName: row.taller_name || "",
    mostradorName: row.mostrador_name || "",
    stock: Number(row.stock || 0),
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const [productRows] = await pool.query(
      `SELECT p.id, p.numero_parte, p.descripcion, p.tipo_inventario_id, p.fecha_ingreso,
              p.stock_total, p.stock_usado, p.stock_disponible,
              p.precio_compra, p.precio_venta, t.nombre AS tipo_nombre
       FROM posventa_productos p
       LEFT JOIN configuracion_inventario_tipo t ON t.id = p.tipo_inventario_id
       ORDER BY p.numero_parte ASC`
    );
    const [stockRows] = await pool.query(
      `SELECT s.id, s.producto_id, s.centro_id, s.taller_id, s.mostrador_id, s.stock, s.created_at,
              c.nombre AS centro_name, ta.nombre AS taller_name, mo.nombre AS mostrador_name
       FROM posventa_stock s
       LEFT JOIN configuracion_centros c ON c.id = s.centro_id
       LEFT JOIN configuracion_talleres ta ON ta.id = s.taller_id
       LEFT JOIN configuracion_mostradores mo ON mo.id = s.mostrador_id
       ORDER BY s.created_at DESC`
    );
    const [typeRows] = await pool.query(
      `SELECT id, nombre FROM configuracion_inventario_tipo ORDER BY nombre ASC`
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

    const stocks = stockRows.map(mapStock);
    const products = productRows.map((row) => ({
      ...(() => {
        const productStocks = stocks.filter((stock) => stock.productoId === row.id);
        const used = productStocks.reduce((sum, stock) => sum + Number(stock.stock || 0), 0);
        const total = Number(row.stock_total || 0);
        return {
          stockUsado: used,
          stockDisponible: Math.max(total - used, 0),
          stock: productStocks,
        };
      })(),
      id: row.id,
      numeroParte: row.numero_parte,
      descripcion: row.descripcion,
      tipoId: row.tipo_inventario_id,
      tipoNombre: row.tipo_nombre || "Sin tipo",
      fechaIngreso: row.fecha_ingreso,
      stockTotal: Number(row.stock_total || 0),
      precioCompra: Number(row.precio_compra || 0),
      precioVenta: Number(row.precio_venta || 0),
    }));

    return NextResponse.json({
      products,
      stocks,
      options: {
        types: typeRows.map((row) => ({ id: row.id, nombre: row.nombre })),
        centers: centerRows.map((row) => ({ id: row.id, nombre: row.nombre })),
        workshops: workshopRows.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
        counters: counterRows.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
      },
    });
  } catch (error) {
    console.error("Error loading post inventory:", error);
    return NextResponse.json({ message: "No se pudo cargar inventario." }, { status: 500 });
  }
}
