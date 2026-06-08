import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function normalizePayload(body) {
  return {
    productoId: Number(body.productoId || body.producto_id || 0),
    anio: Number(body.anio || body.year || 0),
    mes: Number(body.mes || body.month || 0),
    cantidad: Number(body.cantidad || 0),
  };
}

async function upsertSoldProduct(connection, payload) {
  const [existingRows] = await connection.query(
    `SELECT id, cantidad FROM posventa_productos_ventames
     WHERE producto_id = ? AND anio = ? AND mes = ?
     LIMIT 1`,
    [payload.productoId, payload.anio, payload.mes]
  );

  if (existingRows.length) {
    await connection.query(
      `UPDATE posventa_productos_ventames
       SET cantidad = ?
       WHERE id = ?`,
      [Number(existingRows[0].cantidad || 0) + payload.cantidad, existingRows[0].id]
    );
    return { id: existingRows[0].id, updated: true };
  }

  const [result] = await connection.query(
    `INSERT INTO posventa_productos_ventames (producto_id, anio, mes, cantidad)
     VALUES (?, ?, ?, ?)`,
    [payload.productoId, payload.anio, payload.mes, payload.cantidad]
  );
  return { id: result.insertId, updated: false };
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const payload = normalizePayload(await request.json());
    if (!payload.productoId || !payload.anio || payload.mes < 1 || payload.mes > 12) {
      return NextResponse.json({ message: "Producto, anio y mes son obligatorios." }, { status: 400 });
    }

    const [productRows] = await connection.query(`SELECT id FROM posventa_productos WHERE id = ? LIMIT 1`, [payload.productoId]);
    if (!productRows.length) {
      return NextResponse.json({ message: "Producto no encontrado." }, { status: 404 });
    }

    const result = await upsertSoldProduct(connection, payload);
    return NextResponse.json({ ok: true, id: result.id, updated: result.updated }, { status: result.updated ? 200 : 201 });
  } catch (error) {
    console.error("Error creating sold product:", error);
    return NextResponse.json({ message: "No se pudo guardar el producto vendido." }, { status: 500 });
  } finally {
    connection.release();
  }
}
