import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const productoId = Number(body.productoId);
    const centroId = Number(body.centroId);
    const tallerId = body.tallerId ? Number(body.tallerId) : null;
    const mostradorId = body.mostradorId ? Number(body.mostradorId) : null;
    const stock = Number(body.stock || 0);

    if (!productoId || !centroId || Number.isNaN(stock) || (tallerId && mostradorId)) {
      return NextResponse.json({ message: "Ubicacion o stock invalido." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO posventa_stock (producto_id, centro_id, taller_id, mostrador_id, stock)
       VALUES (?, ?, ?, ?, ?)`,
      [productoId, centroId, tallerId, mostradorId, stock]
    );
    await syncProductStock(productoId);

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating stock:", error);
    return NextResponse.json({ message: "No se pudo crear la ubicacion." }, { status: 500 });
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
