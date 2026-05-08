import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const numeroParte = String(body.numeroParte || "").trim();
    const descripcion = String(body.descripcion || "").trim();
    const tipoId = body.tipoId ? Number(body.tipoId) : null;
    const fechaIngreso = body.fechaIngreso || null;
    const stockTotal = Number(body.stockTotal || 0);
    const precioCompra = Number(body.precioCompra || 0);
    const precioVenta = Number(body.precioVenta || 0);

    if (!id || !numeroParte || !descripcion) {
      return NextResponse.json({ message: "Producto invalido." }, { status: 400 });
    }

    const [stockRows] = await pool.query(
      `SELECT COALESCE(SUM(stock), 0) AS usado FROM posventa_stock WHERE producto_id = ?`,
      [id]
    );
    const stockUsado = Number(stockRows[0]?.usado || 0);
    const stockDisponible = Math.max(stockTotal - stockUsado, 0);

    await pool.query(
      `UPDATE posventa_productos
       SET numero_parte = ?, descripcion = ?, tipo_inventario_id = ?, fecha_ingreso = ?,
           stock_total = ?, stock_usado = ?, stock_disponible = ?, precio_compra = ?, precio_venta = ?
       WHERE id = ?`,
      [numeroParte, descripcion, tipoId, fechaIngreso, stockTotal, stockUsado, stockDisponible, precioCompra, precioVenta, id]
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
