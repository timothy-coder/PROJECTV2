import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const marcaId = Number(body.marcaId);
    const modeloId = Number(body.modeloId);
    const kilometraje = Number(body.kilometraje);
    const meses = Number(body.meses);
    const anios = Array.isArray(body.anios) ? body.anios : [];
    if (!marcaId || !modeloId || Number.isNaN(kilometraje) || !meses) {
      return NextResponse.json({ message: "Completa marca, modelo, kilometraje y meses." }, { status: 400 });
    }
    const [result] = await pool.query(
      `INSERT INTO administracion_algoritmo_visita (modelo_id, marca_id, kilometraje, meses, anios)
       VALUES (?, ?, ?, ?, ?)`,
      [modeloId, marcaId, kilometraje, meses, JSON.stringify(anios)]
    );
    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating maintenance algorithm:", error);
    return NextResponse.json({ message: "No se pudo crear la frecuencia." }, { status: 500 });
  }
}
