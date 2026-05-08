import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const marcaId = Number(body.marcaId);
    const claseId = body.claseId ? Number(body.claseId) : null;
    const name = String(body.name || "").trim();
    const anios = Array.isArray(body.anios) ? body.anios : [];
    if (!marcaId || !name) return NextResponse.json({ message: "Marca y modelo son obligatorios." }, { status: 400 });
    const [result] = await pool.query(
      `INSERT INTO administracion_modelos (marca_id, clase_id, name, anios) VALUES (?, ?, ?, ?)`,
      [marcaId, claseId, name, JSON.stringify(anios)]
    );
    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating model:", error);
    return NextResponse.json({ message: "No se pudo crear el modelo." }, { status: 500 });
  }
}
