import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

function payload(body) {
  return { groupId: Number(body.groupId), clave: String(body.clave || "").trim(), valor: String(body.valor || "").trim(), orden: Number(body.orden || 0), isActive: body.isActive === undefined ? true : Boolean(body.isActive) };
}

export async function POST(request) {
  try {
    const data = payload(await request.json());
    if (!data.groupId || !data.clave) return NextResponse.json({ message: "Completa grupo y clave." }, { status: 400 });
    const [result] = await pool.query(
      `INSERT INTO ventas_precio_specs_item (group_id, clave, valor, orden, is_active) VALUES (?, ?, ?, ?, ?)`,
      [data.groupId, data.clave, data.valor, data.orden, data.isActive ? 1 : 0]
    );
    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating spec item:", error);
    return NextResponse.json({ message: "No se pudo crear la especificacion." }, { status: 500 });
  }
}
