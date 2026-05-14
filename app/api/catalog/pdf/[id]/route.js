import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";

import { decodeSpecValue } from "@/app/api/catalog/valueUtils";
import { pool } from "@/lib/db";

export async function GET(_request, { params }) {
  const { id } = await params;
  const priceId = Number(id);
  if (!priceId) return NextResponse.json({ message: "Ficha invalida." }, { status: 400 });

  try {
    const data = await loadCatalogData(priceId);
    if (!data.price) return NextResponse.json({ message: "Ficha no encontrada." }, { status: 404 });

    const pdf = await buildPdf(data);

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ficha-tecnica-${priceId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error generating catalog PDF:", error);
    return NextResponse.json({ message: "No se pudo generar el PDF." }, { status: 500 });
  }
}

async function loadCatalogData(priceId) {
  const [[price]] = await pool.query(
    `SELECT p.id, p.version, p.precio_base, ma.name AS marca, mo.name AS modelo, mon.simbolo AS simbolo
     FROM ventas_precios p
     INNER JOIN administracion_marcas ma ON ma.id = p.marca_id
     INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id
     INNER JOIN configuracion_monedas mon ON mon.id = p.moneda_id
     WHERE p.id = ? LIMIT 1`,
    [priceId]
  );
  if (!price) return { price: null };

  const [groups] = await pool.query(
    `SELECT id, nombre, orden FROM ventas_precio_specs_group WHERE precio_id=? AND is_active=1 ORDER BY orden ASC, nombre ASC`,
    [priceId]
  );
  const [items] = await pool.query(
    `SELECT i.group_id, i.clave, i.valor, i.orden FROM ventas_precio_specs_item i
     INNER JOIN ventas_precio_specs_group g ON g.id = i.group_id
     WHERE g.precio_id=? AND i.is_active=1 ORDER BY i.orden ASC, i.clave ASC`,
    [priceId]
  );
  const itemsByGroup = items.reduce((acc, item) => {
    acc[item.group_id] = acc[item.group_id] || [];
    acc[item.group_id].push({ ...item, ...decodeSpecValue(item.valor) });
    return acc;
  }, {});

  return { price, groups, itemsByGroup, template: await loadTemplate() };
}

async function loadTemplate() {
  const [[template]] = await pool.query(
    `SELECT id FROM configuracion_ventas_documento_plantillas
     WHERE tipo_documento='FICHA_TECNICA' AND is_active=1
     ORDER BY updated_at DESC, id DESC LIMIT 1`
  );
  if (!template) return null;

  const [sections] = await pool.query(
    `SELECT id, tipo, nombre, orden FROM configuracion_ventas_documento_plantilla_secciones
     WHERE plantilla_id=? AND is_active=1 ORDER BY orden ASC, id ASC`,
    [template.id]
  );
  const sectionIds = sections.map((section) => section.id);
  const [elements] = sectionIds.length
    ? await pool.query(
        `SELECT id, seccion_id, tipo, texto, url, imagen_path, orden, align, width_px, height_px
         FROM configuracion_ventas_documento_plantilla_elementos
         WHERE seccion_id IN (?) AND is_active=1 ORDER BY orden ASC, id ASC`,
        [sectionIds]
      )
    : [[]];
  const [[watermark]] = await pool.query(
    `SELECT imagen_path, opacity, rotate_deg, scale
     FROM configuracion_ventas_documento_plantilla_marca_agua
     WHERE plantilla_id=? LIMIT 1`,
    [template.id]
  );

  const bySection = elements.reduce((acc, element) => {
    acc[element.seccion_id] = acc[element.seccion_id] || [];
    acc[element.seccion_id].push({
      id: element.id,
      tipo: element.tipo,
      texto: element.texto || "",
      url: element.url || "",
      imagenPath: element.imagen_path || "",
      orden: element.orden ?? 0,
      align: element.align || "LEFT",
      widthPx: element.width_px,
      heightPx: element.height_px,
    });
    return acc;
  }, {});

  const mapped = sections.map((section) => ({ ...section, elementos: bySection[section.id] || [] }));
  return {
    header: mapped.find((section) => section.tipo === "ENCABEZADO"),
    footer: mapped.find((section) => section.tipo === "PIE"),
    watermark,
  };
}

async function buildPdf({ price, groups, itemsByGroup, template }) {
  const doc = new PDFDocument({ size: "A4", margin: 36, bufferPages: true });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  drawWatermark(doc, template?.watermark);
  drawTemplateSection(doc, template?.header);

  doc.moveDown(0.6);
  doc.roundedRect(36, doc.y, 523, 92, 8).dash(3, { space: 3 }).strokeColor("#c4b5fd").stroke().undash();
  doc.moveDown(0.8);
  doc.fillColor("#6d28d9").fontSize(9).font("Helvetica-Bold").text("FICHA TECNICA VEHICULAR", 52, doc.y);
  doc.fillColor("#0f172a").fontSize(22).font("Helvetica-Bold").text(`${price.marca} ${price.modelo}`, 52, doc.y + 4);
  doc.fillColor("#475569").fontSize(13).font("Helvetica").text(price.version || "-", 52, doc.y + 2);
  doc.fillColor("#047857").fontSize(11).font("Helvetica-Bold").text(`${price.simbolo} ${Number(price.precio_base).toFixed(2)}`, 52, doc.y + 6);
  doc.y = Math.max(doc.y + 22, 172);

  for (const group of groups) {
    ensureSpace(doc, 110, template);
    const startY = doc.y;
    doc.roundedRect(36, startY, 523, 26, 6).fillAndStroke("#eef2ff", "#dbeafe");
    doc.fillColor("#5b21b6").fontSize(14).font("Helvetica-Bold").text(group.nombre, 48, startY + 7);
    doc.y = startY + 38;

    for (const item of itemsByGroup[group.id] || []) {
      ensureSpace(doc, 58, template);
      const y = doc.y;
      doc.roundedRect(48, y, 499, 38, 4).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor("#64748b").fontSize(8).font("Helvetica-Bold").text(String(item.clave || "").toUpperCase(), 60, y + 8, { width: 170 });
      drawSpecValue(doc, item, 220, y + 8, 310);
      doc.y = y + 48;
    }
    doc.moveDown(0.2);
  }

  drawTemplateSection(doc, template?.footer);
  doc.end();
  return done;
}

function drawTemplateSection(doc, section) {
  if (!section?.elementos?.length) return;
  const rows = groupElementsByOrder(section.elementos);
  doc.moveDown(0.2);
  for (const row of rows) {
    const y = doc.y;
    const width = 523 / Math.max(row.items.length, 1);
    row.items.forEach((item, index) => drawTemplateElement(doc, item, 36 + index * width, y, width - 8));
    doc.y = Math.max(doc.y, y + 24);
  }
  doc.moveDown(0.5);
}

function drawTemplateElement(doc, item, x, y, width) {
  const align = (item.align || "LEFT").toLowerCase();
  const href = item.imagenPath || item.url;
  if (item.tipo === "IMAGEN") {
    drawImage(doc, href, x, y, Math.min(Number(item.widthPx) || width, width), Number(item.heightPx) || 42, align, width);
    return;
  }
  if (item.tipo === "LINK") {
    doc.fillColor("#1d4ed8").fontSize(10).font("Helvetica-Bold").text(item.texto || item.url || "", x, y, { width, align, link: item.url || undefined, underline: true });
    return;
  }
  doc.fillColor("#0f172a").fontSize(10).font("Helvetica").text(item.texto || "", x, y, { width, align });
}

function drawSpecValue(doc, item, x, y, width) {
  const href = item.valorPath || item.valorUrl || item.valor;
  if (item.valorTipo === "LINK") {
    doc.fillColor("#1d4ed8").fontSize(10).font("Helvetica-Bold").text(item.valor || href, x, y, { width, link: href, underline: true });
    return;
  }
  if (item.valorTipo === "IMAGEN") {
    drawImage(doc, href, x, y, 95, 58, "left", width);
    return;
  }
  if (item.valorTipo === "VIDEO") {
    doc.fillColor("#1d4ed8").fontSize(10).font("Helvetica-Bold").text(item.valor || "Abrir video", x, y, { width, link: href, underline: true });
    return;
  }
  doc.fillColor("#0f172a").fontSize(10).font("Helvetica").text(item.valor || "-", x, y, { width });
}

function drawImage(doc, source, x, y, imageWidth, imageHeight, align, containerWidth) {
  const file = resolvePublicFile(source);
  if (!file) {
    if (source) doc.fillColor("#1d4ed8").fontSize(9).text(source, x, y, { width: containerWidth, link: source, underline: true });
    return;
  }
  const drawX = align === "center" ? x + (containerWidth - imageWidth) / 2 : align === "right" ? x + containerWidth - imageWidth : x;
  try {
    doc.image(file, drawX, y, { fit: [imageWidth, imageHeight], align: "center", valign: "center" });
  } catch {
    doc.fillColor("#64748b").fontSize(9).text("Imagen no compatible para PDF", x, y, { width: containerWidth });
  }
}

function drawWatermark(doc, watermark) {
  const file = resolvePublicFile(watermark?.imagen_path);
  if (!file) return;
  try {
    doc.save();
    doc.opacity(Number(watermark.opacity ?? 0.15));
    doc.rotate(Number(watermark.rotate_deg || 0), { origin: [297.5, 420] });
    const size = 260 * Number(watermark.scale || 1);
    doc.image(file, (595 - size) / 2, (842 - size) / 2, { fit: [size, size] });
    doc.restore();
  } catch {
    doc.restore();
  }
}

function ensureSpace(doc, needed, template) {
  if (doc.y + needed <= 790) return;
  drawTemplateSection(doc, template?.footer);
  doc.addPage();
  drawWatermark(doc, template?.watermark);
  drawTemplateSection(doc, template?.header);
}

function resolvePublicFile(source) {
  if (!source || /^https?:\/\//i.test(source)) return null;
  const normalized = String(source).replace(/^\/+/, "");
  const file = path.join(process.cwd(), "public", normalized);
  return fs.existsSync(file) ? file : null;
}

function groupElementsByOrder(elements) {
  const grouped = new Map();
  elements
    .slice()
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0) || Number(a.id || 0) - Number(b.id || 0))
    .forEach((element) => {
      const key = Number(element.orden || 0);
      const list = grouped.get(key) || [];
      list.push(element);
      grouped.set(key, list);
    });
  return Array.from(grouped.entries()).map(([key, items]) => ({ key, items }));
}
