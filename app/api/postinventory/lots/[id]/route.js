import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

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

export async function PUT(request, { params }) {
  const connection = await pool.getConnection();
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const numeroFactura = String(body.numeroFactura || "").trim();
    const tipoMedidaId = body.tipoMedidaId ? Number(body.tipoMedidaId) : null;
    const proveedorId = body.proveedorId ? Number(body.proveedorId) : null;
    const fechaVencimiento = body.fechaVencimiento || null;
    const precioCompra = Number(body.precioCompra || 0);
    const stockLote = Number(body.stockLote || 0);

    if (!id || !numeroFactura || !tipoMedidaId || !proveedorId || stockLote < 0) {
      return NextResponse.json({ message: "Lote invalido." }, { status: 400 });
    }

    const [[current]] = await connection.query(`SELECT producto_id, stock_usado FROM posventa_productos_lotes WHERE id = ?`, [id]);
    if (!current) return NextResponse.json({ message: "Lote no encontrado." }, { status: 404 });
    const stockUsado = Number(current.stock_usado || 0);
    if (stockLote < stockUsado) {
      return NextResponse.json({ message: "El stock del lote no puede ser menor al stock usado." }, { status: 400 });
    }

    await connection.beginTransaction();
    await connection.query(
      `UPDATE posventa_productos_lotes
       SET tipo_medida_id = ?, proveedor_id = ?, numero_factura = ?, fecha_vencimiento = ?,
           precio_compra = ?, stock_lote = ?, stock_disponible = ?
       WHERE id = ?`,
      [tipoMedidaId, proveedorId, numeroFactura, fechaVencimiento, precioCompra, stockLote, stockLote - stockUsado, id]
    );
    await recalcProductStock(connection, current.producto_id);
    await connection.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating product lot:", error);
    return NextResponse.json({ message: "No se pudo actualizar el lote." }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function DELETE(_request, { params }) {
  const connection = await pool.getConnection();
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const [[current]] = await connection.query(`SELECT producto_id, stock_usado FROM posventa_productos_lotes WHERE id = ?`, [id]);
    if (!current) return NextResponse.json({ message: "Lote no encontrado." }, { status: 404 });
    if (Number(current.stock_usado || 0) > 0) {
      return NextResponse.json({ message: "No se puede eliminar un lote con stock usado." }, { status: 400 });
    }

    await connection.beginTransaction();
    await connection.query(`DELETE FROM posventa_productos_lotes WHERE id = ?`, [id]);
    await recalcProductStock(connection, current.producto_id);
    await connection.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting product lot:", error);
    return NextResponse.json({ message: "No se pudo eliminar el lote." }, { status: 500 });
  } finally {
    connection.release();
  }
}
