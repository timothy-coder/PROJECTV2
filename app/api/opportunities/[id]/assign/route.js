import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const body = await request.json();
    await pool.query(`UPDATE ventas_oportunidades SET asignado_a=? WHERE id=?`, [body.asignadoA ? Number(body.asignadoA) : null, Number(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error assigning opportunity:", error);
    return NextResponse.json({ message: "No se pudo asignar la oportunidad." }, { status: 500 });
  }
}
