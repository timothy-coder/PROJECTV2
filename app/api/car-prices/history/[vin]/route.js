import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function nullable(value) {
  if (value === "" || value === undefined || value === null) return null;
  return value;
}

function numberOrNull(value) {
  if (value === "" || value === undefined || value === null) return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

export async function PUT(request, { params }) {
  try {
    const { vin: rawVin } = await params;
    const vin = decodeURIComponent(rawVin || "").trim();
    const body = await request.json();
    const precioId = Number(body.precioId);
    if (!vin || !precioId) {
      return NextResponse.json({ message: "VIN y precio son obligatorios." }, { status: 400 });
    }

    const [result] = await pool.query(
      `UPDATE ventas_historial_carros
       SET precio_id = ?, color_externo = ?, color_interno = ?, numero_motor = ?, numerofactura = ?,
           preciocompra = ?, precioventa = ?, created_at_facturacion = ?, created_at_llegadaalcentro = ?,
           created_at_entrega = ?
       WHERE vin = ?`,
      [
        precioId,
        nullable(body.colorExterno),
        nullable(body.colorInterno),
        nullable(body.numeroMotor),
        nullable(body.numeroFactura),
        numberOrNull(body.precioCompra),
        numberOrNull(body.precioVenta),
        nullable(body.facturacionAt),
        nullable(body.llegadaCentroAt),
        nullable(body.entregaAt),
        vin,
      ]
    );

    if (!result.affectedRows) return NextResponse.json({ message: "Carro no encontrado en inventario." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating car history:", error);
    return NextResponse.json({ message: "No se pudo actualizar el carro en inventario." }, { status: 500 });
  }
}
