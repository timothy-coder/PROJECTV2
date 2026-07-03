import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const numeroParte = String(body.numeroParte || "").trim();
    const descripcion = String(body.descripcion || "").trim();
    const marca = String(body.marca || "").trim() || null;
    const tipoId = body.tipoId ? Number(body.tipoId) : null;
    const fechaIngreso = body.fechaIngreso || null;
    const stockTotal = Number(body.stockTotal || 0);
    const precioCompra = Number(body.precioCompra || 0);
    const precioVenta = Number(body.precioVenta || 0);
    const monedaId = body.monedaId ? Number(body.monedaId) : null;

    if (!id || !numeroParte || !descripcion) {
      return NextResponse.json({ message: "Producto invalido." }, { status: 400 });
    }

<<<<<<< Updated upstream
    const [stockRows] = await pool.query(
      `SELECT COALESCE(SUM(u.cantidad), 0) AS usado
       FROM posventa_lotes_ubicaciones u
       INNER JOIN posventa_productos_lotes l ON l.id = u.lote_id
       WHERE l.producto_id = ?`,
=======
    const [lotRows] = await pool.query(
      `SELECT COUNT(*) AS total_lotes,
              COALESCE(SUM(stock_lote), 0) AS total,
              COALESCE(SUM(stock_usado), 0) AS usado,
              COALESCE(SUM(stock_disponible), 0) AS disponible
       FROM posventa_productos_lotes
       WHERE producto_id = ?`,
>>>>>>> Stashed changes
      [id]
    );
    const hasLots = Number(lotRows[0]?.total_lotes || 0) > 0;
    let nextStockTotal = stockTotal;
    let stockUsado = 0;
    let stockDisponible = 0;
    if (hasLots) {
      nextStockTotal = Number(lotRows[0]?.total || 0);
      stockUsado = Number(lotRows[0]?.usado || 0);
      stockDisponible = Number(lotRows[0]?.disponible || 0);
    } else {
      const [stockRows] = await pool.query(
        `SELECT COALESCE(SUM(stock), 0) AS usado FROM posventa_stock WHERE producto_id = ?`,
        [id]
      );
      stockUsado = Number(stockRows[0]?.usado || 0);
      stockDisponible = Math.max(nextStockTotal - stockUsado, 0);
    }

    await pool.query(
      `UPDATE posventa_productos
       SET numero_parte = ?, descripcion = ?, marca = ?, tipo_inventario_id = ?, fecha_ingreso = ?,
           stock_total = ?, stock_usado = ?, stock_disponible = ?, precio_compra = ?, precio_venta = ?, moneda_id = ?
       WHERE id = ?`,
      [numeroParte, descripcion, marca, tipoId, fechaIngreso, nextStockTotal, stockUsado, stockDisponible, precioCompra, precioVenta, monedaId, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating product:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Ya existe un producto con ese numero de parte." }, { status: 409 });
    }
    return NextResponse.json({ message: "No se pudo actualizar el producto." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM posventa_productos WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ message: "No se pudo eliminar el producto." }, { status: 500 });
  }
}
