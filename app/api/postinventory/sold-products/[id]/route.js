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

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const payload = normalizePayload(await request.json());
    if (!id || !payload.productoId || !payload.anio || payload.mes < 1 || payload.mes > 12) {
      return NextResponse.json({ message: "Registro invalido." }, { status: 400 });
    }

    const [productRows] = await pool.query(`SELECT id FROM posventa_productos WHERE id = ? LIMIT 1`, [payload.productoId]);
    if (!productRows.length) {
      return NextResponse.json({ message: "Producto no encontrado." }, { status: 404 });
    }

    await pool.query(
      `UPDATE posventa_productos_ventames
       SET producto_id = ?, anio = ?, mes = ?, cantidad = ?
       WHERE id = ?`,
      [payload.productoId, payload.anio, payload.mes, payload.cantidad, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating sold product:", error);
    return NextResponse.json({ message: "No se pudo actualizar el producto vendido." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM posventa_productos_ventames WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting sold product:", error);
    return NextResponse.json({ message: "No se pudo eliminar el producto vendido." }, { status: 500 });
  }
}
