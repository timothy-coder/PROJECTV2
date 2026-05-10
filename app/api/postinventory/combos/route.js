import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function normalizeItems(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      productoId: Number(item.productoId || item.producto_id || 0),
      cantidad: Math.max(1, Number(item.cantidad || 1)),
    }))
    .filter((item) => {
      if (!item.productoId || seen.has(item.productoId)) return false;
      seen.add(item.productoId);
      return true;
    });
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const body = await request.json();
    const codigo = String(body.codigo || "").trim() || null;
    const nombre = String(body.nombre || "").trim();
    const descripcion = String(body.descripcion || "").trim() || null;
    const isActive = body.isActive === false || body.is_active === 0 ? 0 : 1;
    const items = normalizeItems(body.items);

    if (!nombre) {
      return NextResponse.json({ message: "El nombre del combo es obligatorio." }, { status: 400 });
    }
    if (!items.length) {
      return NextResponse.json({ message: "Agrega al menos un producto al combo." }, { status: 400 });
    }

    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO posventa_combos (codigo, nombre, descripcion, is_active)
       VALUES (?, ?, ?, ?)`,
      [codigo, nombre, descripcion, isActive]
    );
    const comboId = result.insertId;
    await connection.query(
      `INSERT INTO posventa_combo_items (combo_id, producto_id, cantidad)
       VALUES ${items.map(() => "(?, ?, ?)").join(", ")}`,
      items.flatMap((item) => [comboId, item.productoId, item.cantidad])
    );
    await connection.commit();

    return NextResponse.json({ ok: true, id: comboId }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating combo:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Ya existe un combo con ese codigo o producto repetido." }, { status: 409 });
    }
    return NextResponse.json({ message: "No se pudo crear el combo." }, { status: 500 });
  } finally {
    connection.release();
  }
}
