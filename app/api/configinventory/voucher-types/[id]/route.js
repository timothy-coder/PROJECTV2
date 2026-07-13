import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const codigo = String(body.codigo || "").trim().toUpperCase();
    const nombre = String(body.nombre || "").trim();
    const activeConfiguracion = body.activeConfiguracion ? 1 : 0;
    const activeVentaProductos = body.activeVentaProductos ? 1 : 0;

    if (!id || !codigo || !nombre) {
      return NextResponse.json({ message: "Tipo de comprobante invalido." }, { status: 400 });
    }

    await pool.query(
      `UPDATE configuracion_tipos_comprobante
       SET codigo = ?, nombre = ?, active_configuracion = ?, active_venta_productos = ?
       WHERE id = ?`,
      [codigo, nombre, activeConfiguracion, activeVentaProductos, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating voucher type:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Ya existe un tipo de comprobante con ese codigo o nombre." }, { status: 409 });
    }
    return NextResponse.json({ message: "No se pudo actualizar el tipo de comprobante." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!id) {
      return NextResponse.json({ message: "Tipo de comprobante invalido." }, { status: 400 });
    }

    await pool.query(`DELETE FROM configuracion_tipos_comprobante WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting voucher type:", error);
    return NextResponse.json({ message: "No se pudo eliminar el tipo de comprobante." }, { status: 500 });
  }
}
