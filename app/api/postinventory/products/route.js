import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const numeroParte = String(body.numeroParte || "").trim();
    const descripcion = String(body.descripcion || "").trim();
    const tipoId = body.tipoId ? Number(body.tipoId) : null;
    const fechaIngreso = body.fechaIngreso || null;
    const stockTotal = Number(body.stockTotal || 0);
    const precioCompra = Number(body.precioCompra || 0);
    const precioVenta = Number(body.precioVenta || 0);

    if (!numeroParte || !descripcion) {
      return NextResponse.json({ message: "Numero de parte y descripcion son obligatorios." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO posventa_productos
       (numero_parte, descripcion, tipo_inventario_id, fecha_ingreso, stock_total, stock_usado, stock_disponible, precio_compra, precio_venta)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [numeroParte, descripcion, tipoId, fechaIngreso, stockTotal, stockTotal, precioCompra, precioVenta]
    );

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Ya existe un producto con ese numero de parte." }, { status: 409 });
    }
    return NextResponse.json({ message: "No se pudo crear el producto." }, { status: 500 });
  }
}
