import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.vin || !body.precioId) {
      return NextResponse.json({ message: "VIN y precio son obligatorios." }, { status: 400 });
    }
    await pool.query(
      `INSERT INTO ventas_historial_carros
       (vin, precio_id, color_externo, color_interno, numero_motor, numerofactura, preciocompra, precioventa, created_at_facturacion, created_at_llegadaalcentro, created_at_entrega)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(body.vin).trim(),
        Number(body.precioId),
        body.colorExterno || null,
        body.colorInterno || null,
        body.numeroMotor || null,
        body.numeroFactura || null,
        body.precioCompra === "" || body.precioCompra === undefined ? null : Number(body.precioCompra),
        body.precioVenta === "" || body.precioVenta === undefined ? null : Number(body.precioVenta),
        body.facturacionAt || null,
        body.llegadaCentroAt || null,
        body.entregaAt || null,
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error creating car history:", error);
    return NextResponse.json({ message: "No se pudo crear el carro en historial." }, { status: 500 });
  }
}
