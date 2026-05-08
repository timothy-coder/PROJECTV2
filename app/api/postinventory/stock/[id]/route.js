import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const productoId = Number(body.productoId);
    const centroId = Number(body.centroId);
    const tallerId = body.tallerId ? Number(body.tallerId) : null;
    const mostradorId = body.mostradorId ? Number(body.mostradorId) : null;
    const stock = Number(body.stock || 0);

    if (!id || !productoId || !centroId || Number.isNaN(stock) || (tallerId && mostradorId)) {
      return NextResponse.json({ message: "Ubicacion o stock invalido." }, { status: 400 });
    }

    await pool.query(
      `UPDATE posventa_stock
       SET producto_id = ?, centro_id = ?, taller_id = ?, mostrador_id = ?, stock = ?
       WHERE id = ?`,
      [productoId, centroId, tallerId, mostradorId, stock, id]
    );
    await syncProductStock(productoId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating stock:", error);
    return NextResponse.json({ message: "No se pudo actualizar la ubicacion." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const [rows] = await pool.query(`SELECT producto_id FROM posventa_stock WHERE id = ?`, [Number(rawId)]);
    const productoId = rows[0]?.producto_id;
    await pool.query(`DELETE FROM posventa_stock WHERE id = ?`, [Number(rawId)]);
    if (productoId) await syncProductStock(productoId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting stock:", error);
    return NextResponse.json({ message: "No se pudo eliminar la ubicacion." }, { status: 500 });
  }
}

async function syncProductStock(productoId) {
  const [sumRows] = await pool.query(
    `SELECT COALESCE(SUM(stock), 0) AS usado FROM posventa_stock WHERE producto_id = ?`,
    [productoId]
  );
  const [productRows] = await pool.query(
    `SELECT stock_total FROM posventa_productos WHERE id = ?`,
    [productoId]
  );
  const usado = Number(sumRows[0]?.usado || 0);
  const total = Number(productRows[0]?.stock_total || 0);
  await pool.query(
    `UPDATE posventa_productos SET stock_usado = ?, stock_disponible = ? WHERE id = ?`,
    [usado, Math.max(total - usado, 0), productoId]
  );
}
