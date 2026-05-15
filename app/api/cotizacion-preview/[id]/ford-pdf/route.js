import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import QRCode from "qrcode";

import { decodeSpecValue } from "@/app/api/catalog/valueUtils";
import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_W = 595.28;
const PAGE_H = 841.89;

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateText(value = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-PE");
}

export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  if (!hasPerm(user.permissions || {}, ["cotizacion", "view"]) && !hasPerm(user.permissions || {}, ["oportunidades", "view"])) {
    return NextResponse.json({ message: "No tienes permiso para ver cotizaciones." }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  const full = request.nextUrl.searchParams.get("full") === "1";

  try {
    const data = await loadQuoteData(id);
    if (!data.quote) return NextResponse.json({ message: "Cotizacion no encontrada." }, { status: 404 });
    const pdf = await buildFordQuotePdf(data, { full });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${full ? "cotizacion-completa" : "cotizacion-ford"}-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error generating Ford quote PDF:", error);
    return NextResponse.json({ message: "No se pudo generar el PDF de cotizacion." }, { status: 500 });
  }
}

async function loadQuoteData(id) {
  const [[quote]] = await pool.query(
    `SELECT q.*, o.oportunidad_id, o.id AS oportunidad_pk,
            CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente,
            c.email, c.celular, au.fullname AS asignado, cu.fullname AS creado,
            p.id AS precio_id, p.version, p.precio_base, p.en_stock, p.tiempo_entrega_dias,
            ma.name AS marca, mo.name AS modelo
     FROM ventas_cotizaciones q
     INNER JOIN ventas_oportunidades o ON o.id=q.oportunidad_id
     INNER JOIN administracion_clientes c ON c.id=o.cliente_id
     LEFT JOIN administracion_usuarios au ON au.id=o.asignado_a
     LEFT JOIN administracion_usuarios cu ON cu.id=q.created_by
     INNER JOIN ventas_precios p ON p.id=q.precio_id
     INNER JOIN administracion_marcas ma ON ma.id=p.marca_id
     INNER JOIN administracion_modelos mo ON mo.id=p.modelo_id
     WHERE q.id=? LIMIT 1`,
    [id]
  );
  if (!quote) return { quote: null };

  const [accessories] = await pool.query(
    `SELECT ca.*, ad.detalle, ad.numero_parte
     FROM ventas_cotizaciones_accesorios ca
     INNER JOIN ventas_accesorios_disponibles ad ON ad.id=ca.accesorio_id
     WHERE ca.cotizacion_id=? ORDER BY ca.id ASC`,
    [id]
  );
  const [gifts] = await pool.query(
    `SELECT cr.*, rd.detalle, rd.lote
     FROM ventas_cotizaciones_regalos cr
     INNER JOIN ventas_regalos_disponibles rd ON rd.id=cr.regalo_id
     WHERE cr.cotizacion_id=? ORDER BY cr.id ASC`,
    [id]
  );
  const [specRows] = await pool.query(
    `SELECT g.id AS group_id, g.nombre AS group_name, g.orden AS group_order,
            i.id AS item_id, i.clave, i.valor, i.orden AS item_order
     FROM ventas_precio_specs_group g
     LEFT JOIN ventas_precio_specs_item i ON i.group_id=g.id AND i.is_active=1
     WHERE g.precio_id=? AND g.is_active=1
     ORDER BY g.orden ASC, g.id ASC, i.orden ASC, i.id ASC`,
    [quote.precio_id]
  );

  return {
    quote,
    accessories,
    gifts,
    specGroups: buildSpecGroups(specRows),
    template: await loadTemplate("COTIZACION", quote.marca),
    fichaTemplate: await loadTemplate("FICHA_TECNICA"),
  };
}

async function loadTemplate(type, brand = "") {
  const brandName = String(brand || "").trim();
  const [templates] = await pool.query(
    `SELECT id, nombre FROM configuracion_ventas_documento_plantillas
     WHERE tipo_documento=? AND is_active=1
     ORDER BY updated_at DESC, id DESC`,
    [type]
  );
  const template = brandName && type === "COTIZACION"
    ? templates.find((item) => String(item.nombre || "").toLowerCase().includes(brandName.toLowerCase())) ||
      templates.find((item) => /general|generica|gen[eé]rica|otras/i.test(String(item.nombre || ""))) ||
      templates[0]
    : templates[0];
  if (!template) return null;
  const [sections] = await pool.query(
    `SELECT id, tipo, nombre, orden FROM configuracion_ventas_documento_plantilla_secciones
     WHERE plantilla_id=? AND is_active=1 ORDER BY orden ASC, id ASC`,
    [template.id]
  );
  const ids = sections.map((section) => section.id);
  const [elements] = ids.length ? await pool.query(
    `SELECT id, seccion_id, tipo, texto, url, imagen_path, orden, align, width_px, height_px
     FROM configuracion_ventas_documento_plantilla_elementos
     WHERE seccion_id IN (?) AND is_active=1 ORDER BY orden ASC, id ASC`,
    [ids]
  ) : [[]];
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
  return {
    header: sections.find((section) => section.tipo === "ENCABEZADO")
      ? { elementos: bySection[sections.find((section) => section.tipo === "ENCABEZADO").id] || [] }
      : null,
    footer: sections.find((section) => section.tipo === "PIE")
      ? { elementos: bySection[sections.find((section) => section.tipo === "PIE").id] || [] }
      : null,
  };
}

async function buildFordQuotePdf(data, { full }) {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  registerPdfFonts(doc);
  doc._qrImages = await buildQrImages(data.specGroups.flatMap((group) => group.items.map((item) => item.href)));

  drawQuotePage(doc, data);
  if (full) drawTechnicalSheetPages(doc, data);

  doc.end();
  return done;
}

function drawQuotePage(doc, data) {
  const brand = String(data.quote?.marca || "").trim().toLowerCase();
  if (brand && brand !== "ford") {
    drawGenericQuotePage(doc, data);
    return;
  }
  const { quote, accessories, gifts, template } = data;
  const x = 20;
  const w = PAGE_W - 40;
  doc.rect(0, 0, PAGE_W, PAGE_H).fill("#242424");
  doc.fillColor("#ffffff");

  drawTemplateSection(doc, template?.header, x, 18, w, 58, "#ffffff");
  doc.font("Helvetica-Bold").fontSize(9).text(`COTIZACION N° ${String(quote.id).padStart(7, "0")}`, 230, 28, { width: 150, align: "center" });
  doc.font("Helvetica").fontSize(8).text(dateText(quote.created_at), 230, 42, { width: 150, align: "center" });

  doc.font("Helvetica-Bold").fontSize(8).text("SR. (A):", x, 112);
  doc.font("Helvetica-BoldOblique").fontSize(17).text(String(quote.cliente || "-").toUpperCase(), x + 48, 106, { width: 250 });
  doc.font("Helvetica-Bold").fontSize(8).text("ASESOR:", 370, 112);
  doc.font("Helvetica").fontSize(8).text(quote.creado || quote.asignado || "-", 420, 112, { width: 140 });
  doc.font("Helvetica-Bold").fontSize(8).text("EMAIL:", 370, 146);
  doc.font("Helvetica").fontSize(8).text(quote.email || "-", 420, 146, { width: 140 });
  doc.font("Helvetica-Bold").fontSize(8).text("CELULAR:", 370, 134);
  doc.font("Helvetica").fontSize(8).text(quote.celular || "-", 420, 134, { width: 140 });

  doc.moveTo(x, 188).lineTo(x + w, 188).strokeColor("#ffffff").lineWidth(0.6).stroke();
  doc.font("Helvetica").fontSize(8).fillColor("#ffffff").text(
    `Nos es muy grato presentarnos, y acorde a su gentil requerimiento, le remitimos la siguiente cotizacion: ${quote.modelo} ${quote.version} AÑO MODELO ${quote.anio || ""}`,
    x,
    198,
    { width: w }
  );

  const hero = findFirstMedia(data.specGroups);
  if (hero?.href) drawImageOrLink(doc, hero.href, 125, 220, 245, 145);

  const discountAmount = Number(quote["descuento_vehículo"] || quote["descuento_vehÃ­culo"] || 0);
  const discountPercent = Number(quote["descuento_vehículo_porcentaje"] || quote["descuento_vehÃ­culo_porcentaje"] || 0);
  const vehicleDiscount = discountAmount + Number(quote.precio_base || 0) * discountPercent / 100;
  const vehicleTotal = Math.max(Number(quote.precio_base || 0) - vehicleDiscount, 0);
  const accessoriesTotal = accessories.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const giftsTotal = gifts.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const total = vehicleTotal + accessoriesTotal + giftsTotal;

  let y = 370;
  y = priceRow(doc, y, "DESCRIPCION", `${quote.modelo} ${quote.version}`, "");
  y = priceRow(doc, y, "PRECIO DE LISTA", "", money(quote.precio_base));
  y = priceRow(doc, y, "DSCTO.", "", money(vehicleDiscount));
  y = priceRow(doc, y, "ACCESORIOS", "", money(accessoriesTotal));
  y = priceRow(doc, y, "REGALOS", "", money(giftsTotal));
  y = priceRow(doc, y, "TOTAL EN DOLARES", "", money(total), true);

  drawBankTable(doc, x, y + 18);
  drawSignature(doc, quote.creado || quote.asignado || "Asesor", 365, 548);

  doc.font("Helvetica-Bold").fontSize(7).fillColor("#ffffff").text("CONDICIONES DE VENTA", x, 530);
  doc.font("Helvetica").fontSize(7).text("Entrega inmediata sujeta a disponibilidad de stock\nGarantia Ford de 5 años o 150,000 km.\nSeguro: Consulte por su tasa exclusiva y atencion personalizada.", x, 545, { width: 310 });

  doc.font("Helvetica-Bold").fontSize(7).text("TERMINOS Y CONDICIONES:", x, 715);
  doc.rect(x, 728, w, 82).strokeColor("#ffffff").lineWidth(0.5).stroke();
  drawTemplateSection(doc, data.template?.footer, x + 5, 735, w - 10, 62, "#ffffff");
}

function drawGenericQuotePage(doc, data) {
  const { quote, template } = data;
  const x = 40;
  const w = PAGE_W - 80;
  doc.rect(0, 0, PAGE_W, PAGE_H).fill("#282828");
  doc.fillColor("#ffffff");

  drawTemplateSection(doc, template?.header, x, 8, w, 72, "#ffffff");
  doc.moveTo(x, 78).lineTo(x + w, 78).strokeColor("#efe6c0").lineWidth(3).stroke();

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#ffffff").text(dateText(), x + w - 130, 120, { width: 130, align: "right" });
  doc.font("Helvetica-Bold").fontSize(9).text("Estimado (a):", x, 170);
  doc.font("Helvetica-Bold").fontSize(9).text("DNI:", x + 340, 170);
  doc.font("Helvetica-Bold").fontSize(8).text(
    `Sirva la presente para saludarlo cordialmente y a la vez hacerle llegar nuestra oferta economica por el modelo detallado a continuacion:`,
    x,
    198,
    { width: w }
  );

  const modelTitle = `${quote.modelo || ""} ${quote.version || ""}`.trim().toUpperCase();
  doc.font("Helvetica-Bold").fontSize(9).text(`MODELO ${modelTitle}`, x, 278, { width: w, align: "center" });

  const hero = findFirstMedia(data.specGroups);
  if (hero?.href) drawImageOrLink(doc, hero.href, 150, 325, 300, 170, "center", 300);
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#ffffff").text("FOTO REFERENCIAL", x, 515, { width: w, align: "center" });

  const discountAmount = Number(quote["descuento_vehículo"] || quote["descuento_vehÃ­culo"] || 0);
  const discountPercent = Number(quote["descuento_vehículo_porcentaje"] || quote["descuento_vehÃ­culo_porcentaje"] || 0);
  const vehicleDiscount = discountAmount + Number(quote.precio_base || 0) * discountPercent / 100;
  const vehicleTotal = Math.max(Number(quote.precio_base || 0) - vehicleDiscount, 0);

  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff").text("MODELO Y PRECIO", x, 560);
  doc.moveTo(x, 574).lineTo(x + w, 574).strokeColor("#ffffff").lineWidth(0.6).stroke();
  doc.rect(x, 585, w, 52).strokeColor("#ffffff").lineWidth(0.8).stroke();
  doc.rect(x, 585, w / 2, 16).fillAndStroke("#935600", "#ffffff");
  doc.rect(x + w / 2, 585, w / 2, 16).fillAndStroke("#935600", "#ffffff");
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff").text(modelTitle || "-", x, 590, { width: w / 2, align: "center" });
  doc.text(`MODELO ${quote.anio || new Date().getFullYear()}`, x + w / 2, 590, { width: w / 2, align: "center" });
  doc.rect(x, 601, w / 2, 16).strokeColor("#ffffff").stroke();
  doc.rect(x + w / 2, 601, w / 2, 16).strokeColor("#ffffff").stroke();
  doc.font("Helvetica-Bold").fontSize(8).text("PRECIO REGULAR", x, 606, { width: w / 2, align: "center" });
  doc.text(`$${money(quote.precio_base)}`, x + w / 2, 606, { width: w / 2, align: "center" });
  doc.rect(x, 617, w / 2, 20).strokeColor("#ffffff").stroke();
  doc.rect(x + w / 2, 617, w / 2, 20).strokeColor("#ffffff").stroke();
  doc.font("Helvetica-Bold").fontSize(13).text("PRECIO ESPECIAL", x, 623, { width: w / 2, align: "center" });
  doc.text(`$${money(vehicleTotal)}`, x + w / 2, 623, { width: w / 2, align: "center" });

  const bullets = [
    "Los precios estan expresados en dolares americanos e incluyen el I.G.V. 18%",
    "Precios sujetos a variacion sin previo aviso",
    "Tipo de cambio referencial sujeto a variacion diaria.",
    "El tipo de cambio es valido solo por hoy.",
    "Promocion valida deacuerdo a stock.",
  ];
  doc.font("Helvetica").fontSize(9).fillColor("#ffffff");
  bullets.forEach((item, index) => {
    doc.font("Helvetica-Bold").text("✓", x + 20, 670 + index * 18);
    doc.font("Helvetica").text(item, x + 42, 670 + index * 18, { width: w - 70 });
  });

  doc.font("Helvetica-Bold").fontSize(9).text("NOTA:", x + 20, 770);
  doc.font("Helvetica").fontSize(9).text(
    "Nuestros precios son pactados en dolares americanos de conformidad con el articulo 1237 del codigo civil debiendo ser pagados en dicha moneda. El importe en nuevos soles en esta cotizacion se consigna solo como referencia en cumplimiento de la ley 28300 y considera el tipo de cambio de venta vigente a la fecha de la presente cotizacion.",
    x + 20,
    795,
    { width: w - 40, lineGap: 2 }
  );
}

function priceRow(doc, y, label, desc, amount, highlight = false) {
  doc.font("Helvetica-Bold").fontSize(7).fillColor(highlight ? "#f4f27a" : "#ffffff");
  doc.text(label, 24, y, { width: 135 });
  doc.font("Helvetica").text(desc, 160, y, { width: 260 });
  doc.font("Helvetica-Bold").text(amount, 440, y, { width: 95, align: "right" });
  doc.moveTo(24, y - 2).lineTo(535, y - 2).strokeColor("#ffffff").lineWidth(0.4).stroke();
  return y + 13;
}

function drawBankTable(doc, x, y) {
  doc.rect(x, y, 300, 56).strokeColor("#ffffff").stroke();
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#ffffff").text("DOLARES", x + 18, y + 16);
  doc.text("SOLES", x + 18, y + 38);
  doc.text("BCP", x + 135, y + 7);
  doc.text("BBVA", x + 225, y + 7);
  doc.font("Helvetica").fontSize(6.5).text("N° 355-2457827-1-19", x + 92, y + 18);
  doc.text("N° 0011-0967-0100003994", x + 190, y + 18);
  doc.text("N° 355-2506034-0-32", x + 92, y + 40);
  doc.text("N° 0011-0967-0100003986", x + 190, y + 40);
  doc.moveTo(x + 75, y).lineTo(x + 75, y + 56).stroke();
  doc.moveTo(x + 175, y).lineTo(x + 175, y + 56).stroke();
  doc.moveTo(x, y + 28).lineTo(x + 300, y + 28).stroke();
}

function drawSignature(doc, name, x, y) {
  doc.rect(x, y, 175, 92).strokeColor("#111111").fillAndStroke("#ffffff", "#111111");
  doc.font(doc._registeredAutography ? "Autography" : "Helvetica-Oblique").fontSize(30).fillColor("#5c67c8").text(name, x + 15, y + 28, { width: 145, align: "center" });
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#ffffff").text("Firma del Vendedor", x, y + 98, { width: 175, align: "center" });
}

function drawTechnicalSheetPages(doc, data) {
  doc.addPage();
  doc.rect(0, 0, PAGE_W, PAGE_H).fill("#ffffff");
  const x = 36;
  let y = 28;
  drawTemplateSection(doc, data.fichaTemplate?.header, x, y, PAGE_W - 72, 55, "#111827");
  y += 70;
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text(`FICHA TECNICA - ${data.quote.marca} ${data.quote.modelo}`, x, y);
  y += 30;
  for (const group of data.specGroups) {
    if (y > 730) {
      doc.addPage();
      doc.rect(0, 0, PAGE_W, PAGE_H).fill("#ffffff");
      y = 40;
    }
    doc.rect(x, y, PAGE_W - 72, 24).fillAndStroke("#eef2ff", "#c7d2fe");
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#3730a3").text(group.name, x + 10, y + 7);
    y += 34;
    for (const item of group.items) {
      if (y > 740) {
        doc.addPage();
        doc.rect(0, 0, PAGE_W, PAGE_H).fill("#ffffff");
        y = 40;
      }
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#475569").text(String(item.key || "").toUpperCase(), x + 8, y);
      if (item.valorTipo === "IMAGEN") {
        drawImageOrLink(doc, item.href, x + 150, y - 5, 120, 70);
        y += 78;
      } else if (item.valorTipo === "VIDEO" || item.valorTipo === "LINK") {
        drawQrPlaceholder(doc, item.href, x + 150, y - 6);
        doc.font("Helvetica").fontSize(8).fillColor("#1d4ed8").text(item.valor || item.href, x + 205, y, { width: 290, link: item.href, underline: true });
        y += 58;
      } else {
        doc.font("Helvetica").fontSize(9).fillColor("#111827").text(item.valor || "-", x + 150, y, { width: 360 });
        y += 20;
      }
    }
    y += 8;
  }
  drawTemplateSection(doc, data.fichaTemplate?.footer, x, 785, PAGE_W - 72, 38, "#111827");
}

function drawTemplateSection(doc, section, x, y, w, h, color) {
  if (!section?.elementos?.length) return;
  const rows = groupElementsByOrder(section.elementos);
  const rowH = h / Math.max(rows.length, 1);
  rows.forEach((row, rowIndex) => {
    const colW = w / Math.max(row.items.length, 1);
    row.items.forEach((item, colIndex) => {
      const cellX = x + colIndex * colW;
      const cellY = y + rowIndex * rowH;
      const align = String(item.align || "LEFT").toLowerCase();
      if (item.tipo === "IMAGEN") {
        drawImageOrLink(doc, item.imagenPath, cellX, cellY, Math.min(Number(item.widthPx || 0) || colW - 4, colW - 4), Math.min(Number(item.heightPx || 0) || rowH - 2, rowH - 2), align, colW);
      } else {
        doc.font(item.tipo === "LINK" ? "Helvetica-Bold" : "Helvetica").fontSize(7).fillColor(color).text(item.texto || item.url || "", cellX, cellY + 2, { width: colW - 4, align, link: item.url || undefined });
      }
    });
  });
}

function drawImageOrLink(doc, source, x, y, w, h, align = "left", containerW = w) {
  const file = resolvePublicFile(source);
  if (!file) {
    if (source) doc.font("Helvetica-Bold").fontSize(7).fillColor("#1d4ed8").text(source, x, y, { width: containerW, link: source, underline: true });
    return;
  }
  try {
    const drawX = align === "center" ? x + (containerW - w) / 2 : align === "right" ? x + containerW - w : x;
    doc.image(file, drawX, y, { fit: [w, h], align: "center", valign: "center" });
  } catch {
    doc.font("Helvetica").fontSize(7).fillColor("#64748b").text("Imagen no compatible", x, y, { width: containerW });
  }
}

function drawQrPlaceholder(doc, href, x, y) {
  const image = doc._qrImages?.get(String(href || ""));
  doc.rect(x, y, 42, 42).fillAndStroke("#ffffff", "#111827");
  if (image) {
    doc.image(image, x + 2, y + 2, { fit: [38, 38] });
    return;
  }
  doc.font("Helvetica-Bold").fontSize(5).fillColor("#111827").text("QR", x, y + 17, { width: 42, align: "center" });
}

function resolvePublicFile(source) {
  if (!source || /^https?:\/\//i.test(source)) return null;
  const normalized = String(source).replace(/^\/+/, "");
  const file = path.join(process.cwd(), "public", normalized);
  return fs.existsSync(file) ? file : null;
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
  const fontPath = path.join(process.cwd(), "public", "fonts", "Autography.ttf");
  if (fs.existsSync(fontPath)) {
    doc.registerFont("Autography", fs.readFileSync(fontPath));
    doc._registeredAutography = true;
  }
}

function buildSpecGroups(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.group_id)) groups.set(row.group_id, { id: row.group_id, name: row.group_name, order: row.group_order, items: [] });
    if (row.item_id) {
      const decoded = decodeSpecValue(row.valor);
      groups.get(row.group_id).items.push({
        id: row.item_id,
        key: row.clave,
        order: row.item_order,
        ...decoded,
        href: decoded.valorPath || decoded.valorUrl || decoded.valor,
      });
    }
  });
  return Array.from(groups.values());
}

function findFirstMedia(groups) {
  for (const group of groups) {
    const media = group.items.find((item) => Number(item.order || 0) === 0 && ["IMAGEN", "VIDEO"].includes(item.valorTipo));
    if (media) return media;
  }
  return groups.flatMap((group) => group.items).find((item) => item.valorTipo === "IMAGEN");
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

async function buildQrImages(values) {
  const uniqueValues = Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
  const entries = await Promise.all(uniqueValues.map(async (value) => {
    try {
      const buffer = await QRCode.toBuffer(value, { errorCorrectionLevel: "M", margin: 1, scale: 8, type: "png" });
      return [value, buffer];
    } catch {
      return [value, null];
    }
  }));
  return new Map(entries.filter(([, buffer]) => buffer));
}
