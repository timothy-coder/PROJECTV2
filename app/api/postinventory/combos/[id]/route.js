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

export async function PUT(request, { params }) {
  const connection = await pool.getConnection();
  try {
    const id = Number(params.id);
    const body = await request.json();
    const codigo = String(body.codigo || "").trim() || null;
    const nombre = String(body.nombre || "").trim();
    const descripcion = String(body.descripcion || "").trim() || null;
    const isActive = body.isActive === false || body.is_active === 0 ? 0 : 1;
    const items = normalizeItems(body.items);

    if (!id) return NextResponse.json({ message: "Combo invalido." }, { status: 400 });
    if (!nombre) return NextResponse.json({ message: "El nombre del combo es obligatorio." }, { status: 400 });
    if (!items.length) return NextResponse.json({ message: "Agrega al menos un producto al combo." }, { status: 400 });

    await connection.beginTransaction();
    await connection.query(
      `UPDATE posventa_combos
       SET codigo = ?, nombre = ?, descripcion = ?, is_active = ?
       WHERE id = ?`,
      [codigo, nombre, descripcion, isActive, id]
    );
    await connection.query(`DELETE FROM posventa_combo_items WHERE combo_id = ?`, [id]);
    await connection.query(
      `INSERT INTO posventa_combo_items (combo_id, producto_id, cantidad)
       VALUES ${items.map(() => "(?, ?, ?)").join(", ")}`,
      items.flatMap((item) => [id, item.productoId, item.cantidad])
    );
    await connection.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating combo:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Ya existe un combo con ese codigo o producto repetido." }, { status: 409 });
    }
    return NextResponse.json({ message: "No se pudo actualizar el combo." }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function DELETE(_request, { params }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ message: "Combo invalido." }, { status: 400 });
    await pool.query(`DELETE FROM posventa_combos WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting combo:", error);
    return NextResponse.json({ message: "No se pudo eliminar el combo." }, { status: 500 });
  }
}
