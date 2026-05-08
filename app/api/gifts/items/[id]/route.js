import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function payloadFromBody(body) {
  return {
    detalle: String(body.detalle || "").trim(),
    lote: String(body.lote || "").trim() || null,
    precioCompra: Number(body.precioCompra || 0),
    precioVenta: body.precioVenta === "" || body.precioVenta === null ? null : Number(body.precioVenta),
    impuestoId: body.impuestoId ? Number(body.impuestoId) : null,
    regaloTienda: body.regaloTienda ? 1 : 0,
    monedaId: Number(body.monedaId),
  };
}

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const payload = payloadFromBody(await request.json());
    if (!id || !payload.detalle || !payload.monedaId || Number.isNaN(payload.precioCompra)) {
      return NextResponse.json({ message: "Regalo invalido." }, { status: 400 });
    }

    await pool.query(
      `UPDATE ventas_regalos_disponibles
       SET detalle = ?, lote = ?, precio_compra = ?, precio_venta = ?, impuesto_id = ?, regalo_tienda = ?, moneda_id = ?
       WHERE id = ?`,
      [payload.detalle, payload.lote, payload.precioCompra, payload.precioVenta, payload.impuestoId, payload.regaloTienda, payload.monedaId, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating gift:", error);
    return NextResponse.json({ message: "No se pudo actualizar el regalo." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM ventas_regalos_disponibles WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting gift:", error);
    return NextResponse.json({ message: "No se pudo eliminar el regalo." }, { status: 500 });
  }
}
