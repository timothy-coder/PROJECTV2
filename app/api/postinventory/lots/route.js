import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

async function getSettings(connection) {
  const [[settings]] = await connection.query(
    `SELECT habilitar_tipo_medida, habilitar_proveedor_en_lote
     FROM configuracion_posventa_inventario
     ORDER BY id ASC
     LIMIT 1`
  );
  return {
    habilitarTipoMedida: settings ? Boolean(settings.habilitar_tipo_medida) : true,
    habilitarProveedorEnLote: settings ? Boolean(settings.habilitar_proveedor_en_lote) : true,
  };
}

async function firstId(connection, table) {
  const [[row]] = await connection.query(`SELECT id FROM ${table} ORDER BY id ASC LIMIT 1`);
  return row?.id ? Number(row.id) : null;
}

async function recalcProductStock(connection, productoId) {
  const [[stock]] = await connection.query(
    `SELECT COALESCE(SUM(stock_lote), 0) AS total,
            COALESCE(SUM(stock_usado), 0) AS usado,
            COALESCE(SUM(stock_disponible), 0) AS disponible
     FROM posventa_productos_lotes
     WHERE producto_id = ?`,
    [productoId]
  );
  await connection.query(
    `UPDATE posventa_productos
     SET stock_total = ?, stock_usado = ?, stock_disponible = ?
     WHERE id = ?`,
    [Number(stock.total || 0), Number(stock.usado || 0), Number(stock.disponible || 0), productoId]
  );
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const body = await request.json();
    const productoId = Number(body.productoId || 0);
    const numeroFactura = String(body.numeroFactura || "").trim();
    const precioCompra = Number(body.precioCompra || 0);
    const stockLote = Number(body.stockLote || 0);
    const fechaVencimiento = body.fechaVencimiento || null;
    const settings = await getSettings(connection);
    const tipoMedidaId = body.tipoMedidaId ? Number(body.tipoMedidaId) : settings.habilitarTipoMedida ? null : await firstId(connection, "configuracion_tipos_medida");
    const proveedorId = body.proveedorId ? Number(body.proveedorId) : settings.habilitarProveedorEnLote ? null : await firstId(connection, "administracion_proveedores");

    if (!productoId || !numeroFactura || !tipoMedidaId || !proveedorId || stockLote < 0) {
      return NextResponse.json({ message: "Producto, factura, proveedor, tipo de medida y stock son obligatorios." }, { status: 400 });
    }

    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO posventa_productos_lotes
       (producto_id, tipo_medida_id, proveedor_id, numero_factura, fecha_vencimiento, precio_compra, stock_lote, stock_usado, stock_disponible)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [productoId, tipoMedidaId, proveedorId, numeroFactura, fechaVencimiento, precioCompra, stockLote, stockLote]
    );
    await recalcProductStock(connection, productoId);
    await connection.commit();

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating product lot:", error);
    return NextResponse.json({ message: "No se pudo crear el lote." }, { status: 500 });
  } finally {
    connection.release();
  }
}
