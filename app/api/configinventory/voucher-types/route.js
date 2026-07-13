import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapVoucherType(row) {
  return {
    id: row.id,
    codigo: row.codigo || "",
    nombre: row.nombre || "",
    activeConfiguracion: Boolean(row.active_configuracion),
    activeVentaProductos: Boolean(row.active_venta_productos),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT id, codigo, nombre, active_configuracion, active_venta_productos, created_at, updated_at
       FROM configuracion_tipos_comprobante
       ORDER BY codigo ASC, nombre ASC`
    );

    return NextResponse.json({ voucherTypes: rows.map(mapVoucherType) });
  } catch (error) {
    console.error("Error loading voucher types:", error);
    return NextResponse.json({ message: "No se pudieron cargar los tipos de comprobante." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const codigo = String(body.codigo || "").trim().toUpperCase();
    const nombre = String(body.nombre || "").trim();
    const activeConfiguracion = body.activeConfiguracion ? 1 : 0;
    const activeVentaProductos = body.activeVentaProductos ? 1 : 0;

    if (!codigo || !nombre) {
      return NextResponse.json({ message: "Codigo y nombre son obligatorios." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion_tipos_comprobante
       (codigo, nombre, active_configuracion, active_venta_productos)
       VALUES (?, ?, ?, ?)`,
      [codigo, nombre, activeConfiguracion, activeVentaProductos]
    );

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating voucher type:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Ya existe un tipo de comprobante con ese codigo o nombre." }, { status: 409 });
    }
    return NextResponse.json({ message: "No se pudo crear el tipo de comprobante." }, { status: 500 });
  }
}
