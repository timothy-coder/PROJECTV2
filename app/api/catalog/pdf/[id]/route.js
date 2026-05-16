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

  const decodedItems = items.map((item) => ({ ...item, ...decodeSpecValue(item.valor) }));

  const itemsByGroup = decodedItems.reduce((acc, item) => {
    if (Number(item.orden || 0) === 0) return acc;
    acc[item.group_id] = acc[item.group_id] || [];
    acc[item.group_id].push(item);
    return acc;
  }, {});

  const previewItems = decodedItems
    .filter((item) => Number(item.orden || 0) === 0 && ["IMAGEN", "VIDEO", "LINK"].includes(item.valorTipo))
    .map((item) => ({ ...item, groupName: groups.find((group) => group.id === item.group_id)?.nombre || "" }));

  return { price, groups, itemsByGroup, previewItems, template: await loadTemplate() };
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

async function buildPdf({ price, groups, itemsByGroup, previewItems = [], template, catalogUrl }) {
  const doc = new PDFDocument({ size: "A4", margin: 36, bufferPages: true });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  registerPdfFonts(doc);

  const origin = new URL(catalogUrl).origin;
  const allItems = [...previewItems, ...Object.values(itemsByGroup).flat()];
  const itemHrefs = allItems.map((item) => getItemHref(item, origin));
  const templateImageSources = getTemplateImageSources(template);

  doc._qrImages = await buildQrImages([catalogUrl, ...itemHrefs]);
  doc._pdfImages = await buildPdfImages([...itemHrefs.filter(isImageHref), ...templateImageSources]);

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

  drawPreviewItems(doc, previewItems, template, origin);

  // ✅ Secciones como "una sola tabla" por grupo
  for (const group of groups) {
    const rows = itemsByGroup[group.id] || [];
    if (!rows.length) continue;

    ensureSpace(doc, 82, template);
    const titleY = doc.y;

    drawGroupTitle(doc, group.nombre, titleY);
    doc.y = titleY + 34;

    const gridX = 36;
    const gridW = 523;
    const gap = 8;
    const cardW = (gridW - gap) / 2;

    for (let i = 0; i < rows.length; i += 2) {
      const pair = rows.slice(i, i + 2);
      const rowH = Math.max(...pair.map((item) => getSpecCardHeight(doc, item, origin, cardW)));
      ensureSpace(doc, rowH + 12, template);
      const y = doc.y;
      pair.forEach((item, index) => {
        drawSpecCard(doc, item, gridX + index * (cardW + gap), y, cardW, rowH, origin);
      });
      doc.y = y + rowH + 8;
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
    doc
      .fillColor("#1d4ed8")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(item.texto || item.url || "", x, y, { width, align, link: item.url || undefined, underline: true });
    return;
  }
  doc.fillColor("#0f172a").fontSize(10).font("Helvetica").text(item.texto || "", x, y, { width, align });
}

function drawGroupTitle(doc, title, y) {
  doc.roundedRect(36, y, 523, 26, 6).fillAndStroke("#eef2ff", "#dbeafe");
  doc.fillColor("#5b21b6").fontSize(13).font("Helvetica-Bold").text(String(title || "").toUpperCase(), 48, y + 7, { width: 495 });
}

function getSpecCardHeight(doc, item, origin, width) {
  const href = getItemHref(item, origin);
  const imageLike = item.valorTipo === "IMAGEN" || isImageHref(href);
  const videoLike = item.valorTipo === "VIDEO" || isVideoHref(href);
  const linkLike = item.valorTipo === "LINK";
  if (imageLike) return 86;
  if (videoLike || linkLike) return 62;

  const keyText = String(item.clave || "").toUpperCase();
  const valueText = String(item.valor || "-");
  const keyH = doc.heightOfString(keyText, { width: width - 24, lineGap: 1 });
  const valueH = doc.heightOfString(valueText, { width: width - 24, lineGap: 1 });
  return Math.max(38, keyH + valueH + 19);
}

function drawSpecCard(doc, item, x, y, width, height, origin) {
  const href = getItemHref(item, origin);
  const imageLike = item.valorTipo === "IMAGEN" || isImageHref(href);
  const videoLike = item.valorTipo === "VIDEO" || isVideoHref(href);
  const linkLike = item.valorTipo === "LINK";
  const keyText = String(item.clave || "").toUpperCase();

  doc.roundedRect(x, y, width, height, 5).fillAndStroke("#f8fafc", "#e2e8f0");
  doc.fillColor("#64748b").fontSize(7.2).font("Helvetica-Bold").text(keyText, x + 10, y + 8, { width: width - 20, lineGap: 1 });

  if (imageLike) {
    drawImage(doc, href, x + 10, y + 26, Math.min(118, width - 82), 50, "left", Math.min(118, width - 82));
    drawQrPlaceholder(doc, href, x + width - 60, y + 26, 44);
    return;
  }

  if (videoLike || linkLike) {
    drawQrPlaceholder(doc, href, x + width - 58, y + 16, 44);
    doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text(videoLike ? "Escanear video" : "Escanear enlace", x + 10, y + 31, { width: width - 78 });
    return;
  }

  doc.fillColor("#0f172a").fontSize(9.2).font("Helvetica").text(String(item.valor || "-"), x + 10, y + 24, { width: width - 20, lineGap: 1 });
}

function drawPreviewItems(doc, previewItems, template, origin) {
  if (!previewItems.length) return;

  const previewRows = previewItems.map((item) => {
    const href = getItemHref(item, origin);
    const imageLike = item.valorTipo === "IMAGEN" || isImageHref(href);
    const videoLike = item.valorTipo === "VIDEO" || isVideoHref(href);
    return { item, href, imageLike, videoLike, height: imageLike ? 86 : videoLike || item.valorTipo === "LINK" ? 62 : 42 };
  });
  const sectionH = 46 + previewRows.reduce((sum, row) => sum + row.height, 0);

  ensureSpace(doc, sectionH + 12, template);

  const startY = doc.y;
  doc.roundedRect(36, startY, 523, sectionH, 8).fillAndStroke("#eff6ff", "#bfdbfe");
  doc.fillColor("#1e40af").fontSize(12).font("Helvetica-Bold").text("VISTA PREVIA", 50, startY + 12);
  doc.fillColor("#475569").fontSize(8.5).font("Helvetica").text("Contenido multimedia destacado de la ficha tecnica. Escanea el codigo QR para abrir cada recurso.", 50, startY + 28, { width: 495 });

  let y = startY + 46;
  for (let index = 0; index < previewRows.length; index++) {
    const { item, href, imageLike, height } = previewRows[index];
    if (index > 0) doc.strokeColor("#bfdbfe").lineWidth(1).moveTo(50, y).lineTo(545, y).stroke();
    doc
      .fillColor("#64748b")
      .fontSize(8)
      .font("Helvetica-Bold")
      .text(String(item.clave || "").toUpperCase(), 54, y + 9, { width: 150 });
    doc
      .fillColor("#0f172a")
      .fontSize(8.5)
      .font("Helvetica")
      .text(item.groupName ? `Pertenece a ${item.groupName}` : "Recurso destacado", 54, y + 23, { width: 165 });

    if (imageLike) {
      drawImage(doc, href, 236, y + 8, 130, 66, "left", 130);
      drawQrPlaceholder(doc, href, 392, y + 15, 50);
    } else {
      drawQrPlaceholder(doc, href, 392, y + 8, 48);
    }

    y += height;
  }

  doc.y = startY + sectionH + 12;
}

function drawImage(doc, source, x, y, imageWidth, imageHeight, align, containerWidth) {
  const image = doc._pdfImages?.get(String(source || "").trim());
  if (!image) {
    if (source) doc.fillColor("#1d4ed8").fontSize(9).text(source, x, y, { width: containerWidth, link: source, underline: true });
    return;
  }
  const drawX =
    align === "center"
      ? x + (containerWidth - imageWidth) / 2
      : align === "right"
        ? x + containerWidth - imageWidth
        : x;
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
  ensureSpace(doc, 86, template);
  const y = doc.y + 8;
  doc.roundedRect(36, y, 523, 70, 6).fillAndStroke("#eff6ff", "#bfdbfe");
  doc.fillColor("#1e40af").fontSize(9).font("Helvetica-Bold").text("VER FICHA TECNICA EN LINEA", 52, y + 12);
  doc.fillColor("#475569").fontSize(8).font("Helvetica").text("Escanea el codigo para abrir la ficha completa en el navegador.", 52, y + 27, { width: 360 });
  drawQrPlaceholder(doc, catalogUrl, 486, y + 11, 52);
  doc.y = y + 82;
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
  if (!source) return null;
  let normalized = String(source).trim();
  if (/^https?:\/\//i.test(normalized)) {
    try {
      normalized = new URL(normalized).pathname;
    } catch {
      return null;
    }
  }
  normalized = normalized.replace(/^\/+/, "");
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
  const entries = await Promise.all(
    uniqueValues.map(async (value) => {
      try {
        const dataUrl = await QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 1, scale: 8, type: "image/png" });
        return [value, dataUrl];
      } catch {
        return [value, null];
      }
    })
  );
  return new Map(entries.filter(([, buffer]) => buffer));
}

async function buildPdfImages(values) {
  const uniqueValues = Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
  const entries = await Promise.all(
    uniqueValues.map(async (value) => {
      try {
        const file = resolvePublicFile(value);
        if (file) return [value, await normalizePdfImage(fs.readFileSync(file), value, "")];

        if (/^https?:\/\//i.test(value)) {
          const response = await fetch(value, { cache: "no-store" });
          if (!response.ok) return [value, null];
          const contentType = response.headers.get("content-type") || "";
          if (!contentType.startsWith("image/") && !isImageHref(value)) return [value, null];
          const buffer = Buffer.from(await response.arrayBuffer());
          return [value, await normalizePdfImage(buffer, value, contentType)];
        }

        return [value, null];
      } catch {
        return [value, null];
      }
    })
  );
  return new Map(entries.filter(([, buffer]) => buffer));
}

function getItemHref(item, origin = "") {
  return absoluteLocalUrl(item?.valorPath || item?.valorUrl || item?.valor || "", origin);
}

function isImageHref(value) {
  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(String(value || "").trim());
}

function isVideoHref(value) {
  const text = String(value || "").trim();
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(text) || /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(text);
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
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function absoluteLocalUrl(value, origin) {
  const text = String(value || "").trim();
  if (!text || /^https?:\/\//i.test(text) || !text.startsWith("/") || !origin) return text;
  return `${origin}${text}`;
}

// ✅ FIX: helper que faltaba (evita ReferenceError)
function estimateGroupTableHeight(doc, items, { origin, colKeyW, colValW, rowBaseH }) {
  let total = 0;

  for (const item of items) {
    const href = getItemHref(item, origin);
    const imageLike = item.valorTipo === "IMAGEN" || isImageHref(href);
    const videoLike = item.valorTipo === "VIDEO" || isVideoHref(href);
    const linkLike = item.valorTipo === "LINK";

    const keyText = String(item.clave || "").toUpperCase();
    const keyH = Math.max(rowBaseH, doc.heightOfString(keyText, { width: colKeyW - 20, lineGap: 2 }) + 12);

    let valH = rowBaseH;
    if (imageLike) valH = 82;
    else if (videoLike || linkLike) valH = 58;
    else {
      const valueText = String(item.valor || "-");
      valH = Math.max(rowBaseH, doc.heightOfString(valueText, { width: colValW - 20, lineGap: 2 }) + 12);
    }

    total += Math.max(keyH, valH);
  }

  return Math.max(total, rowBaseH);
}
