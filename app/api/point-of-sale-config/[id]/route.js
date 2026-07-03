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

export async function PUT(request, { params }) {
  try {
    const allowed = await requirePermission("edit");
    if (allowed.error) return allowed.error;
    await ensureTable();

    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const codigo = String(body.codigo || "").trim();
    const nombre = String(body.nombre || "").trim();
    const centroId = body.centroId ? Number(body.centroId) : null;
    const mostradorId = body.mostradorId ? Number(body.mostradorId) : null;
    const descripcion = String(body.descripcion || "").trim() || null;
    const activo = body.activo === false ? 0 : 1;

    if (!id || !codigo || !nombre) return NextResponse.json({ message: "Punto de venta invalido." }, { status: 400 });

    const [result] = await pool.query(
      `UPDATE configuracion_puntos_venta
       SET codigo=?, nombre=?, centro_id=?, mostrador_id=?, descripcion=?, activo=?
       WHERE id=?`,
      [codigo, nombre, centroId, mostradorId, descripcion, activo, id]
    );
    if (!result.affectedRows) return NextResponse.json({ message: "Punto de venta no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating point of sale config:", error);
    return NextResponse.json({ message: error?.code === "ER_DUP_ENTRY" ? "Ya existe un punto de venta con ese codigo." : "No se pudo actualizar el punto de venta." }, { status: error?.code === "ER_DUP_ENTRY" ? 409 : 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const allowed = await requirePermission("delete");
    if (allowed.error) return allowed.error;
    await ensureTable();

    const { id: rawId } = await params;
    const [result] = await pool.query(`DELETE FROM configuracion_puntos_venta WHERE id=?`, [Number(rawId)]);
    if (!result.affectedRows) return NextResponse.json({ message: "Punto de venta no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting point of sale config:", error);
    return NextResponse.json({ message: "No se pudo eliminar el punto de venta." }, { status: 500 });
  }
}
