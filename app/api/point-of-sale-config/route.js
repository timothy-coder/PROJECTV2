import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

async function ensureTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS configuracion_puntos_venta (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      codigo VARCHAR(30) NOT NULL,
      nombre VARCHAR(120) NOT NULL,
      centro_id INT NULL DEFAULT NULL,
      mostrador_id INT NULL DEFAULT NULL,
      descripcion VARCHAR(255) NULL DEFAULT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_punto_venta_codigo (codigo),
      KEY idx_punto_venta_centro (centro_id),
      KEY idx_punto_venta_mostrador (mostrador_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`
  );
}

async function requirePermission(action) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["config_puntoventa", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para configurar Punto de Venta." }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  try {
    const allowed = await requirePermission("view");
    if (allowed.error) return allowed.error;
    await ensureTable();

    const [rows] = await pool.query(
      `SELECT pv.id, pv.codigo, pv.nombre, pv.centro_id, pv.mostrador_id, pv.descripcion, pv.activo,
              c.nombre AS centro_nombre, m.nombre AS mostrador_nombre
       FROM configuracion_puntos_venta pv
       LEFT JOIN configuracion_centros c ON c.id = pv.centro_id
       LEFT JOIN configuracion_mostradores m ON m.id = pv.mostrador_id
       ORDER BY pv.nombre ASC`
    );
    const [centers] = await pool.query(`SELECT id, nombre FROM configuracion_centros ORDER BY nombre ASC`);
    const [counters] = await pool.query(`SELECT id, centro_id, nombre FROM configuracion_mostradores ORDER BY nombre ASC`);

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        codigo: row.codigo,
        nombre: row.nombre,
        centroId: row.centro_id,
        mostradorId: row.mostrador_id,
        descripcion: row.descripcion || "",
        centroNombre: row.centro_nombre || "",
        mostradorNombre: row.mostrador_nombre || "",
        activo: Boolean(row.activo),
      })),
      options: {
        centers: centers.map((row) => ({ id: row.id, nombre: row.nombre })),
        counters: counters.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
      },
    });
  } catch (error) {
    console.error("Error loading point of sale config:", error);
    return NextResponse.json({ message: "No se pudo cargar configuracion de Punto de Venta." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const allowed = await requirePermission("create");
    if (allowed.error) return allowed.error;
    await ensureTable();

    const body = await request.json();
    const codigo = String(body.codigo || "").trim();
    const nombre = String(body.nombre || "").trim();
    const centroId = body.centroId ? Number(body.centroId) : null;
    const mostradorId = body.mostradorId ? Number(body.mostradorId) : null;
    const descripcion = String(body.descripcion || "").trim() || null;
    const activo = body.activo === false ? 0 : 1;

    if (!codigo || !nombre) return NextResponse.json({ message: "Codigo y nombre son obligatorios." }, { status: 400 });

    const [result] = await pool.query(
      `INSERT INTO configuracion_puntos_venta (codigo, nombre, centro_id, mostrador_id, descripcion, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [codigo, nombre, centroId, mostradorId, descripcion, activo]
    );
    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating point of sale config:", error);
    return NextResponse.json({ message: error?.code === "ER_DUP_ENTRY" ? "Ya existe un punto de venta con ese codigo." : "No se pudo crear el punto de venta." }, { status: error?.code === "ER_DUP_ENTRY" ? 409 : 500 });
  }
}
