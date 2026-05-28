import { NextResponse } from "next/server";

import { fordLeadsConfigStatus, fordLeadsFetch, fordTokenDiagnostics, normalizeFordLeadCreate, normalizeFordLeadListResponse } from "@/lib/fordLeads";
import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function unauthorized(message = "No autorizado.", status = 401) {
  return NextResponse.json({ message }, { status });
}

async function requireFordPermission(action) {
  const user = await getCurrentUser();
  if (!user) return { error: unauthorized() };
  if (!hasPerm(user.permissions || {}, ["leads_ford", action])) {
    return { error: unauthorized("No tienes permiso para Leads Ford.", 403) };
  }
  return { user };
}

function fordError(error) {
  return NextResponse.json(
    { message: error.message || "No se pudo conectar con Ford.", detail: error.payload || null },
    { status: error.status || 500 }
  );
}

function envValue(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return "";
}

function defaultStartDate() {
  return envValue("FORD_LEADS_START_DATE", "LEADS_START_DATE") || "2025-12-02T00:00:00Z";
}

function defaultEndDate() {
  return envValue("FORD_LEADS_END_DATE", "LEADS_END_DATE") || "";
}

function fordOriginFromOpportunity(origin = "", suborigin = "") {
  const text = `${origin} ${suborigin}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (text.includes("facebook")) return { origin: "Digital Dealer", subOrigin: "Facebook" };
  if (text.includes("landing")) return { origin: "Digital Dealer", subOrigin: "Landing Page" };
  if (text.includes("web") || text.includes("sitio")) return { origin: "Digital Dealer", subOrigin: "Sitio Web" };
  if (text.includes("telefon")) return { origin: "Manual", subOrigin: "Telefónico" };
  if (text.includes("evento")) return { origin: "Manual", subOrigin: "Evento" };
  if (text.includes("piso") || text.includes("showroom")) return { origin: "Manual", subOrigin: "Piso" };
  return { origin: "", subOrigin: "" };
}

function fordModelFromOpportunity(model = "") {
  const text = String(model || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const models = [
    ["mustang", "Mustang Peru"],
    ["territory", "Territory Peru"],
    ["escape", "Escape Peru"],
    ["edge", "Edge Peru"],
    ["explorer", "Explorer Peru"],
    ["expedition", "Expedition Peru"],
    ["ranger", "Ranger Peru"],
    ["f150", "F150 Peru"],
    ["f-150", "F150 Peru"],
    ["bronco sport", "Bronco Sport Peru"],
    ["maverick hibrida", "Maverick Hibrida"],
    ["maverick", "Maverick Peru"],
  ];
  return models.find(([needle]) => text.includes(needle))?.[1] || "";
}

function documentTypeFromClient(value = "") {
  const text = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (text.includes("RUC")) return "RUC";
  if (text.includes("DNI")) return "DNI";
  if (text.includes("PASAPORTE")) return "Pasaporte";
  if (text.includes("RUT")) return "RUT";
  return "";
}

function buildLeadPayloadFromOpportunity(row) {
  const leadSource = fordOriginFromOpportunity(row.origen_nombre, row.suborigen_nombre);
  const documentType = documentTypeFromClient(row.tipo_identificacion);
  const model = fordModelFromOpportunity(row.modelo_nombre);
  const contactName = [row.nombre, row.apellido].filter(Boolean).join(" ").trim();
  return {
    oportunidadId: row.id,
    oportunidadCodigo: row.oportunidad_id,
    oportunidadTexto: `${row.oportunidad_id} - ${contactName || "Sin cliente"}`,
    payload: {
      status: "Assigned",
      lastModifiedDate: new Date().toISOString(),
      contact: {
        name: contactName,
        documentType,
        documentNumber: row.identificacion_fiscal || "",
        country: "PER",
        email: row.email || "",
        phone: "",
        mobilePhoneType: "Personal",
        mobilePhone: row.celular || "",
        contactPreference: "WhatsApp",
        company: documentType === "RUC" ? row.nombre_comercial || contactName : null,
        address: {
          city: row.distrito_nombre || "",
          countryCode: "Unknown",
          street: row.domicilio || "",
          postalCode: null,
          state: row.departamento_nombre || "",
        },
      },
      vehicle: {
        model,
        version: row.version || "",
        accessories: null,
        accessoriesDetails: [],
      },
      preferenceDealer: {
        code: envValue("FORD_DEALER_CODE", "DEALER_CODE") || "00024",
        uniqueCode: envValue("FORD_DEALER_UNIQUE_CODE") || "00024Peru",
        name: envValue("FORD_DEALER_NAME") || "WANKAMOTORS",
      },
      leadSource,
    },
  };
}

async function pendingOpportunitiesForFord(user) {
  const canViewAll = hasPerm(user.permissions || {}, ["oportunidades", "viewall"]) || hasPerm(user.permissions || {}, ["leads", "viewall"]);
  const [rows] = await pool.query(
    `SELECT o.id, o.oportunidad_id, o.created_at,
            c.nombre, c.apellido, c.email, c.celular, c.tipo_identificacion,
            c.identificacion_fiscal, c.domicilio, c.nombre_comercial,
            d.nombre AS departamento_nombre, p.nombre AS provincia_nombre, di.nombre AS distrito_nombre,
            oc.name AS origen_nombre, so.name AS suborigen_nombre,
            mo.name AS modelo_nombre, vp.version
     FROM ventas_oportunidades o
     INNER JOIN administracion_clientes c ON c.id = o.cliente_id
     LEFT JOIN departamentos d ON d.id = c.departamento_id
     LEFT JOIN provincias p ON p.id = c.provincia_id
     LEFT JOIN distritos di ON di.id = c.distrito_id
     LEFT JOIN configuracion_origenes_citas oc ON oc.id = o.origen_id
     LEFT JOIN configuracion_suborigenes_citas so ON so.id = o.suborigen_id
     LEFT JOIN (
       SELECT oportunidad_id, MAX(id) AS id
       FROM ventas_cotizaciones
       GROUP BY oportunidad_id
     ) latest_quote ON latest_quote.oportunidad_id = o.id
     LEFT JOIN ventas_cotizaciones vc ON vc.id = latest_quote.id
     LEFT JOIN ventas_precios vp ON vp.id = vc.precio_id
     LEFT JOIN administracion_modelos mo ON mo.id = vp.modelo_id
     LEFT JOIN ventas_oportunidad_tokens vot ON vot.oportunidad_id = o.id
     WHERE vot.id IS NULL
     ${canViewAll ? "" : "AND (o.created_by = ? OR o.asignado_a = ?)"}
     ORDER BY o.updated_at DESC
     LIMIT 500`,
    canViewAll ? [] : [user.id, user.id]
  );
  return rows.map(buildLeadPayloadFromOpportunity);
}

async function sentFordLeads(user) {
  const [rows] = await pool.query(
    `SELECT vot.id, vot.oportunidad_id, vot.token, vot.is_actualized, vot.created_at, vot.updated_at,
            o.oportunidad_id AS oportunidad_codigo,
            CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, '')) AS cliente_nombre,
            c.email, c.celular,
            u.fullname AS creado_por_nombre
     FROM ventas_oportunidad_tokens vot
     INNER JOIN ventas_oportunidades o ON o.id = vot.oportunidad_id
     INNER JOIN administracion_clientes c ON c.id = o.cliente_id
     LEFT JOIN administracion_usuarios u ON u.id = vot.created_by
     ORDER BY vot.created_at DESC
     LIMIT 1000`
  );
  return rows.map((row) => ({
    id: row.id,
    oportunidadId: row.oportunidad_id,
    oportunidadCodigo: row.oportunidad_codigo,
    token: row.token,
    isActualized: Boolean(row.is_actualized),
    clienteNombre: String(row.cliente_nombre || "").trim(),
    email: row.email || "",
    celular: row.celular || "",
    creadoPorNombre: row.creado_por_nombre || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function GET(request) {
  try {
    const { searchParams } = request.nextUrl;
    if (searchParams.get("config") === "1") {
      const allowed = await requireFordPermission("view");
      if (allowed.error) return allowed.error;
      return NextResponse.json(fordLeadsConfigStatus());
    }

    if (searchParams.get("tokenTest") === "1") {
      const allowed = await requireFordPermission("view");
      if (allowed.error) return allowed.error;
      const data = await fordTokenDiagnostics();
      return NextResponse.json({ ...data, stage: "token", message: "Token OAuth obtenido correctamente." });
    }

    if (searchParams.get("test") === "1") {
      const allowed = await requireFordPermission("view");
      if (allowed.error) return allowed.error;

      const config = fordLeadsConfigStatus();
      const missing = [];
      if (!config.hasApplicationId) missing.push("APPLICATION_ID");
      if (!config.hasMulesoftClientSecret) missing.push("CLIENT_SECRET");
      if (!request.headers.get("x-ford-access-token") && !config.hasOauthTokenUrl) missing.push("TOKEN_URL o token temporal");
      if (!request.headers.get("x-ford-access-token") && !config.hasOauthClientId) missing.push("ENTRA_CLIENT_ID");
      if (!request.headers.get("x-ford-access-token") && !config.hasOauthClientSecret) missing.push("ENTRA_CLIENT_SECRET");
      if (!request.headers.get("x-ford-access-token") && !config.hasOauthScope) missing.push("ENTRA_SCOPE");

      const dealerCode = envValue("FORD_DEALER_CODE", "DEALER_CODE") || searchParams.get("dealerCode") || "";
      const country = envValue("FORD_COUNTRY", "COUNTRY") || searchParams.get("country") || "";
      const startDate = searchParams.get("startDate") || defaultStartDate();
      const endDate = searchParams.get("endDate") || defaultEndDate();
      if (!dealerCode) missing.push("FORD_DEALER_CODE");
      if (!country) missing.push("FORD_COUNTRY");

      if (missing.length) {
        return NextResponse.json({
          ok: false,
          stage: "config",
          message: "Faltan datos de configuracion para probar la conexion.",
          missing,
          config,
        });
      }

      const data = await fordLeadsFetch("/leads", {
        request,
        search: {
          startDate,
          endDate,
          dealerCode,
          country,
          status: searchParams.get("status") || "open",
          typeStatus: searchParams.get("typeStatus") || "",
        },
      });

      return NextResponse.json({
        ok: true,
        stage: "ford",
        message: "Conexion correcta con Ford/MuleSoft.",
        sampleCount: Array.isArray(data) ? data.length : Array.isArray(data?.items) ? data.items.length : 0,
      });
    }

    if (searchParams.get("pendingOpportunities") === "1") {
      const allowed = await requireFordPermission("create");
      if (allowed.error) return allowed.error;
      const items = await pendingOpportunitiesForFord(allowed.user);
      return NextResponse.json({ items });
    }

    if (searchParams.get("sentTokens") === "1") {
      const allowed = await requireFordPermission("view");
      if (allowed.error) return allowed.error;
      const items = await sentFordLeads(allowed.user);
      return NextResponse.json({ items });
    }

    const allowed = await requireFordPermission("sync");
    if (allowed.error) return allowed.error;

    const search = {
      startDate: searchParams.get("startDate") || defaultStartDate(),
      endDate: searchParams.get("endDate") || defaultEndDate(),
      dealerCode: envValue("FORD_DEALER_CODE", "DEALER_CODE") || searchParams.get("dealerCode") || "",
      country: envValue("FORD_COUNTRY", "COUNTRY") || searchParams.get("country") || "",
      status: searchParams.get("status") || "open",
      typeStatus: searchParams.get("typeStatus") || "",
    };

    const data = await fordLeadsFetch("/leads", { request, search });
    return NextResponse.json({ items: normalizeFordLeadListResponse(data) });
  } catch (error) {
    return fordError(error);
  }
}

export async function POST(request) {
  try {
    const allowed = await requireFordPermission("create");
    if (allowed.error) return allowed.error;

    const rawBody = await request.json();
    const body = normalizeFordLeadCreate(rawBody);
    const data = await fordLeadsFetch("/leads", { request, method: "POST", body });
    const recordId = data?.recordId || data?.id || data?.token;
    if (rawBody.oportunidadId && recordId) {
      await pool.query(
        `INSERT INTO ventas_oportunidad_tokens (oportunidad_id, token, is_actualized, created_by) VALUES (?, ?, 1, ?)`,
        [Number(rawBody.oportunidadId), String(recordId), allowed.user.id]
      );
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return fordError(error);
  }
}
