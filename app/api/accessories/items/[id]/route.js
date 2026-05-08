import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function payloadFromBody(body) {
  return {
    marcaId: Number(body.marcaId),
    modeloId: Number(body.modeloId),
    detalle: String(body.detalle || "").trim(),
    numeroParte: String(body.numeroParte || "").trim(),
    precio: Number(body.precio || 0),
    precioVenta: body.precioVenta === "" || body.precioVenta === null ? null : Number(body.precioVenta),
    impuestoId: body.impuestoId ? Number(body.impuestoId) : null,
    monedaId: Number(body.monedaId),
  };
}

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const payload = payloadFromBody(await request.json());
    if (!id || !payload.marcaId || !payload.modeloId || !payload.detalle || !payload.numeroParte || !payload.monedaId || Number.isNaN(payload.precio)) {
      return NextResponse.json({ message: "Accesorio invalido." }, { status: 400 });
    }

    await pool.query(
      `UPDATE ventas_accesorios_disponibles
       SET marca_id = ?, modelo_id = ?, detalle = ?, numero_parte = ?, precio = ?, precio_venta = ?, impuesto_id = ?, moneda_id = ?
       WHERE id = ?`,
      [payload.marcaId, payload.modeloId, payload.detalle, payload.numeroParte, payload.precio, payload.precioVenta, payload.impuestoId, payload.monedaId, id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating accessory:", error);
    return NextResponse.json({ message: "No se pudo actualizar el accesorio." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    await pool.query(`DELETE FROM ventas_accesorios_disponibles WHERE id = ?`, [Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting accessory:", error);
    return NextResponse.json({ message: "No se pudo eliminar el accesorio." }, { status: 500 });
  }
}
