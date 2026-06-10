import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import QRCode from "qrcode";
import sharp from "sharp";

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

function dateLongText(value = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
}

function normalizeExchangeRate(value) {
  const cleaned = String(value || "").trim().replace(/[^\d.,]/g, "");
  return cleaned;
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
  const format = request.nextUrl.searchParams.get("format") === "otros" ? "otros" : "ford";
  const tc = normalizeExchangeRate(request.nextUrl.searchParams.get("tc"));

  try {
    const requiredPermission = format === "otros" ? ["cotizacion_otros", "view"] : ["cotizacion_ford", "view"];
    if (!hasPerm(user.permissions || {}, requiredPermission)) {
      return NextResponse.json({ message: "No tienes permiso para descargar este formato de cotizacion." }, { status: 403 });
    }
    const data = await loadQuoteData(id);
    if (!data.quote) return NextResponse.json({ message: "Cotizacion no encontrada." }, { status: 404 });
    const pdf = await buildFordQuotePdf(data, { full, origin: request.nextUrl.origin, format, tc });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${full ? `cotizacion-${format}-completa` : `cotizacion-${format}`}-${id}.pdf"`,
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
            c.email, c.celular, c.tipo_identificacion, c.identificacion_fiscal,
            au.fullname AS asignado, au.email AS asignado_email, au.phone AS asignado_phone,
            cu.fullname AS creado, cu.email AS asesor_email, cu.phone AS asesor_phone,
            p.id AS precio_id, p.version, p.precio_base AS catalogo_precio_base, p.en_stock, p.tiempo_entrega_dias,
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
  const [[publicLink]] = await pool.query(`SELECT token FROM ventas_cotizacion_enlaces_publicos WHERE cotizacion_id=? LIMIT 1`, [id]);

  return {
    quote,
    accessories,
    gifts,
    specGroups: buildSpecGroups(specRows),
    template: await loadTemplate("COTIZACION", quote.marca),
    fichaTemplate: await loadTemplate("FICHA_TECNICA"),
    publicToken: publicLink?.token || "",
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

async function buildFordQuotePdf(data, { full, origin, format = "ford", tc = "3.55" }) {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  registerPdfFonts(doc);
  forceBoldQuoteText(doc);
  const publicUrl = data.publicToken ? `${origin}/cotizacion/${data.publicToken}` : "";
  const catalogUrl = `${origin}/catalogo/${data.quote.precio_id}`;
  const rawMediaHrefs = data.specGroups.flatMap((group) => group.items.map((item) => item.href)).filter(Boolean);
  const mediaHrefs = data.specGroups.flatMap((group) => group.items.map((item) => getQuoteItemHref(item, origin))).filter(Boolean);
  const templateImageSources = [...getTemplateImageSources(data.template), ...getTemplateImageSources(data.fichaTemplate)];
  doc._qrImages = await buildQrImages([publicUrl, catalogUrl, ...mediaHrefs]);
  doc._pdfImages = await buildPdfImages([...rawMediaHrefs.filter(isImageHref), ...mediaHrefs.filter(isImageHref), ...templateImageSources, ...getStaticQuoteImageSources()]);
  doc._publicQuoteUrl = publicUrl;
  doc._catalogUrl = catalogUrl;
  doc._fullQuote = full;

  if (format === "otros") drawOtherQuotePage(doc, data, { tc });
  else drawQuotePageV2(doc, data);
  if (full) drawTechnicalSheetPages(doc, data);

  doc.end();
  return done;
}

function forceBoldQuoteText(doc) {
  const originalFont = doc.font.bind(doc);
  doc.font = (font, ...args) => {
    const fontName = String(font || "");
    if (fontName === "Helvetica" || fontName === "Helvetica-Oblique" || fontName === "Helvetica-BoldOblique") {
      return originalFont("Helvetica-Bold", ...args);
    }
    return originalFont(font, ...args);
  };
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
  doc.fillColor("#ffffff").font("Helvetica").fontSize(8).text(String(quote.cliente || "-").toUpperCase(), x + 48, 112, { width: 250 });
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
  const basePrice = quoteBasePrice(quote);
  const vehicleDiscount = discountAmount + basePrice * discountPercent / 100;
  const vehicleTotal = Math.max(basePrice - vehicleDiscount, 0);
  const accessoriesTotal = accessories.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const giftsTotal = gifts.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const tramites = Number(quote.precio_tramite || 0);
  const total = vehicleTotal + accessoriesTotal + giftsTotal + tramites;

  let y = 370;
  y = priceRow(doc, y, "DESCRIPCION", `${quote.modelo} ${quote.version}`, "");
  y = priceRow(doc, y, "PRECIO DE LISTA", "", money(basePrice));
  y = priceRow(doc, y, "DSCTO.", "", money(vehicleDiscount));
  y = priceRow(doc, y, "ACCESORIOS", "", money(accessoriesTotal));
  y = priceRow(doc, y, "REGALOS", "", money(giftsTotal));
  y = priceRow(doc, y, "TRAMITES", "", money(tramites));
  y = priceRow(doc, y, "TOTAL EN DOLARES", "", money(total), true);

  drawBankTable(doc, x, y + 18);
  drawSignature(doc, quote.creado || quote.asignado || "Asesor", 365, 548, getAdvisorContact(quote));

  doc.font("Helvetica-Bold").fontSize(7).fillColor("#ffffff").text("CONDICIONES DE VENTA", x, 530);
  doc.font("Helvetica").fontSize(7).text("Entrega inmediata sujeta a disponibilidad de stock\nGarantia Ford de 5 años o 150,000 km.\nSeguro: Consulte por su tasa exclusiva y atencion personalizada.", x, 545, { width: 310 });

  doc.font("Helvetica-Bold").fontSize(8).text("TERMINOS Y CONDICIONES:", x, 715);
  doc.rect(x, 728, w, 82).strokeColor("#ffffff").lineWidth(0.5).stroke();
  drawTemplateSection(doc, data.template?.footer, x + 5, 735, w - 10, 62, "#ffffff");
}

function drawQuotePageV2(doc, data) {
  drawCommercialQuotePageOne(doc, data);
  doc.addPage();
  drawCommercialQuotePageTwo(doc, data);
}

function drawQuotePageV2Legacy(doc, data) {
  const brand = String(data.quote?.marca || "").trim().toLowerCase();
  if (brand && brand !== "ford") {
    drawGenericQuotePage(doc, data);
    return;
  }

  const { quote, accessories, gifts, template } = data;
  const x = 18;
  const w = PAGE_W - 36;
  const advisorName = quote.creado || quote.asignado || "-";
  const clientName = quote.cliente || "-";
  const advisorContact = getAdvisorContact(quote);
  const advisorPhone = advisorContact.phone || "-";

  doc.rect(0, 0, PAGE_W, PAGE_H).fill("#ffffff");
  doc.save();
  doc.translate(24, 24);
  doc.scale(0.91);
  doc.fillColor("#000000");
  drawTemplateSection(doc, template?.header, x, 16, w, 58, "#000000");
  if (!template?.header?.elementos?.length) {
    doc.font("Helvetica-Bold").fontSize(7).text("WANKAMOTORS S.A.", x, 22);
    doc.font("Helvetica").fontSize(6.5).text("Jr. Faustino Quispe N°497", x, 32);
    doc.fillColor("#000000").text("www.wankamotors.pe", x, 42, { link: "https://www.wankamotors.pe", underline: true });
    doc.fillColor("#000000");
  }

  doc.font("Helvetica-Bold").fontSize(8).text(`COTIZACION N° ${String(quote.id).padStart(7, "0")}`, 220, 22, { width: 160, align: "center" });
  doc.font("Helvetica").fontSize(7).text(dateText(quote.created_at), 220, 34, { width: 160, align: "center" });

  doc.font("Helvetica-Bold").fontSize(6.8).text("SR. (A):", x, 92);
  doc.fillColor("#000000").font("Helvetica").fontSize(6.8).text(String(quote.cliente || "-").toUpperCase(), x + 48, 92, { width: 230 });
  doc.font("Helvetica-Bold").fontSize(6.8).text("DNI/RUC:", x, 106);
  doc.font("Helvetica").fontSize(6.8).text(quote.identificacion_fiscal || "-", x + 48, 106, { width: 190 });
  doc.font("Helvetica-Bold").fontSize(6.8).text("TELEF:", x, 118);
  doc.font("Helvetica").fontSize(6.8).text(quote.celular || "-", x + 48, 118, { width: 190 });
  doc.font("Helvetica-Bold").fontSize(6.8).text("CONTACTO:", x, 130);
  doc.font("Helvetica").fontSize(6.8).text(quote.cliente || "-", x + 48, 130, { width: 220 });
  doc.font("Helvetica-Bold").fontSize(6.8).text("EMAIL:", x, 142);
  doc.font("Helvetica").fontSize(6.8).text(quote.email || "-", x + 48, 142, { width: 220 });

  doc.font("Helvetica-Bold").fontSize(6.8).text("ASESOR:", 355, 92);
  doc.font("Helvetica").fontSize(6.8).text(advisorName, 405, 92, { width: 150 });
  doc.font("Helvetica-Bold").fontSize(6.8).text("TELF:", 355, 106);
  doc.font("Helvetica").fontSize(6.8).text(advisorPhone, 405, 106, { width: 150 });
  doc.font("Helvetica-Bold").fontSize(6.8).text("CELULAR:", 355, 120);
  doc.font("Helvetica").fontSize(6.8).text(advisorPhone, 405, 120, { width: 150 });
  doc.font("Helvetica-Bold").fontSize(6.8).text("EMAIL:", 355, 134);
  doc.font("Helvetica").fontSize(6.2).text(advisorContact.email || "-", 405, 134, { width: 150 });

  doc.moveTo(x, 170).lineTo(x + w, 170).strokeColor("#000000").lineWidth(0.5).stroke();
  doc.font("Helvetica").fontSize(7).fillColor("#000000").text(
    `Nos es muy grato presentarnos y, acorde a su gentil requerimiento, le remitimos la siguiente cotizacion: ${quote.marca} ${quote.modelo} ${quote.version} AÑO MODELO ${quote.anio || ""}`,
    x,
    180,
    { width: w }
  );

  drawQuoteImages(doc, findQuoteMedia(data.specGroups).filter((item) => item.href && (item.valorTipo === "IMAGEN" || isImageHref(item.href))).slice(0, 3), 95, 204, 350, 132);

  const discountAmount = Number(quote["descuento_vehículo"] || quote["descuento_vehÃ­culo"] || quote["descuento_vehÃƒÂ­culo"] || 0);
  const discountPercent = Number(quote["descuento_vehículo_porcentaje"] || quote["descuento_vehÃ­culo_porcentaje"] || quote["descuento_vehÃƒÂ­culo_porcentaje"] || 0);
  const basePrice = quoteBasePrice(quote);
  const vehicleDiscount = discountAmount + basePrice * discountPercent / 100;
  const vehicleTotal = Math.max(basePrice - vehicleDiscount, 0);
  const accessoriesTotal = accessories.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const giftsTotal = gifts.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const tramites = Number(quote.precio_tramite || 0);
  const total = vehicleTotal + accessoriesTotal + giftsTotal + tramites;

  let y = 348;
  y = priceRow(doc, y, `DESCRIPCION ${quote.modelo || ""} ${quote.version || ""}`, "MONTO US$", "", true, true);
  y = priceRow(doc, y, "PRECIO DE LISTA (1)", "", money(basePrice));
  for (const item of accessories) y = priceRow(doc, y, String(item.detalle || item.numero_parte || "ACCESORIO").toUpperCase(), "", money(item.total));
  for (const item of gifts) y = priceRow(doc, y, String(item.detalle || item.lote || "REGALO").toUpperCase(), "", money(item.total));
  y = priceRow(doc, y, "TOTAL EN DOLARES", "PRECIO FLOTA", money(vehicleTotal + accessoriesTotal + giftsTotal), true);
  y = priceRow(doc, y, "TRAMITES", "", money(tramites), true);
  y = priceRow(doc, y + 4, "TOTAL EN DOLARES", "", money(total), true);

  drawBankTable(doc, x, y + 10);
  const conditionsY = y + 80;
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#000000").text("CONDICIONES DE VENTA", x, conditionsY);
  doc.font("Helvetica").fontSize(6.5).text(
    "* Entrega inmediata sujeta a disponibilidad de stock\n* Garantia Ford de 5 años o 150,000 km. (Lo que ocurra primero)\n\nSERVICIOS OPCIONALES\n* Seguro: Consulte por su tasa exclusiva y atencion personalizada.\n* Venta de SOAT a precio especial por la compra de su auto. Consulte con su asesor.\nCORTESIAS\n* Estuche para manual del auto y libros de servicio",
    x,
    conditionsY + 18,
    { width: 305, lineGap: 1.2 }
  );
  if (doc._publicQuoteUrl) {
    drawQrPlaceholder(doc, doc._publicQuoteUrl, x, conditionsY + 116, 70);
  }
  drawSignature(doc, advisorName, 398, y + 94, advisorContact);
  drawQuoteItemsBox(doc, { accessories, gifts }, x + 332, y + 222, 205, { color: "#000000" });

  if (!doc._fullQuote) {
    doc.font("Helvetica-Bold").fontSize(6.8).fillColor("#000000").text("TERMINOS Y CONDICIONES:", x, 742);
    doc.moveTo(x, 754).lineTo(x + w, 754).strokeColor("#000000").lineWidth(0.5).stroke();
    doc.font("Helvetica-Oblique").fontSize(5.5).fillColor("#000000").text(getQuoteTerms(), x, 762, { width: w, lineGap: 0.7 });
  }
  doc.restore();
}

function drawCommercialQuotePageOne(doc, data) {
  const { quote, accessories, gifts } = data;
  const x = 24;
  const w = PAGE_W - 48;
  const advisorName = quote.creado || quote.asignado || "-";
  const clientName = quote.cliente || "-";
  const totals = getQuoteTotals(quote, accessories, gifts);
  const technicalItems = getMainTechnicalItems(data.specGroups);
  const sections = getCommercialSpecSections(data.specGroups);
  const hero = findFirstMedia(data.specGroups);
  const origin = doc._catalogUrl ? new URL(doc._catalogUrl).origin : "";

  doc.rect(0, 0, PAGE_W, PAGE_H).fill("#ffffff");
  doc.fillColor("#000000");

  drawImageOrLink(doc, getBrandLogoPath(quote.marca), x + 28, 50, 118, 64, "center", 118);
  doc.font("Helvetica-Bold").fontSize(7).text("Wankamotors SAC", 205, 58, { width: 140 });
  doc.fontSize(6.2).text("Señor (es)", 205, 68, { width: 140 });
  doc.fontSize(8).text(clientName.toUpperCase(), 205, 78, { width: 185 });
  doc.fontSize(6.2).text("Presente.-", 205, 90, { width: 140 });
  doc.fontSize(5.8).text("Estimado(s) señor(es): Por medio de la presente nos es grato saludarlo y hacerle llegar nuestra mejor", 205, 101, { width: 330 });
  doc.text("oferta del siguiente vehículo:", 205, 110, { width: 220 });
  doc.fontSize(7).text("N° Cotización", 392, 58, { width: 86 });
  doc.text(String(quote.id).padStart(7, "0"), 504, 58, { width: 52, align: "right" });
  doc.text("Fecha", 392, 72, { width: 86 });
  doc.text(dateText(quote.created_at), 504, 72, { width: 52, align: "right" });

  const vehicleTitle = [quote.marca, quote.modelo, quote.version, quote.anio].filter(Boolean).join(" ").toUpperCase();
  doc.fontSize(8.6).text(vehicleTitle || "-", x + 2, 132, { width: w - 4 });
  quoteBand(doc, x, 146, w, "Condiciones");

  // ✅ Imagen debajo de "Condiciones" (y: 158), ocupa hasta un poco arriba de "Imagen referencial"
  if (hero?.href) drawImageOrLink(doc, getQuoteItemHref(hero, origin), x + 2, 158, w - 286, 130, "center", w - 286);
  doc.fontSize(4.8).text("Imagen referencial*", x + 2, 296, { width: 120 });

  drawCommercialPriceBox(doc, x + 288, 158, 230, totals);
  doc.rect(x + 288, 218, 268, 82).fill("#f2f2f2");
  doc.fontSize(6.1).fillColor("#000000").text(
    `Los precios están expresados en dólares americanos e incluye el IGV y puede estar sujeto a variación por modificaciones en la estructura arancelaria y/o tributaria. Precio sujeto a variación sin previo aviso. El tipo de cambio referencial por hoy es S/. ${normalizeExchangeRate(quote.tc_referencial)} por USD. Promoción válida de acuerdo a stock. El precio del servicio de inmatriculación incluye servicios del tramitador y trámites de inscripción vehicular.`,
    x + 296,
    228,
    { width: 252, align: "center", lineGap: 1 }
  );

  quoteBand(doc, x, 304, w, "Especificaciones Técnicas");
  drawTechnicalMiniGrid(doc, technicalItems, x, 319, w);

  let y = 404;
  sections.forEach((section) => {
    quoteBand(doc, x, y, w, section.name);
    y += 16;
    if (section.items.length) {
      // ✅ Usa drawTechnicalMiniGrid para todas (Dimensiones, Interior, Exterior, Seguridad)
      drawTechnicalMiniGrid(doc, section.items, x, y, w);
      y += 84;
    } else {
      y += 84;
    }
  });
}

function drawCommercialQuotePageTwo(doc, data) {
  const { quote } = data;
  const x = 24;
  const w = PAGE_W - 48;
  const advisorName = quote.creado || quote.asignado || "Asesor";
  const advisorContact = getAdvisorContact(quote);

  doc.rect(0, 0, PAGE_W, PAGE_H).fill("#ffffff");
  doc.fillColor("#000000");
  doc.font("Helvetica-Bold").fontSize(7).text("N° Cotización", 392, 47, { width: 88 });
  doc.text(String(quote.id).padStart(7, "0"), 505, 47, { width: 54, align: "right" });

  quoteBand(doc, x, 72, w, "Cuentas de Wankamotors SAC con RUC 20536196901 en dólares");
  drawCommercialBankAccounts(doc, x, 86, w);

  quoteBand(doc, x, 190, w, "Proceso de entrega");
  drawDeliveryProcess(doc, x, 206, w);

  let y = 284;
  y = drawSmallInfoSection(doc, x, y, w, "Mantenimiento", "Es según el plan de mantenimiento de la cartilla del fabricante descrito en el manual de garantía.");
  quoteBand(doc, x, y, w, "Garantía");
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(8.1).text(getQuoteWarrantyText(quote), x + 2, y + 15, { width: w - 4 });
  y += 38;
  y = drawSmallInfoSection(doc, x, y, w, "Observaciones", quote.observaciones || "");
  y = drawSmallInfoSection(doc, x, y, w, "Validez de la cotización", getQuoteValidityText(quote));
  y = drawSmallInfoSection(doc, x, y, w, "Otros productos y servicios", quote.otros_productos || "");
  y = drawSmallInfoSection(doc, x, y, w, "Servicio Postventa", "Contamos con un variado stock de repuestos y una eficiente infraestructura de servicio nuestro moderno Centro de Servicio.");

  doc.fontSize(13).text("¡¡¡ SOLICITE SU PRUEBA DE MANEJO !!!", x, 566, { width: w, align: "center" });
  doc.fontSize(7).text("Sin otro en particular, quedamos de Usted.", x + 48, 612, { width: 230 });
  doc.text("Atentamente", x + 48, 624, { width: 230 });
  drawImageOrLink(doc, "/whatsapp.png", x + 250, 654, 80, 36, "center", 80);
doc.font(doc._registeredAutography ? "Autography" : "Helvetica-Oblique").fontSize(17).text(advisorName, x + 320, 654, { width: 160 });
doc.font("Helvetica-Bold").fontSize(8.5);
doc.text(`Celular: ${advisorContact.phone || ""}`, x + 320, 680, { width: 160 });
doc.text(`Correo: ${advisorContact.email || ""}`, x + 320, 692, { width: 190 });
}

function drawOtherQuotePage(doc, data, { tc = "3.55" } = {}) {
  const { quote, template } = data;
  const x = 18;
  const w = PAGE_W - 36;
  const footerH = doc._fullQuote ? 0 : 110;
  const contentBottom = PAGE_H - footerH - 24;
  const modelTitle = `${quote.modelo || ""} ${quote.version || ""}`.trim().toUpperCase();
  const discountAmount = Number(quote["descuento_vehículo"] || quote["descuento_vehÃ­culo"] || quote["descuento_vehÃƒÂ­culo"] || 0);
  const discountPercent = Number(quote["descuento_vehículo_porcentaje"] || quote["descuento_vehÃ­culo_porcentaje"] || quote["descuento_vehÃƒÂ­culo_porcentaje"] || 0);
  const basePrice = quoteBasePrice(quote);
  const vehicleDiscount = discountAmount + basePrice * discountPercent / 100;
  const vehicleTotal = Math.max(basePrice - vehicleDiscount, 0);

  doc.rect(0, 0, PAGE_W, PAGE_H).fill("#ffffff");
  doc.save();
  doc.translate(24, 24);
  doc.scale(0.91);
  doc.fillColor("#000000");
  drawTemplateSection(doc, template?.header, x, 16, 150, 72, "#000000", true);

  doc.font("Helvetica-Bold").fontSize(9).text(dateLongText(quote.created_at || new Date()), x + w - 150, 26, { width: 150, align: "right" });
  doc.font("Helvetica-Bold").fontSize(8).text("Estimado (a):", x, 78);
  doc.font("Helvetica-Bold").fontSize(8).text("DNI:", x + 338, 78);
  doc.font("Helvetica-Bold").fontSize(8).text(String(quote.cliente || "-").toUpperCase(), x, 94, { width: 250 });
  doc.text(quote.identificacion_fiscal || "-", x + 372, 94, { width: 130 });
  doc.font("Helvetica-Bold").fontSize(7.5).text(
    "Sirva la presente para saludarlo cordialmente y a la vez hacerle llegar nuestra oferta economica por el modelo detallado a continuacion:",
    x,
    120,
    { width: w, lineGap: 1 }
  );

  doc.font("Helvetica-Bold").fontSize(8).text(`MODELO ${modelTitle || "-"}`, x, 190, { width: w, align: "center" });
  const hero = findFirstMedia(data.specGroups);
  if (hero?.href) drawImageOrLink(doc, getQuoteItemHref(hero, doc._catalogUrl ? new URL(doc._catalogUrl).origin : ""), 138, 225, 320, 170, "center", 320);
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#000000").text("FOTO REFERENCIAL", x, 404, { width: w, align: "center" });

  doc.font("Helvetica-Bold").fontSize(8).text("MODELO Y PRECIO", x, 452);
  doc.moveTo(x, 466).lineTo(x + w, 466).strokeColor("#000000").lineWidth(0.5).stroke();
  doc.rect(x, 480, w, 50).strokeColor("#000000").lineWidth(0.7).stroke();
  doc.rect(x, 480, w / 2, 15).fillAndStroke("#ffffff", "#000000");
  doc.rect(x + w / 2, 480, w / 2, 15).fillAndStroke("#ffffff", "#000000");
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#000000").text(modelTitle || "-", x, 484, { width: w / 2, align: "center" });
  doc.text(`MODELO ${quote.anio || new Date().getFullYear()}`, x + w / 2, 484, { width: w / 2, align: "center" });
  doc.rect(x, 495, w / 2, 15).strokeColor("#000000").stroke();
  doc.rect(x + w / 2, 495, w / 2, 15).strokeColor("#000000").stroke();
  doc.fontSize(7.5).text("PRECIO REGULAR", x, 499, { width: w / 2, align: "center" });
  doc.text(`$${money(basePrice)}`, x + w / 2, 499, { width: w / 2, align: "center" });
  doc.rect(x, 510, w / 2, 20).strokeColor("#000000").stroke();
  doc.rect(x + w / 2, 510, w / 2, 20).strokeColor("#000000").stroke();
  doc.fontSize(13).text("PRECIO ESPECIAL", x, 515, { width: w / 2, align: "center" });
  doc.text(`$${money(vehicleTotal)}`, x + w / 2, 515, { width: w / 2, align: "center" });

  const bullets = [
    "Los precios estan expresados en dolares americanos e incluyen el I.G.V. 18%",
    "Precios sujetos a variacion sin previo aviso",
    "Tipo de cambio referencial sujeto a variacion diaria.",
    `El tipo de cambio es valido solo por hoy. TC: s/${tc}`,
    "Promocion valida deacuerdo a stock.",
  ];
  doc.font("Helvetica-Bold").fontSize(8.4).fillColor("#000000");
  bullets.forEach((item, index) => {
    doc.font("Helvetica-Bold").text("*", x + 22, 560 + index * 17);
    doc.font("Helvetica-Bold").text(item, x + 42, 560 + index * 17, { width: w - 70 });
  });

  drawSignature(doc, quote.creado || quote.asignado || "Asesor", x + w - 188, 620, getAdvisorContact(quote));
  drawQuoteItemsBox(doc, data, x + 22, 616, 300, { color: "#000000" });

  doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000").text("NOTA:", x + 22, 686);
  doc.font("Helvetica-Bold").fontSize(8).text(
    "Nuestros precios son pactados en dolares americanos de conformidad con el articulo 1237 del codigo civil debiendo ser pagados en dicha moneda. El importe en nuevos soles en esta cotizacion se consigna solo como referencia en cumplimiento de la ley 28300 y considera el tipo de cambio de venta vigente a la fecha de la presente cotizacion.",
    x + 22,
    700,
    { width: w - 238, lineGap: 1, height: Math.max(20, contentBottom - 700) }
  );

  doc.restore();
  if (!doc._fullQuote) drawWhiteTermsFooter(doc);
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
  const basePrice = quoteBasePrice(quote);
  const vehicleDiscount = discountAmount + basePrice * discountPercent / 100;
  const vehicleTotal = Math.max(basePrice - vehicleDiscount, 0);

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
  doc.text(`$${money(basePrice)}`, x + w / 2, 606, { width: w / 2, align: "center" });
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

function priceRow(doc, y, label, desc, amount, highlight = false, header = false) {
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#000000");
  doc.text(label, 24, y, { width: header ? 360 : 260 });
  doc.font(header ? "Helvetica-Bold" : "Helvetica").text(desc, header ? 440 : 300, y, { width: header ? 95 : 135, align: header ? "right" : "left" });
  doc.font("Helvetica-Bold").text(amount, 440, y, { width: 95, align: "right" });
  doc.moveTo(24, y - 2).lineTo(535, y - 2).strokeColor("#000000").lineWidth(0.4).stroke();
  return y + 13;
}

function drawBankTable(doc, x, y) {
  doc.rect(x, y, 300, 56).strokeColor("#000000").stroke();
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#000000").text("DOLARES", x + 18, y + 16);
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

function drawQuoteItemsBox(doc, data, x, y, w, { color = "#000000" } = {}) {
  const rows = [
    ...(data.accessories || []).map((item) => ({
      type: "ACCESORIO",
      qty: Number(item.cantidad || 1),
      description: item.detalle || item.numero_parte || "Accesorio",
      price: item.total,
    })),
    ...(data.gifts || []).map((item) => ({
      type: "REGALO",
      qty: Number(item.cantidad || 1),
      description: item.detalle || item.lote || "Regalo",
      price: item.total,
    })),
  ];
  if (!rows.length) return;

  const rowH = 13;
  const maxRows = Math.min(rows.length, 4);
  const h = 18 + maxRows * rowH;
  const qtyW = 35;
  const priceW = 60;
  const descW = w - qtyW - priceW;

  doc.save();
  doc.lineWidth(0.55).strokeColor(color).fillColor(color);
  doc.rect(x, y, w, h).stroke();
  doc.font("Helvetica-Bold").fontSize(6.6).text("ACCESORIOS / REGALOS", x + 4, y + 4, { width: w - 8 });
  const headerY = y + 17;
  doc.moveTo(x, headerY - 2).lineTo(x + w, headerY - 2).stroke();
  doc.font("Helvetica-Bold").fontSize(6.2);
  doc.text("CANT.", x + 3, headerY + 1, { width: qtyW - 6, align: "center" });
  doc.text("DESCRIPCION", x + qtyW + 3, headerY + 1, { width: descW - 6 });
  doc.text("PRECIO", x + qtyW + descW + 3, headerY + 1, { width: priceW - 6, align: "right" });

  rows.slice(0, maxRows).forEach((item, index) => {
    const rowY = headerY + 13 + index * rowH;
    doc.moveTo(x, rowY - 2).lineTo(x + w, rowY - 2).stroke();
    doc.font("Helvetica-Bold").fontSize(6.1).fillColor(color);
    doc.text(String(item.qty || 1), x + 3, rowY + 1, { width: qtyW - 6, align: "center" });
    doc.text(`${item.type}: ${String(item.description || "-").toUpperCase()}`, x + qtyW + 3, rowY + 1, { width: descW - 6, ellipsis: true });
    doc.text(`$${money(item.price)}`, x + qtyW + descW + 3, rowY + 1, { width: priceW - 6, align: "right" });
  });

  doc.moveTo(x + qtyW, headerY - 2).lineTo(x + qtyW, y + h).stroke();
  doc.moveTo(x + qtyW + descW, headerY - 2).lineTo(x + qtyW + descW, y + h).stroke();
  doc.restore();
}

function getAdvisorContact(quote = {}) {
  const phone = String(quote.asesor_phone || quote.asignado_phone || "").trim();
  const email = String(quote.asesor_email || quote.asignado_email || "").trim();
  return { phone, email };
}

function drawSignature(doc, name, x, y, contact = {}) {
  doc.rect(x, y, 175, 92).strokeColor("#111111").fillAndStroke("#ffffff", "#111111");
  const fontName = doc._registeredAutography ? "Autography" : "Helvetica-Oblique";
  const cleanName = String(name || "-").trim();
  let size = 30;
  doc.font(fontName).fontSize(size);
  while (doc.widthOfString(cleanName) > 145 && size > 15) {
    size -= 1;
    doc.fontSize(size);
  }
  doc.fillColor("#000000").text(cleanName, x + 15, y + 32, { width: 145, align: "center", lineBreak: false });
  const labelSize = 7;
  doc.font("Helvetica-Bold").fontSize(labelSize).fillColor("#000000").text("Firma del Vendedor", x, y + 96, { width: 175, align: "center" });
  const phone = String(contact.phone || "").trim();
  const email = String(contact.email || "").trim();
  if (phone) doc.font("Helvetica-Bold").fontSize(labelSize).text(phone, x, y + 106, { width: 175, align: "center" });
  if (email) doc.font("Helvetica-Bold").fontSize(labelSize).text(email, x, y + (phone ? 116 : 106), { width: 175, align: "center" });
}

function drawQuoteImages(doc, items, x, y, w, h) {
  const images = items.length ? items : [];
  if (!images.length) return;
  const gap = 8;
  const slotW = (w - gap * (images.length - 1)) / images.length;
  images.forEach((item, index) => {
    doc.rect(x + index * (slotW + gap), y, slotW, h).fill("#ffffff");
    drawImageOrLink(doc, item.href, x + index * (slotW + gap) + 4, y + 4, slotW - 8, h - 8, "center", slotW - 8);
  });
}

function getQuoteTotals(quote, accessories = [], gifts = []) {
  const discountAmount = Number(quote["descuento_vehículo"] || quote["descuento_vehÃ­culo"] || quote["descuento_vehÃƒÂ­culo"] || quote["descuento_vehÃƒÆ’Ã‚Â­culo"] || 0);
  const discountPercent = Number(quote["descuento_vehículo_porcentaje"] || quote["descuento_vehÃ­culo_porcentaje"] || quote["descuento_vehÃƒÂ­culo_porcentaje"] || quote["descuento_vehÃƒÆ’Ã‚Â­culo_porcentaje"] || 0);
  const price = quoteBasePrice(quote);
  const discount = discountAmount + price * discountPercent / 100;
  const finalPrice = Math.max(price - discount, 0);
  const accessoriesTotal = accessories.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const giftsTotal = gifts.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const tramites = Number(quote.precio_tramite || 0);
  return {
    price,
    discount,
    finalPrice,
    tramites,
    total: finalPrice + accessoriesTotal + giftsTotal + tramites,
  };
}

function quoteBasePrice(quote = {}) {
  return Number(quote.precio_base ?? quote.catalogo_precio_base ?? 0);
}

function quoteBand(doc, x, y, w, label) {
  doc.rect(x, y, w, 11).fill("#f0f0f0");
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(6.5).text(label, x + 2, y + 2.5, { width: w - 4 });
}

function drawCommercialPriceBox(doc, x, y, w, totals) {
  const rows = [
    ["PRECIO DE LISTA", totals.price],
    ["DESCUENTO TOTAL", -Math.abs(totals.discount)],
    ["PRECIO FINAL", totals.finalPrice],
    ["TRÁMITES", totals.tramites],
    ["TOTAL EN DOLARES", totals.total],
  ];
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(6.4);
  rows.forEach(([label, value], index) => {
    const yy = y + index * 12;
    doc.text(label, x, yy, { width: 115 });
    doc.text(`$ ${money(value)}`, x + 122, yy, { width: 78, align: "right" });
    if (index >= 2) doc.moveTo(x, yy - 2).lineTo(x + w, yy - 2).strokeColor("#000000").lineWidth(1).stroke();
  });
}

function drawTechnicalMiniGrid(doc, items, x, y, w) {
  const rows = 10;
  const pairW = w / 2;
  const labelW = 132;
  const rowH = 7.5;
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(5.4);
  items.slice(0, rows * 2).forEach((item, index) => {
    const pair = Math.floor(index / rows);
    const row = index % rows;
    const xx = x + pair * pairW;
    const yy = y + row * rowH;
    doc.text(String(item.key || "").toUpperCase(), xx + 2, yy, { width: labelW, height: rowH, ellipsis: true });
    doc.text(formatSpecDisplayValue(item), xx + labelW + 4, yy, { width: pairW - labelW - 8, height: rowH, ellipsis: true });
  });
}

function drawEquipmentColumns(doc, items, x, y, w) {
  const rows = 13;
  const pairs = 3;
  const pairW = w / pairs;
  const labelW = pairW - 23;
  const valueW = 18;
  const rowH = 4.7;
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(5);
  let cursor = 0;
  items.slice(0, rows * pairs).forEach((item) => {
    if (cursor >= rows * pairs) return;
    const pair = Math.floor(cursor / rows);
    const row = cursor % rows;
    const value = formatSpecDisplayValue(item) || "√";
    const label = String(item.key || "").toUpperCase();
    const isLong = label.length > 28;
    const xx = x + pair * pairW;
    const yy = y + row * rowH;
    doc.text(label, xx + 2, yy, { width: labelW, height: isLong ? rowH * 2 : rowH, ellipsis: true });
    doc.text(value, xx + labelW + 4, yy, { width: valueW, height: rowH, align: "center", ellipsis: true });
    cursor += isLong && row < rows - 1 ? 2 : 1;
  });
}

function drawCommercialBankAccounts(doc, x, y, w) {
  const rows = [
    ["Interbank", "Dólares", "512-3001402018", "003-512-003001402018-11"],
    ["Interbank", "Soles", "512-3001402000", "003-512-003001402000-19"],
    ["BBVA", "Dólares", "0011-0967-0100003994", "011-967-000100003994-79"],
    ["BBVA", "Soles", "0011-0967-0100003986", "011-967-000100003986-75"],
    ["BCP", "Dólares", "355-2475827-1-19", "002-355-002475827119-61"],
    ["BCP", "Soles", "355-2506034-0-32", "002-355-002506034032-67"],
    ["SCOTIABANK (Ahorros)", "Dólares", "943-0151732", "009-943-219430151732-21"],
    ["SCOTIABANK", "Soles", "000-0155685", "004-023-000000155685-51"],
  ];
  const widths = [120, 95, 150, w - 365];
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(6.2);
  ["Entidad", "Moneda", "Cuenta Corriente", "CCI"].forEach((label, index) => {
    const xx = x + widths.slice(0, index).reduce((a, b) => a + b, 0);
    doc.text(label, xx, y, { width: widths[index], align: "center" });
  });
  doc.fontSize(6);
  rows.forEach((row, r) => {
    row.forEach((value, c) => {
      const xx = x + widths.slice(0, c).reduce((a, b) => a + b, 0);
      doc.text(value, xx, y + 12 + r * 10, { width: widths[c], align: "center" });
    });
  });
}

function drawDeliveryProcess(doc, x, y, w) {
  const steps = [
    "El plazo inicia con la fecha tentativa firma de cláusulas adicionales",
    "Legalización de firmas",
    "Inscripción en SUNARP y trámite de Tarjeta de Identificación vehicular",
    "Inscripción en AAP y trámite de Placas de rodaje",
    "Inspección final del vehículo",
    "El gran día de la entrega",
  ];
  const colW = w / steps.length;
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(5.8);
  steps.forEach((step, index) => doc.text(step, x + index * colW + 2, y, { width: colW - 4, align: "center" }));
  doc.rect(x, y + 42, w, 18).fill("#f2f2f2");
  // ✅ aumentado de 6.1 a 7.2
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(8.1).text(
    "Sujeto a disponibilidad de stock. Si existiera alguna observación de Registros Públicos durante el trámite de registro vehicular que ocasione demora en la entrega de la placa y tarjeta, este retraso no será imputable a Wankamotors.",
    x + 8,
    y + 42,
    { width: w - 16, align: "center" }
  );
}

function drawSmallInfoSection(doc, x, y, w, title, body) {
  quoteBand(doc, x, y, w, title);
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(6.1).text(body, x + 2, y + 15, { width: w - 4 });
  return y + 38;
}

function getQuoteWarrantyText(quote = {}) {
  const brand = normalizeSpecName(quote.marca);
  const model = normalizeSpecName(quote.modelo);
  if (brand === "MG" || brand.startsWith("MG ")) {
    return "Garantía MG de 8 años o 150,000 Km, lo que ocurra primero";
  }
  if (brand.includes("FORD") && model.includes("RANGER")) {
    return "Garantía Ford de 5 años o 150,000 km /ranger";
  }
  if (brand.includes("FORD")) {
    return "3 años o 100,000 kilómetros, lo que ocurra primero";
  }
  return "5 años o 100,000 kilómetros, lo que ocurra primero";
}

function getQuoteValidityText(quote = {}) {
  const days = String(quote.sku || "").trim();
  return days ? `${days} días calendario a partir de la fecha` : "";
}

function getMainTechnicalItems(groups) {
  const all = getTextSpecItems(groups);
  const preferred = ["TORQUE", "TRACCION", "TRANSMISION", "CILINDRADA", "COMBUSTIBLE", "DIRECCION", "FRENOS", "POTENCIA"];
  const picked = preferred
    .map((name) => all.find((item) => normalizeSpecName(item.key).includes(name)))
    .filter(Boolean);
  return [...picked, ...all.filter((item) => !picked.includes(item))].slice(0, 20);
}

function getCommercialSpecSections(groups) {
  const textGroups = groups
    .map((group) => ({
      name: String(group.name || "").trim(),
      items: (group.items || []).filter((item) => item.valorTipo !== "IMAGEN" && item.valorTipo !== "VIDEO" && !isImageHref(getQuoteItemHref(item)) && !isVideoHref(getQuoteItemHref(item))),
    }))
    .filter((group) => group.items.length);
  const names = ["Dimensiones", "Interior", "Exterior", "Seguridad"];
  const used = new Set();
  return names.map((name) => {
    const match = textGroups.find((group) => !used.has(group) && normalizeSpecName(group.name).includes(normalizeSpecName(name)));
    if (match) {
      used.add(match);
      return { name, items: match.items };
    }
    const next = textGroups.find((group) => !used.has(group));
    if (next) {
      used.add(next);
      return { name, items: next.items };
    }
    return { name, items: [] };
  });
}

function getTextSpecItems(groups) {
  return groups.flatMap((group) =>
    (group.items || []).filter((item) => item.valorTipo !== "IMAGEN" && item.valorTipo !== "VIDEO" && !isImageHref(getQuoteItemHref(item)) && !isVideoHref(getQuoteItemHref(item)))
  );
}

function normalizeSpecName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function formatSpecDisplayValue(item) {
  const text = String(technicalSpecValue(item) || "").trim();
  if (!text) return "";
  if (/^(si|sí|true|1)$/i.test(text)) return "√";
  return text;
}

function getStaticQuoteImageSources() {
  return [
    "/uploads/ventas-plantillas/1778903910517-dbde795c-2743-4130-b988-fb087a3aa1ad.png",
    "/uploads/ventas-plantillas/1778903789437-5f2f7cf4-dd3b-400f-a932-668a17fd3ad1.jpg",
    "/uploads/ventas-plantillas/mglogo.jpeg",
    "/whatsapp.png",
  ];
}

function getBrandLogoPath(brand) {
  const name = normalizeSpecName(brand);
  if (name.includes("FORD")) return "/uploads/ventas-plantillas/1778903789437-5f2f7cf4-dd3b-400f-a932-668a17fd3ad1.jpg";
  if (name === "MG" || name.startsWith("MG ")) return "/uploads/ventas-plantillas/mglogo.jpeg";
  return "/uploads/ventas-plantillas/1778903910517-dbde795c-2743-4130-b988-fb087a3aa1ad.png";
}

function findQuoteMedia(groups) {
  const items = groups.flatMap((group) => group.items || []);
  const orderZero = items.filter((item) => Number(item.order || 0) === 0 && ["IMAGEN", "VIDEO", "LINK"].includes(item.valorTipo));
  return orderZero.length ? orderZero : items.filter((item) => ["IMAGEN", "VIDEO", "LINK"].includes(item.valorTipo));
}

function isImageHref(value) {
  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(String(value || "").trim());
}

function getQuoteTerms() {
  return "Especificaciones tecnicas proporcionadas por Ford Peru S.R.L, pueden variar sin previo aviso.\n(1) Monto expresado en dolares americanos incluido IGV, no incluye el costo por concepto de flete de Lima a provincias. Precio sujeto a variacion por modificaciones en la estructura arancelaria y/o tributaria. Para separar y/o reservar su unidad, el monto minimo es del 10%. (2) El precio del kit de proteccion incluye la instalacion de seguro de ruedas, emblemas. (3) El precio de las laminas de seguridad incluye la instalacion. (4) El precio del servicio de inmatriculacion incluye servicios del tramitador, tramites de inscripcion vehicular y Declaracion Jurada Municipal al SAT. (5) Tipo de Cambio tiene validez en el dia, precio expresado en soles incluido IGV segun Tipo de Cambio referencial de 3.860. Esta cotizacion tiene validez en el dia.\nSe deja constancia que si desiste de la compra y desea la devolución, estará afecta a un % de retención por concepto de gastos administrativos y que el monto en materia de devolución está afecta a 20 días hábiles, cualquier cambio adicional que no conste en la presente no será responsabilidad de la empresa. La entrega está sujeta a stock, los plazos de entrega pueden sufrir variación por posibles demoras en la entrega del vehículo por parte de la marca, por tal caso no será imputable al vendedor o a WANKAMOTORS, cabe resaltar que el precio puede sufrir variación por factores ajenos a WANKAMOTORS y estipulados por la marca. Una vez emitido el mismo no se aceptará su cambio ni canje. Por tal motivo agradecemos verificar la información.";
}

function getFordTerms() {
  return "Especificaciones tecnicas proporcionadas por Ford Peru S.R.L, pueden variar sin previo aviso.\n(1) Monto expresado en dolares americanos incluido IGV, no incluye el costo por concepto de flete de Lima a provincias. Precio sujeto a variacion por modificaciones en la estructura arancelaria y/o tributaria. Para separar y/o reservar su unidad, el monto minimo es del 10%. (2) El precio del kit de proteccion incluye la instalacion de seguro de ruedas, emblemas. (3) El precio de las laminas de seguridad incluye la instalacion. (4) El precio del servicio de inmatriculacion incluye servicios del tramitador, tramites de inscripcion vehicular y Declaracion Jurada Municipal al SAT. (5) Tipo de Cambio tiene validez en el dia, precio expresado en soles incluido IGV segun Tipo de Cambio referencial de 3.860. Esta cotizacion tiene validez en el dia.\nSe deja constancia que si desiste de la compra y desea la devolución, estará afecta a un % de retenciónRÁ AFECTA A UN % DE RETENCIÓN POR CONCEPTO DE GASTOS ADMINISTRATIVOS Y QUE EL MONTO EN MATERIA DE DEVOLUCIÓN ESTÁ AFECTA A 20 DÍAS HÁBILES, CUALQUIER CAMBIO ADICIONAL QUE NO CONSTE EN LA PRESENTE NO SERÁ RESPONSABILIDAD DE LA EMPRESA. LA ENTREGA ESTÁ SUJETA A STOCK, LOS PLAZOS DE ENTREGA PUEDEN SUFRIR VARIACIÓN POR POSIBLES DEMORAS EN LA ENTREGA DEL VEHÍCULO POR PARTE DE LA MARCA, POR TAL CASO NO SERÁ IMPUTABLE AL VENDEDOR O A WANKAMOTORS, CABE RESALTAR QUE EL PRECIO PUEDE SUFRIR VARIACIÓN POR FACTORES EXTERNOS AJENOS A WANKAMOTORS Y ESTIPULADOS POR LA MARCA. UNA VEZ EMITIDO EL MISMO NO SE ACEPTARÁ SU CAMBIO NI CANJE. POR TAL MOTIVO AGRADECEMOS VERIFICAR LA INFORMACIÓN REGISTRADA, EN SEÑAL DE CONFORMIDAD EL CLIENTE DEJA COMO CONSTANCIA SU FIRMA.";
}

function drawWhiteTermsFooter(doc) {
  const x = 24;
  const y = 728;
  const w = PAGE_W - 48;
  doc.rect(0, y - 10, PAGE_W, PAGE_H - y + 10).fill("#ffffff");
  doc.font("Helvetica-Bold").fontSize(6.6).fillColor("#000000").text("TERMINOS Y CONDICIONES:", x, y, { width: w });
  doc.font("Helvetica-Bold").fontSize(4.8).fillColor("#000000").text(getQuoteTerms(), x, y + 10, { width: w, lineGap: 0.4 });
}

function drawTechnicalSheetPages(doc, data) {
  doc.addPage();
  drawTechnicalPageShell(doc);

  const price = {
    marca: data.quote.marca,
    modelo: data.quote.modelo,
    version: data.quote.version,
  };
  const previewItems = getTechnicalPreviewItems(data.specGroups);
  const sectionGroups = data.specGroups
    .map((group) => ({
      ...group,
      items: (group.items || []).filter((item) => Number(item.order || 0) !== 0),
    }))
    .filter((group) => group.items.length);
  const origin = doc._catalogUrl ? new URL(doc._catalogUrl).origin : "";

  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(10).text("FICHA TECNICA VEHICULAR", 42, 42, { width: 511, align: "center" });
  doc.fontSize(18).text(`${price.marca || ""} ${price.modelo || ""}`.trim().toUpperCase() || "-", 42, 62, { width: 511, align: "center" });
  doc.font("Helvetica-Bold").fontSize(11).text(String(price.version || "-").toUpperCase(), 42, 86, { width: 511, align: "center" });
  doc.moveTo(42, 112).lineTo(553, 112).strokeColor("#000000").lineWidth(0.8).stroke();
  doc.y = 128;

  drawTechnicalPreviewItems(doc, previewItems, null, origin);

  for (const group of sectionGroups) {
    drawTechnicalTableGroup(doc, group, origin);
  }

  drawFinalTermsAtEnd(doc);
}

function drawTechnicalPageShell(doc) {
  doc.rect(0, 0, PAGE_W, PAGE_H).fill("#ffffff");
  doc.x = 42;
  doc.y = 42;
}

function drawTechnicalTemplateSection(doc, section) {
  if (!section?.elementos?.length) return;
  const rows = groupElementsByOrder(section.elementos);
  doc.moveDown(0.2);
  for (const row of rows) {
    const y = doc.y;
    const width = 523 / Math.max(row.items.length, 1);
    row.items.forEach((item, index) => drawTechnicalTemplateElement(doc, item, 36 + index * width, y, width - 8));
    doc.y = Math.max(doc.y, y + 24);
  }
  doc.moveDown(0.5);
}

function drawTechnicalTemplateElement(doc, item, x, y, width) {
  const align = String(item.align || "LEFT").toLowerCase();
  const href = item.imagenPath || item.url;
  if (item.tipo === "IMAGEN") {
    drawImageOrLink(doc, href, x, y, Math.min(Number(item.widthPx) || width, width), Number(item.heightPx) || 42, align, width);
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
  doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold").text(item.texto || "", x, y, { width, align });
}

function drawTechnicalGroupTitle(doc, title, y) {
  doc.roundedRect(36, y, 523, 26, 6).fillAndStroke("#eef2ff", "#dbeafe");
  doc.fillColor("#5b21b6").fontSize(13).font("Helvetica-Bold").text(String(title || "").toUpperCase(), 48, y + 7, { width: 495 });
}

function getTechnicalSpecCardHeight(doc, item, origin, width) {
  const href = getQuoteItemHref(item, origin);
  const imageLike = item.valorTipo === "IMAGEN" || isImageHref(href);
  const videoLike = item.valorTipo === "VIDEO" || isVideoHref(href);
  const linkLike = item.valorTipo === "LINK";
  if (imageLike) return 86;
  if (videoLike || linkLike) return 62;

  const keyText = String(item.key || "").toUpperCase();
  const valueText = technicalSpecValue(item);
  const keyH = doc.heightOfString(keyText, { width: width - 24, lineGap: 1 });
  const valueH = valueText ? doc.heightOfString(valueText, { width: width - 24, lineGap: 1 }) : 0;
  return Math.max(26, keyH + valueH + (valueText ? 19 : 12));
}

function drawTechnicalSpecCard(doc, item, x, y, width, height, origin) {
  const href = getQuoteItemHref(item, origin);
  const imageLike = item.valorTipo === "IMAGEN" || isImageHref(href);
  const videoLike = item.valorTipo === "VIDEO" || isVideoHref(href);
  const linkLike = item.valorTipo === "LINK";
  const keyText = String(item.key || "").toUpperCase();

  doc.roundedRect(x, y, width, height, 5).fillAndStroke("#f8fafc", "#e2e8f0");
  doc.fillColor("#64748b").fontSize(7.2).font("Helvetica-Bold").text(keyText, x + 10, y + 8, { width: width - 20, lineGap: 1 });

  if (imageLike) {
    drawImageOrLink(doc, href, x + 10, y + 26, Math.min(118, width - 82), 50, "left", Math.min(118, width - 82));
    drawQrPlaceholder(doc, href, x + width - 60, y + 26, 44);
    return;
  }

  if (videoLike || linkLike) {
    drawQrPlaceholder(doc, href, x + width - 58, y + 16, 44);
    doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text(videoLike ? "Escanear video" : "Escanear enlace", x + 10, y + 31, { width: width - 78 });
    return;
  }

  const valueText = technicalSpecValue(item);
  if (valueText) doc.fillColor("#0f172a").fontSize(9.2).font("Helvetica-Bold").text(valueText, x + 10, y + 24, { width: width - 20, lineGap: 1 });
}

function drawTechnicalPreviewItems(doc, previewItems, template, origin) {
  if (!previewItems.length) return;

  const previewRows = previewItems.map((item) => {
    const href = getQuoteItemHref(item, origin);
    const videoLike = item.valorTipo === "VIDEO" || isVideoHref(href);
    return { item, href, videoLike };
  });
  const qrSize = 58;
  const gap = 16;
  const columns = 4;
  const rows = Math.ceil(previewRows.length / columns);
  const sectionH = rows * (qrSize + 24) + 18;

  ensureTechnicalSpace(doc, sectionH + 12, template);
  const startY = doc.y;
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#000000").text("MULTIMEDIA", 42, startY, { width: 511 });
  doc.moveTo(42, startY + 13).lineTo(553, startY + 13).strokeColor("#000000").lineWidth(0.4).stroke();

  for (let index = 0; index < previewRows.length; index++) {
    const { href } = previewRows[index];
    const col = index % columns;
    const row = Math.floor(index / columns);
    const slotW = (511 - gap * (columns - 1)) / columns;
    const x = 42 + col * (slotW + gap);
    const y = startY + 24 + row * (qrSize + 24);
    drawQrPlaceholder(doc, href, x + (slotW - qrSize) / 2, y, qrSize);
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#000000").text("Multimedia del codigo QR", x, y + qrSize + 5, { width: slotW, align: "center" });
  }

  doc.y = startY + sectionH + 12;
}

function drawTechnicalTableGroup(doc, group, origin) {
  const gridX = 42;
  const gridW = 511;
  const gap = 12;
  const colW = (gridW - gap) / 2;
  ensureTechnicalSpace(doc, 20, null);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000").text(String(group.name || "").toUpperCase(), gridX, doc.y, { width: gridW });
  doc.y += 9;
  doc.moveTo(gridX, doc.y).lineTo(gridX + gridW, doc.y).strokeColor("#000000").lineWidth(0.45).stroke();
  doc.y += 3;

  const items = group.items || [];
  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2);
    const rowH = Math.max(...pair.map((item) => getTechnicalSpecTileHeight(doc, item, origin, colW)));
    ensureTechnicalSpace(doc, rowH + 2, null);
    const y = doc.y;
    pair.forEach((item, index) => {
      drawTechnicalSpecTile(doc, item, gridX + index * (colW + gap), y, colW, rowH, origin);
    });
    doc.y = y + rowH + 1;
  }
  doc.y += 2;
}

function getTechnicalSpecTileHeight(doc, item, origin, width) {
  const href = getQuoteItemHref(item, origin);
  const mediaLike = item.valorTipo === "VIDEO" || isVideoHref(href);
  const keyText = String(item.key || "").toUpperCase();
  const valueText = mediaLike ? "Ver multimedia con codigo QR" : technicalSpecValue(item);
  const keyH = doc.font("Helvetica-Bold").fontSize(6.4).heightOfString(keyText, { width, lineGap: 0 });
  const valueH = valueText ? doc.font("Helvetica-Bold").fontSize(7.4).heightOfString(valueText, { width, lineGap: 0 }) : 0;
  return Math.max(mediaLike ? 62 : 13, keyH + valueH + (mediaLike ? 38 : valueText ? 5 : 1));
}

function drawTechnicalSpecTile(doc, item, x, y, width, height, origin) {
  const href = getQuoteItemHref(item, origin);
  const mediaLike = item.valorTipo === "VIDEO" || isVideoHref(href);
  const keyText = String(item.key || "").toUpperCase();
  const valueText = mediaLike ? "Ver multimedia con codigo QR" : technicalSpecValue(item);
  doc.font("Helvetica-Bold").fontSize(6.4).fillColor("#000000").text(keyText, x, y, { width, lineGap: 0 });
  const keyH = doc.heightOfString(keyText, { width, lineGap: 0 });
  if (valueText) doc.font("Helvetica-Bold").fontSize(7.4).fillColor("#000000").text(valueText, x, y + keyH + 1, { width, lineGap: 0 });
  if (mediaLike) drawQrPlaceholder(doc, href, x + (width - 32) / 2, y + height - 34, 32);
  doc.moveTo(x, y + height).lineTo(x + width, y + height).strokeColor("#d1d5db").lineWidth(0.25).stroke();
}

function technicalSpecValue(item) {
  const value = item?.valor;
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function drawFinalTermsAtEnd(doc) {
  const text = getQuoteTerms();
  const x = 42;
  const w = 511;
  const titleH = 12;
  doc.font("Helvetica-Bold").fontSize(5.6);
  const bodyH = doc.heightOfString(text, { width: w, lineGap: 0.8 });
  const needed = titleH + bodyH + 10;
  const footerY = PAGE_H - 34 - needed;
  if (doc.y > footerY) {
    doc.addPage();
    drawTechnicalPageShell(doc);
  }
  doc.y = PAGE_H - 34 - needed;
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#000000").text("TERMINOS Y CONDICIONES:", x, doc.y);
  doc.y += titleH;
  doc.font("Helvetica-Bold").fontSize(5.6).fillColor("#000000").text(text, x, doc.y, { width: w, lineGap: 0.8 });
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

function ensureTechnicalSpace(doc, needed, template) {
  if (doc.y + needed <= 790) return;
  drawTechnicalTemplateSection(doc, template?.footer);
  doc.addPage();
  drawTechnicalPageShell(doc);
  drawWatermark(doc, template?.watermark);
  drawTechnicalTemplateSection(doc, template?.header);
}



function getTechnicalPreviewItems(groups) {
  return groups.flatMap((group) =>
    (group.items || [])
      .filter((item) => Number(item.order || 0) === 0 && (item.valorTipo === "VIDEO" || isVideoHref(getQuoteItemHref(item))))
      .map((item) => ({ ...item, groupName: group.name }))
  );
}

function getQuoteItemHref(item, origin = "") {
  return absoluteLocalUrl(item?.valorPath || item?.valorUrl || item?.valor || item?.href || "", origin);
}

function absoluteLocalUrl(value, origin = "") {
  const text = String(value || "").trim();
  if (!text || /^https?:\/\//i.test(text) || !text.startsWith("/") || !origin) return text;
  return `${origin}${text}`;
}

function isVideoHref(value) {
  const text = String(value || "").trim();
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(text) || /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(text);
}

function drawTemplateSection(doc, section, x, y, w, h, color, forceBold = false) {
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
        doc.font(forceBold || item.tipo === "LINK" ? "Helvetica-Bold" : "Helvetica").fontSize(7).fillColor(color).text(item.texto || item.url || "", cellX, cellY + 2, { width: colW - 4, align, link: item.url || undefined });
      }
    });
  });
}

function drawImageOrLink(doc, source, x, y, w, h, align = "left", containerW = w) {
  const image = doc._pdfImages?.get(String(source || "").trim()) || resolvePublicFile(source);
  if (!image) {
    if (source) doc.font("Helvetica-Bold").fontSize(7).fillColor("#1d4ed8").text(source, x, y, { width: containerW, link: source, underline: true });
    return;
  }
  try {
    const drawX = align === "center" ? x + (containerW - w) / 2 : align === "right" ? x + containerW - w : x;
    doc.image(image, drawX, y, { fit: [w, h], align: "center", valign: "center" });
  } catch {
    doc.font("Helvetica").fontSize(7).fillColor("#64748b").text("Imagen no compatible", x, y, { width: containerW });
  }
}

function drawQrPlaceholder(doc, href, x, y, size = 42) {
  const image = doc._qrImages?.get(String(href || ""));
  doc.rect(x, y, size, size).fillAndStroke("#ffffff", "#111827");
  if (image) {
    doc.image(image, x + 2, y + 2, { fit: [size - 4, size - 4] });
    return;
  }
  doc.font("Helvetica-Bold").fontSize(5).fillColor("#111827").text("QR", x, y + size / 2 - 4, { width: size, align: "center" });
}

function resolvePublicFile(source) {
  if (!source || /^https?:\/\//i.test(source)) return null;
  const normalized = String(source).replace(/^\/+/, "");
  const file = path.join(process.cwd(), "public", normalized);
  return fs.existsSync(file) ? file : null;
}

function registerPdfFonts(doc) {
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
      const file = resolvePublicFile(value);
      if (file) return [value, await normalizePdfImage(fs.readFileSync(file), value, "")];
      if (!/^https?:\/\//i.test(value)) return [value, null];
      const response = await fetch(value, { cache: "no-store" });
      if (!response.ok) return [value, null];
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.startsWith("image/") && !isImageHref(value)) return [value, null];
      return [value, await normalizePdfImage(Buffer.from(await response.arrayBuffer()), value, contentType)];
    } catch {
      return [value, null];
    }
  }));
  return new Map(entries.filter(([, image]) => image));
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
