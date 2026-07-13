import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

async function getDefaultCurrencyId() {
  const [[configured]] = await pool.query(
    `SELECT moneda_id
     FROM configuracion_posventa_monedas
     WHERE is_active = 1
     ORDER BY id ASC
     LIMIT 1`
  );
  if (configured?.moneda_id) return Number(configured.moneda_id);
  const [[fallback]] = await pool.query(
    `SELECT id
     FROM configuracion_monedas
     WHERE is_active = 1
     ORDER BY codigo ASC
     LIMIT 1`
  );
  return fallback?.id ? Number(fallback.id) : null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const numeroParte = String(body.numeroParte || "").trim();
    const descripcion = String(body.descripcion || "").trim();
    const marca = String(body.marca || "").trim() || null;
    const procedencia = String(body.procedencia || "").trim() || null;
    const tipoId = body.tipoId ? Number(body.tipoId) : null;
    const fechaIngreso = body.fechaIngreso || null;
    const stockTotal = Number(body.stockTotal || 0);
    const precioVenta = Number(body.precioVenta || 0);
    const monedaId = body.monedaId ? Number(body.monedaId) : await getDefaultCurrencyId();

    if (!numeroParte || !descripcion) {
      return NextResponse.json({ message: "Numero de parte y descripcion son obligatorios." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO posventa_productos
       (numero_parte, descripcion, marca, procedencia, tipo_inventario_id, fecha_ingreso, stock_total, stock_usado, stock_disponible, precio_compra, precio_venta, moneda_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [numeroParte, descripcion, marca, procedencia, tipoId, fechaIngreso, stockTotal, stockTotal, 0, precioVenta, monedaId]
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
