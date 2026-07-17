import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function mapPoint(row) {
  return {
    id: row.id,
    lat: Number(row.latitud),
    lng: Number(row.longitud),
    accuracy: row.precision_metros === null ? null : Number(row.precision_metros),
    speed: row.velocidad === null ? null : Number(row.velocidad),
    heading: row.heading === null ? null : Number(row.heading),
    capturedAt: row.capturado_at,
  };
}

async function routeTrackingEnabled(connection) {
  const [rows] = await connection.query(
    `SELECT activar_ruta_testdrive
     FROM configuracion_testdrive
     ORDER BY id ASC
     LIMIT 1`
  );
  return Boolean(rows[0]?.activar_ruta_testdrive);
}

export async function GET(_request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const testdriveId = Number(id);
  if (!testdriveId) return NextResponse.json({ message: "Test drive invalido." }, { status: 400 });
  const connection = await pool.getConnection();
  try {
    if (!(await routeTrackingEnabled(connection))) {
      return NextResponse.json({ message: "La ruta de test drive no esta activa." }, { status: 403 });
    }
    const [[testdrive]] = await connection.query(`SELECT id FROM ventas_oportunidades_test_drives WHERE id=? LIMIT 1`, [testdriveId]);
    if (!testdrive) return NextResponse.json({ message: "Test drive no encontrado." }, { status: 404 });
    const [rows] = await connection.query(
      `SELECT id, latitud, longitud, precision_metros, velocidad, heading, capturado_at
       FROM ventas_testdrive_ruta_puntos
       WHERE testdrive_id=?
       ORDER BY capturado_at ASC, id ASC`,
      [testdriveId]
    );
    return NextResponse.json({ points: rows.map(mapPoint) });
  } catch (error) {
    console.error("Error loading test drive route points:", error);
    return NextResponse.json({ message: "No se pudo cargar la ruta." }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const testdriveId = Number(id);
  if (!testdriveId) return NextResponse.json({ message: "Test drive invalido." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ message: "Coordenadas invalidas." }, { status: 400 });
  }
  const connection = await pool.getConnection();
  try {
    if (!(await routeTrackingEnabled(connection))) {
      return NextResponse.json({ message: "La ruta de test drive no esta activa." }, { status: 403 });
    }
    const [[testdrive]] = await connection.query(`SELECT id FROM ventas_oportunidades_test_drives WHERE id=? LIMIT 1`, [testdriveId]);
    if (!testdrive) return NextResponse.json({ message: "Test drive no encontrado." }, { status: 404 });
    await connection.query(
      `INSERT INTO ventas_testdrive_ruta_puntos
       (testdrive_id, latitud, longitud, precision_metros, velocidad, heading, capturado_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        testdriveId,
        lat,
        lng,
        body.accuracy === undefined || body.accuracy === null ? null : Number(body.accuracy),
        body.speed === undefined || body.speed === null ? null : Number(body.speed),
        body.heading === undefined || body.heading === null ? null : Number(body.heading),
        body.capturedAt ? new Date(body.capturedAt) : new Date(),
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving test drive route point:", error);
    return NextResponse.json({ message: "No se pudo guardar la ubicacion." }, { status: 500 });
  } finally {
    connection.release();
  }
}
