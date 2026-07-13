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
    const procedencia = String(body.procedencia || "").trim() || null;
    const tipoId = body.tipoId ? Number(body.tipoId) : null;
    const fechaIngreso = body.fechaIngreso || null;
    const stockTotal = Number(body.stockTotal || 0);
    const precioVenta = Number(body.precioVenta || 0);
    const monedaId = body.monedaId ? Number(body.monedaId) : null;

    if (!id || !numeroParte || !descripcion) {
      return NextResponse.json({ message: "Producto invalido." }, { status: 400 });
    }

    const [lotRows] = await pool.query(
      `SELECT COUNT(*) AS total_lotes,
              COALESCE(SUM(stock_lote), 0) AS total,
              COALESCE(SUM(stock_usado), 0) AS usado,
              COALESCE(SUM(stock_disponible), 0) AS disponible,
              CASE
                WHEN COALESCE(SUM(stock_lote), 0) > 0
                  THEN COALESCE(SUM((precio_compra * COALESCE(NULLIF(tipo_cambio, 0), 1)) * stock_lote), 0) / SUM(stock_lote)
                ELSE 0
              END AS precio_compra_medio
       FROM posventa_productos_lotes
       WHERE producto_id = ?`,
      [id]
    );
    const hasLots = Number(lotRows[0]?.total_lotes || 0) > 0;
    let nextStockTotal = stockTotal;
    let stockUsado = 0;
    let stockDisponible = 0;
    let precioCompraCalculado = 0;
    if (hasLots) {
      nextStockTotal = Number(lotRows[0]?.total || 0);
      stockUsado = Number(lotRows[0]?.usado || 0);
      stockDisponible = Number(lotRows[0]?.disponible || 0);
      precioCompraCalculado = Number(lotRows[0]?.precio_compra_medio || 0);
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
       SET numero_parte = ?, descripcion = ?, marca = ?, procedencia = ?, tipo_inventario_id = ?, fecha_ingreso = ?,
           stock_total = ?, stock_usado = ?, stock_disponible = ?, precio_compra = ?, precio_venta = ?, moneda_id = ?
       WHERE id = ?`,
      [numeroParte, descripcion, marca, procedencia, tipoId, fechaIngreso, nextStockTotal, stockUsado, stockDisponible, precioCompraCalculado, precioVenta, monedaId, id]
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
