import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ message: "El nombre es obligatorio." }, { status: 400 });
    const [result] = await pool.query(`INSERT INTO administracion_clases (name) VALUES (?)`, [name]);
    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating class:", error);
    return NextResponse.json({ message: "No se pudo crear la clase." }, { status: 500 });
  }
}
