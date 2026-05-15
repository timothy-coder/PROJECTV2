import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function can(user, action) {
  const permissions = user?.permissions || {};
  return hasPerm(permissions, ["config_ventas_plantillas", action]) || hasPerm(permissions, ["configagenda", action]);
}

function mapElement(row) {
  return {
    id: row.id,
    seccionId: row.seccion_id,
    tipo: row.tipo,
    texto: row.texto || "",
    url: row.url || "",
    imagenPath: row.imagen_path || "",
    orden: row.orden ?? 0,
    align: row.align || "LEFT",
    widthPx: row.width_px,
    heightPx: row.height_px,
    isActive: Boolean(row.is_active),
  };
}

export async function GET(request) {
  const user = await getCurrentUser();
  const requestedType = request.nextUrl.searchParams.get("tipoDocumento");
  const activeOnly = request.nextUrl.searchParams.get("active") === "1";
  const canUseReservationTemplate = requestedType === "RESERVA" && (hasPerm(user?.permissions || {}, ["reservas", "view"]) || hasPerm(user?.permissions || {}, ["reservas", "viewall"]));
  if (!can(user, "view") && !canUseReservationTemplate) return NextResponse.json({ message: "No tienes permiso para ver plantillas." }, { status: 403 });

  try {
    const [templates] = await pool.query(
      `SELECT id, tipo_documento, nombre, descripcion, is_active, created_at, updated_at
       FROM configuracion_ventas_documento_plantillas
       ${requestedType ? "WHERE tipo_documento=? " : ""}
       ${requestedType && activeOnly ? "AND is_active=1 " : !requestedType && activeOnly ? "WHERE is_active=1 " : ""}
       ORDER BY tipo_documento ASC, nombre ASC`
      ,
      requestedType ? [requestedType] : []
    );
    const ids = templates.map((item) => item.id);
    if (!ids.length) return NextResponse.json({ templates: [] });

    const [sections] = await pool.query(
      `SELECT id, plantilla_id, tipo, nombre, orden, is_active
       FROM configuracion_ventas_documento_plantilla_secciones
       WHERE plantilla_id IN (?)
       ORDER BY plantilla_id ASC, tipo ASC, orden ASC, id ASC`,
      [ids]
    );
    const sectionIds = sections.map((item) => item.id);
    const [elements] = sectionIds.length
      ? await pool.query(
          `SELECT id, seccion_id, tipo, texto, url, imagen_path, orden, align, width_px, height_px, is_active
           FROM configuracion_ventas_documento_plantilla_elementos
           WHERE seccion_id IN (?)
           ORDER BY seccion_id ASC, orden ASC, id ASC`,
          [sectionIds]
        )
      : [[]];
    const [watermarks] = await pool.query(
      `SELECT plantilla_id, imagen_path, opacity, rotate_deg, scale
       FROM configuracion_ventas_documento_plantilla_marca_agua
       WHERE plantilla_id IN (?)`,
      [ids]
    );

    const elementsBySection = new Map();
    elements.forEach((row) => {
      const list = elementsBySection.get(row.seccion_id) || [];
      list.push(mapElement(row));
      elementsBySection.set(row.seccion_id, list);
    });
    const sectionsByTemplate = new Map();
    sections.forEach((row) => {
      const list = sectionsByTemplate.get(row.plantilla_id) || [];
      list.push({
        id: row.id,
        plantillaId: row.plantilla_id,
        tipo: row.tipo,
        nombre: row.nombre || "",
        orden: row.orden ?? 0,
        isActive: Boolean(row.is_active),
        elementos: elementsBySection.get(row.id) || [],
      });
      sectionsByTemplate.set(row.plantilla_id, list);
    });
    const watermarkByTemplate = new Map(
      watermarks.map((row) => [
        row.plantilla_id,
        {
          imagenPath: row.imagen_path,
          opacity: Number(row.opacity ?? 0.15),
          rotateDeg: row.rotate_deg ?? 0,
          scale: Number(row.scale ?? 1),
        },
      ])
    );

    return NextResponse.json({
      templates: templates.map((row) => ({
        id: row.id,
        tipoDocumento: row.tipo_documento,
        nombre: row.nombre,
        descripcion: row.descripcion || "",
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        secciones: sectionsByTemplate.get(row.id) || [],
        marcaAgua: watermarkByTemplate.get(row.id) || null,
      })),
    });
  } catch (error) {
    console.error("Error loading sales document templates:", error);
    return NextResponse.json({ message: "No se pudo cargar plantillas." }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!can(user, "create")) return NextResponse.json({ message: "No tienes permiso para crear plantillas." }, { status: 403 });

  try {
    const body = await request.json();
    const [result] = await pool.query(
      `INSERT INTO configuracion_ventas_documento_plantillas (tipo_documento, nombre, descripcion, is_active)
       VALUES (?, ?, ?, ?)`,
      [body.tipoDocumento, body.nombre, body.descripcion || null, body.isActive ? 1 : 0]
    );
    await ensureDefaultSections(result.insertId);
    return NextResponse.json({ id: result.insertId });
  } catch (error) {
    console.error("Error creating sales document template:", error);
    return NextResponse.json({ message: "No se pudo crear la plantilla." }, { status: 500 });
  }
}

async function ensureDefaultSections(templateId) {
  await pool.query(
    `INSERT INTO configuracion_ventas_documento_plantilla_secciones (plantilla_id, tipo, nombre, orden, is_active)
     VALUES (?, 'ENCABEZADO', 'Encabezado', 1, 1), (?, 'PIE', 'Pie de pagina', 2, 1)`,
    [templateId, templateId]
  );
}
