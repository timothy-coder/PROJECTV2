import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.query(`SELECT id, dias FROM configuracion_prospeccion_frecuencia ORDER BY dias ASC`);
    return NextResponse.json({ frequencies: rows.map((row) => ({ id: row.id, dias: row.dias })) });
  } catch (error) {
    console.error("Error loading prospection frequencies:", error);
    return NextResponse.json({ message: "No se pudieron cargar las frecuencias." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const dias = Number(body.dias);
    if (!dias || dias < 1) return NextResponse.json({ message: "Dias invalido." }, { status: 400 });
    const [result] = await pool.query(`INSERT INTO configuracion_prospeccion_frecuencia (dias) VALUES (?)`, [dias]);
    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating prospection frequency:", error);
    return NextResponse.json({ message: "No se pudo crear la frecuencia." }, { status: 500 });
  }
}
