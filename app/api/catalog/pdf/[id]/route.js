import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import QRCode from "qrcode";
import sharp from "sharp";

import { decodeSpecValue } from "@/app/api/catalog/valueUtils";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { id } = await params;
  const priceId = Number(id);
  if (!priceId) return NextResponse.json({ message: "Ficha invalida." }, { status: 400 });

  try {
    const data = await loadCatalogData(priceId);
    if (!data.price) return NextResponse.json({ message: "Ficha no encontrada." }, { status: 404 });

    const catalogUrl = new URL(`/catalogo/${priceId}`, request.url).toString();
    const pdf = await buildPdf({ ...data, catalogUrl });

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

async function buildPdf({ price, groups, itemsByGroup, template, catalogUrl }) {
  const doc = new PDFDocument({ size: "A4", margin: 36, bufferPages: true });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  registerPdfFonts(doc);
  const allItems = Object.values(itemsByGroup).flat();
  const itemHrefs = allItems.map((item) => getItemHref(item));
  const templateImageSources = getTemplateImageSources(template);
  doc._qrImages = await buildQrImages([
    catalogUrl,
    ...itemHrefs,
  ]);
  doc._pdfImages = await buildPdfImages([
    ...itemHrefs.filter(isImageHref),
    ...templateImageSources,
  ]);

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
      const href = getItemHref(item);
      const itemHeight = item.valorTipo === "IMAGEN" || isImageHref(href) ? 92 : ["VIDEO", "LINK"].includes(item.valorTipo) || isVideoHref(href) ? 72 : 38;
      ensureSpace(doc, itemHeight + 20, template);
      const y = doc.y;
      doc.roundedRect(48, y, 499, itemHeight, 4).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor("#64748b").fontSize(8).font("Helvetica-Bold").text(String(item.clave || "").toUpperCase(), 60, y + 8, { width: 170 });
      drawSpecValue(doc, item, 220, y + 8, 310);
      doc.y = y + itemHeight + 10;
    }
    doc.moveDown(0.2);
  }

  drawCatalogLink(doc, catalogUrl, template);
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
  const href = getItemHref(item);
  const imageLike = item.valorTipo === "IMAGEN" || isImageHref(href);
  const videoLike = item.valorTipo === "VIDEO" || isVideoHref(href);
  const label = getItemLabel(item, href);
  if (imageLike) {
    drawImage(doc, href, x, y, 110, 64, "left", width);
    drawQrPlaceholder(doc, href, x + 122, y + 4, 52);
    if (href) doc.fillColor("#1d4ed8").fontSize(7).font("Helvetica-Bold").text(label, x + 184, y + 7, { width: width - 184, link: href, underline: true });
    return;
  }
  if (videoLike) {
    drawQrPlaceholder(doc, href, x, y - 4, 52);
    return;
  }
  if (item.valorTipo === "LINK") {
    drawQrPlaceholder(doc, href, x, y - 4, 52);
    doc.fillColor("#1d4ed8").fontSize(8).font("Helvetica-Bold").text(label, x + 62, y, { width: width - 62, link: href, underline: true });
    return;
  }
  doc.fillColor("#0f172a").fontSize(10).font("Helvetica").text(item.valor || "-", x, y, { width });
}

function drawImage(doc, source, x, y, imageWidth, imageHeight, align, containerWidth) {
  const image = doc._pdfImages?.get(String(source || "").trim());
  if (!image) {
    if (source) doc.fillColor("#1d4ed8").fontSize(9).text(source, x, y, { width: containerWidth, link: source, underline: true });
    return;
  }
  const drawX = align === "center" ? x + (containerWidth - imageWidth) / 2 : align === "right" ? x + containerWidth - imageWidth : x;
  try {
    doc.image(image, drawX, y, { fit: [imageWidth, imageHeight], align: "center", valign: "center" });
  } catch {
    if (source) doc.fillColor("#1d4ed8").fontSize(8).text(source, x, y, { width: containerWidth, link: source, underline: true });
  }
}

function drawWatermark(doc, watermark) {
  const image = doc._pdfImages?.get(String(watermark?.imagen_path || "").trim());
  if (!image) return;
  try {
    doc.save();
    doc.opacity(Number(watermark.opacity ?? 0.15));
    doc.rotate(Number(watermark.rotate_deg || 0), { origin: [297.5, 420] });
    const size = 260 * Number(watermark.scale || 1);
    doc.image(image, (595 - size) / 2, (842 - size) / 2, { fit: [size, size] });
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

function drawCatalogLink(doc, catalogUrl, template) {
  ensureSpace(doc, 72, template);
  const y = doc.y + 8;
  doc.roundedRect(36, y, 523, 56, 6).fillAndStroke("#eff6ff", "#bfdbfe");
  doc.fillColor("#1e40af").fontSize(9).font("Helvetica-Bold").text("VER FICHA TECNICA EN LINEA", 52, y + 12);
  drawQrPlaceholder(doc, catalogUrl, 52, y + 26, 24);
  doc.fillColor("#1d4ed8").fontSize(8).font("Helvetica-Bold").text(catalogUrl, 86, y + 31, { width: 450, link: catalogUrl, underline: true });
  doc.y = y + 68;
}

function drawQrPlaceholder(doc, href, x, y, size = 42) {
  const image = doc._qrImages?.get(String(href || ""));
  doc.rect(x, y, size, size).fillAndStroke("#ffffff", "#111827");
  if (image) {
    doc.image(image, x + 2, y + 2, { fit: [size - 4, size - 4] });
    return;
  }
  doc.font("Helvetica-Bold").fontSize(Math.max(4, size / 9)).fillColor("#111827").text("QR", x, y + size / 2 - 3, { width: size, align: "center" });
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

function registerPdfFonts(doc) {
  const regular = path.join(process.cwd(), "public", "fonts", "Montserrat-VariableFont_wght.ttf");
  const italic = path.join(process.cwd(), "public", "fonts", "Montserrat-Italic-VariableFont_wght.ttf");
  if (fs.existsSync(regular)) {
    const regularBuffer = fs.readFileSync(regular);
    doc.registerFont("Helvetica", regularBuffer);
    doc.registerFont("Helvetica-Bold", regularBuffer);
  }
  if (fs.existsSync(italic)) {
    const italicBuffer = fs.readFileSync(italic);
    doc.registerFont("Helvetica-Oblique", italicBuffer);
    doc.registerFont("Helvetica-BoldOblique", italicBuffer);
  }
}

async function buildQrImages(values) {
  const uniqueValues = Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
  const entries = await Promise.all(uniqueValues.map(async (value) => {
    try {
      const dataUrl = await QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 1, scale: 8, type: "image/png" });
      return [value, dataUrl];
    } catch {
      return [value, null];
    }
  }));
  return new Map(entries.filter(([, buffer]) => buffer));
}

async function buildPdfImages(values) {
  const uniqueValues = Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
  const entries = await Promise.all(uniqueValues.map(async (value) => {
    try {
      if (/^https?:\/\//i.test(value)) {
        const response = await fetch(value, { cache: "no-store" });
        if (!response.ok) return [value, null];
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.startsWith("image/") && !isImageHref(value)) return [value, null];
        const buffer = Buffer.from(await response.arrayBuffer());
        return [value, await normalizePdfImage(buffer, value, contentType)];
      }
      const file = resolvePublicFile(value);
      if (!file) return [value, null];
      return [value, await normalizePdfImage(fs.readFileSync(file), value, "")];
    } catch {
      return [value, null];
    }
  }));
  return new Map(entries.filter(([, buffer]) => buffer));
}

function getItemHref(item) {
  return String(item?.valorPath || item?.valorUrl || item?.valor || "").trim();
}

function getItemLabel(item, href) {
  const label = String(item?.valor || "").trim();
  const url = String(href || "").trim();
  if (!label || label === url) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith("/")) return url;
  return label;
}

function isImageHref(value) {
  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(String(value || "").trim());
}

function isVideoHref(value) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(value || "").trim());
}

async function normalizePdfImage(buffer, source, contentType) {
  if (isPdfNativeImage(source, contentType)) return bufferToDataUrl(buffer, getNativeImageMime(source, contentType));
  const png = await sharp(buffer, { animated: false }).png().toBuffer();
  return bufferToDataUrl(png, "image/png");
}

function isPdfNativeImage(source, contentType) {
  const text = String(source || "").trim();
  const mime = String(contentType || "").toLowerCase();
  return /\.(png|jpe?g)(\?.*)?$/i.test(text) || mime === "image/png" || mime === "image/jpeg" || mime === "image/jpg";
}

function getNativeImageMime(source, contentType) {
  const mime = String(contentType || "").toLowerCase();
  if (mime === "image/png" || mime === "image/jpeg" || mime === "image/jpg") return mime === "image/jpg" ? "image/jpeg" : mime;
  return /\.png(\?.*)?$/i.test(String(source || "")) ? "image/png" : "image/jpeg";
}

function bufferToDataUrl(buffer, mime) {
  return `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;
}

function getTemplateImageSources(template) {
  return [
    template?.watermark?.imagen_path,
    ...(template?.header?.elementos || []).filter((element) => element.tipo === "IMAGEN").map((element) => element.imagenPath),
    ...(template?.footer?.elementos || []).filter((element) => element.tipo === "IMAGEN").map((element) => element.imagenPath),
  ].map((value) => String(value || "").trim()).filter(Boolean);
}
