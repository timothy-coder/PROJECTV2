import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function can(user, action) {
  const permissions = user?.permissions || {};
  return hasPerm(permissions, ["config_ventas_plantillas", action]) || hasPerm(permissions, ["configagenda", action]);
}

export async function POST(request) {
  const user = await getCurrentUser();
  const body = await request.json();
  const action = body.action || "save";
  const required = action === "delete-template" || action === "delete-element" ? "delete" : "edit";
  if (!can(user, required)) return NextResponse.json({ message: "No tienes permiso para modificar plantillas." }, { status: 403 });

  try {
    if (action === "save-template") await saveTemplate(body);
    if (action === "delete-template") await pool.query(`DELETE FROM configuracion_ventas_documento_plantillas WHERE id=?`, [Number(body.id)]);
    if (action === "save-section") await saveSection(body);
    if (action === "save-element") await saveElement(body);
    if (action === "delete-element") await pool.query(`DELETE FROM configuracion_ventas_documento_plantilla_elementos WHERE id=?`, [Number(body.id)]);
    if (action === "save-watermark") await saveWatermark(body);
    if (action === "delete-watermark") await pool.query(`DELETE FROM configuracion_ventas_documento_plantilla_marca_agua WHERE plantilla_id=?`, [Number(body.plantillaId)]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving sales document template item:", error);
    return NextResponse.json({ message: "No se pudo guardar la plantilla." }, { status: 500 });
  }
}

async function saveTemplate(body) {
  await pool.query(
    `UPDATE configuracion_ventas_documento_plantillas
     SET tipo_documento=?, nombre=?, descripcion=?, is_active=?
     WHERE id=?`,
    [body.tipoDocumento, body.nombre, body.descripcion || null, body.isActive ? 1 : 0, Number(body.id)]
  );
}

async function saveSection(body) {
  await pool.query(
    `UPDATE configuracion_ventas_documento_plantilla_secciones
     SET nombre=?, orden=?, is_active=?
     WHERE id=?`,
    [body.nombre || null, Number(body.orden || 0), body.isActive ? 1 : 0, Number(body.id)]
  );
}

async function saveElement(body) {
  if (body.id) {
    await pool.query(
      `UPDATE configuracion_ventas_documento_plantilla_elementos
       SET tipo=?, texto=?, url=?, imagen_path=?, orden=?, align=?, width_px=?, height_px=?, is_active=?
       WHERE id=?`,
      [
        body.tipo,
        body.texto || null,
        body.url || null,
        body.imagenPath || null,
        Number(body.orden || 0),
        body.align || "LEFT",
        body.widthPx ? Number(body.widthPx) : null,
        body.heightPx ? Number(body.heightPx) : null,
        body.isActive ? 1 : 0,
        Number(body.id),
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO configuracion_ventas_documento_plantilla_elementos
       (seccion_id, tipo, texto, url, imagen_path, orden, align, width_px, height_px, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(body.seccionId),
        body.tipo,
        body.texto || null,
        body.url || null,
        body.imagenPath || null,
        Number(body.orden || 0),
        body.align || "LEFT",
        body.widthPx ? Number(body.widthPx) : null,
        body.heightPx ? Number(body.heightPx) : null,
        body.isActive ? 1 : 0,
      ]
    );
  }
}

async function saveWatermark(body) {
  await pool.query(
    `INSERT INTO configuracion_ventas_documento_plantilla_marca_agua
     (plantilla_id, imagen_path, opacity, rotate_deg, scale)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE imagen_path=VALUES(imagen_path), opacity=VALUES(opacity), rotate_deg=VALUES(rotate_deg), scale=VALUES(scale)`,
    [Number(body.plantillaId), body.imagenPath, Number(body.opacity || 0.15), Number(body.rotateDeg || 0), Number(body.scale || 1)]
  );
}
