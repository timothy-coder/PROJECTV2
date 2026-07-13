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
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!id) {
      return NextResponse.json({ message: "Evento invalido." }, { status: 400 });
    }

    const body = await request.json();
    const [result] = await pool.query(
      `UPDATE ventas_historial_carros_eventos
       SET numero_factura = ?,
           fecha_facturacion = ?,
           fecha_entrega_cliente = ?,
           fecha_entrega_placa = ?,
           placa = ?,
           kilometraje = ?,
           observacion = ?
       WHERE id = ?`,
      [
        nullable(body.numeroFactura),
        nullable(body.facturacionAt),
        nullable(body.entregaAt),
        nullable(body.entregaPlacaAt),
        nullable(body.placa),
        numberOrNull(body.kilometraje),
        nullable(body.observacion),
        id,
      ]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Evento de entrega no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating delivered car event:", error);
    return NextResponse.json({ message: "No se pudo actualizar el evento de entrega." }, { status: 500 });
  }
}
