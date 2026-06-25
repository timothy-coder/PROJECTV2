import { NextResponse } from "next/server";

import { fordLeadsFetch, normalizeFordLeadListResponse, normalizeFordLeadPatch, normalizeFordLeadResponse } from "@/lib/fordLeads";
import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

const TIMEZONE = "America/Lima";

function envValue(...names) {
  for (const name of names) {
    if (process.env[name]) return String(process.env[name]).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

function limaDatePart() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function todayStartDate() {
  return `${limaDatePart()}T00:00:00Z`;
}

function todayEndDate() {
  return `${limaDatePart()}T23:59:59Z`;
}

function limaTimeParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value || 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value || 0),
  };
}

function minutesOfDay(value) {
  const [hour = "0", minute = "0"] = String(value || "").split(":");
  return Number(hour) * 60 + Number(minute);
}

async function canRunBySchedule({ force = false, windowMinutes = 5 } = {}) {
  if (force) return { ok: true, currentTime: "", configured: [] };
  const [rows] = await pool.query(`SELECT id, hora FROM configuracion_horas ORDER BY hora ASC`);
  if (!rows.length) {
    const now = limaTimeParts();
    return {
      ok: true,
      currentTime: `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`,
      configured: [],
      reason: "Sin horas configuradas: ejecucion cada 5 minutos habilitada.",
    };
  }
  const now = limaTimeParts();
  const current = now.hour * 60 + now.minute;
  const match = rows.some((row) => Math.abs(current - minutesOfDay(row.hora)) <= windowMinutes);
  return {
    ok: match,
    currentTime: `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`,
    configured: rows.map((row) => ({ id: row.id, hora: String(row.hora).slice(0, 5) })),
  };
}

async function authorize(request) {
  const secret = envValue("FORD_SYNC_SECRET", "CRON_SECRET");
  const headerSecret = request.headers.get("x-ford-sync-secret") || request.nextUrl.searchParams.get("secret");
  const bearerSecret = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const cronHeader = request.headers.get("x-vercel-cron");
  const userAgent = request.headers.get("user-agent") || "";
  const isVercelCron = process.env.VERCEL === "1" && (cronHeader === "1" || /vercel-cron/i.test(userAgent));
  const systemUser = async () => {
    const userId = Number(envValue("FORD_SYNC_USER_ID"));
    if (userId) return { id: userId, permissions: {} };
    const [[user]] = await pool.query(`SELECT id, permissions FROM administracion_usuarios WHERE is_active = 1 ORDER BY id ASC LIMIT 1`);
    if (user) return { id: user.id, permissions: user.permissions ? JSON.parse(user.permissions) : {} };
    return null;
  };
  if (secret && bearerSecret === secret) {
    return systemUser();
  }
  if (secret && headerSecret === secret) {
    return systemUser();
  }
  if (isVercelCron) {
    return systemUser();
  }

  const user = await getCurrentUser();
  if (!user) return null;
  if (!hasPerm(user.permissions || {}, ["leads_ford", "sync"])) return null;
  return user;
}

async function nextLfCode(connection) {
  const year = new Date().getFullYear();
  const [rows] = await connection.query(
    `SELECT oportunidad_id FROM ventas_oportunidades WHERE oportunidad_id LIKE ? ORDER BY id DESC LIMIT 1`,
    [`LF-${year}-%`]
  );
  const last = Number(String(rows[0]?.oportunidad_id || "").split("-").pop() || 0);
  return `LF-${year}-${String(last + 1).padStart(3, "0")}`;
}

async function stageId(connection) {
  const [assigned] = await connection.query(`SELECT id FROM ventas_etapasconversion WHERE LOWER(nombre)=LOWER('Asignado') LIMIT 1`);
  if (assigned[0]) return assigned[0].id;
  const [fallback] = await connection.query(`SELECT id FROM ventas_etapasconversion ORDER BY COALESCE(sort_order, id) ASC LIMIT 1`);
  return fallback[0]?.id || null;
}

async function originIds(connection, lead) {
  const origin = lead.leadSource?.origin || "Ford Digital Peru";
  const subOrigin = lead.leadSource?.subOrigin || "";
  const [originRows] = await connection.query(
    `SELECT id FROM configuracion_origenes_citas WHERE is_active = 1 AND LOWER(name) = LOWER(?) LIMIT 1`,
    [origin]
  );
  const [fallbackOrigins] = originRows.length ? [[]] : await connection.query(`SELECT id FROM configuracion_origenes_citas WHERE is_active = 1 ORDER BY id ASC LIMIT 1`);
  const origenId = originRows[0]?.id || fallbackOrigins[0]?.id || null;

  if (!origenId) return { origenId: null, suborigenId: null };
  const [subRows] = subOrigin
    ? await connection.query(
      `SELECT id FROM configuracion_suborigenes_citas WHERE is_active = 1 AND origen_id = ? AND LOWER(name) = LOWER(?) LIMIT 1`,
      [origenId, subOrigin]
    )
    : [[]];
  const [fallbackSubs] = subRows.length ? [[]] : await connection.query(`SELECT id FROM configuracion_suborigenes_citas WHERE is_active = 1 AND origen_id = ? ORDER BY id ASC LIMIT 1`, [origenId]);
  return { origenId, suborigenId: subRows[0]?.id || fallbackSubs[0]?.id || null };
}

function splitName(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { nombre: "", apellido: "" };
  if (parts.length === 1) return { nombre: parts[0], apellido: "" };
  return { nombre: parts.slice(0, -1).join(" "), apellido: parts.at(-1) };
}

function firstWord(value = "") {
  return String(value || "").trim().split(/\s+/).filter(Boolean)[0] || "";
}

function normalizeModelWord(value = "") {
  return firstWord(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

async function findOrCreateClient(connection, lead, userId) {
  const contact = lead.contact || {};
  const doc = contact.documentNumber || "";
  const email = contact.email || "";
  const [[existing]] = doc
    ? await connection.query(`SELECT id FROM administracion_clientes WHERE identificacion_fiscal = ? LIMIT 1`, [doc])
    : email
      ? await connection.query(`SELECT id FROM administracion_clientes WHERE email = ? LIMIT 1`, [email])
      : [[]];
  if (existing?.id) return existing.id;

  const { nombre, apellido } = splitName(contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" "));
  const [result] = await connection.query(
    `INSERT INTO administracion_clientes
     (id_lead, nombre, apellido, email, celular, tipo_identificacion, identificacion_fiscal,
      domicilio, nombre_comercial, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE(), ?)`,
    [
      lead.id || null,
      nombre || contact.company || "Cliente Ford",
      apellido,
      email,
      contact.mobilePhone || contact.mobileComplete || "",
      contact.documentType || "",
      doc,
      contact.address?.street || "",
      contact.documentType === "RUC" ? contact.company || contact.name || "" : "",
      userId,
    ]
  );
  return result.insertId;
}

async function pickAssignedUserByCount(connection) {
  const [rows] = await connection.query(
    `SELECT auc.id, auc.usuario_id, auc.count
     FROM administracion_usuario_counts auc
     INNER JOIN administracion_usuarios u ON u.id = auc.usuario_id
     WHERE COALESCE(u.is_active, 1) = 1
     ORDER BY auc.count ASC, auc.updated_at ASC, auc.id ASC
     LIMIT 1
     FOR UPDATE`
  );
  const selected = rows[0];
  if (!selected?.usuario_id) return null;
  await connection.query(
    `UPDATE administracion_usuario_counts
     SET count = count + 1
     WHERE id = ?`,
    [selected.id]
  );
  return selected.usuario_id;
}

async function findModelByLeadVehicle(connection, lead) {
  const leadModelWord = normalizeModelWord(lead.vehicle?.model);
  if (!leadModelWord) return null;
  const [rows] = await connection.query(
    `SELECT id AS modelo_id, marca_id, name
     FROM administracion_modelos
     ORDER BY name ASC`
  );
  return rows.find((row) => normalizeModelWord(row.name) === leadModelWord) || null;
}

async function createClientInterestVehicleFromLead(connection, lead, clienteId) {
  const model = await findModelByLeadVehicle(connection, lead);
  if (!model?.modelo_id) return null;

  const [[existing]] = await connection.query(
    `SELECT id
     FROM ventas_oportunidad_client_interest_vehicles
     WHERE client_id = ? AND modelo_id = ? AND active = 1
     LIMIT 1`,
    [clienteId, model.modelo_id]
  );
  if (existing?.id) return existing.id;

  const [result] = await connection.query(
    `INSERT INTO ventas_oportunidad_client_interest_vehicles
     (client_id, marca_id, modelo_id, anio_interes, source, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'oportunidad', 1, NOW(), NOW())`,
    [clienteId, model.marca_id || null, model.modelo_id, lead.vehicle?.year || null]
  );
  return result.insertId;
}

function fordPatchStatus(value, lossReason) {
  const status = String(value || "").trim();
  if (status === "Closed Lost" && !lossReason) return "Assigned";
  return ["New", "Contacted", "Assigned", "Closed Won", "Closed Lost"].includes(status) ? status : "Assigned";
}

async function touchFordLeadModifiedDate(request, lead, changedAt) {
  const leadId = String(lead.id || "").trim();
  if (!leadId) return null;
  const lossReason = lead.lossReason || lead.lostReason || undefined;
  const body = normalizeFordLeadPatch({
    status: fordPatchStatus(lead.status, lossReason),
    contact: lead.contact || {},
    vehicle: lead.vehicle || {},
    preferenceDealer: lead.preferenceDealer || {},
    lastModifiedDate: changedAt,
    lossReason,
  });
  return fordLeadsFetch(`/leads/${encodeURIComponent(leadId)}`, { request, method: "PATCH", body });
}

async function createOpportunityFromLead(connection, lead, userId, request) {
  const token = lead.id;
  if (!token) return { skipped: true, reason: "Lead sin ID." };

  const [[tokenRow]] = await connection.query(`SELECT id FROM ventas_oportunidad_tokens WHERE token = ? LIMIT 1`, [token]);
  if (tokenRow) return { skipped: true, reason: "Lead ya importado.", token };

  const assignedUserId = await pickAssignedUserByCount(connection);
  const ownerUserId = assignedUserId || userId;
  const clienteId = await findOrCreateClient(connection, lead, ownerUserId);
  const { origenId, suborigenId } = await originIds(connection, lead);
  const etapaId = await stageId(connection);
  if (!origenId || !etapaId) return { skipped: true, reason: "Falta origen o etapa configurada.", token };

  const code = await nextLfCode(connection);
  const [result] = await connection.query(
    `INSERT INTO ventas_oportunidades (cliente_id, origen_id, suborigen_id, etapasconversion_id, created_by, asignado_a, oportunidad_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [clienteId, origenId, suborigenId, etapaId, ownerUserId, assignedUserId, code]
  );
  const oportunidadId = result.insertId;
  await createClientInterestVehicleFromLead(connection, lead, clienteId);
  await connection.query(
    `INSERT INTO ventas_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
     VALUES (?, ?, ?, ?)`,
    [oportunidadId, etapaId, `Lead Ford importado: ${token}`, ownerUserId]
  );
  await connection.query(
    `INSERT INTO ventas_oportunidad_tokens (oportunidad_id, token, is_actualized, created_by)
     VALUES (?, ?, 1, ?)`,
    [oportunidadId, token, ownerUserId]
  );
  const changedAt = new Date().toISOString();
  await touchFordLeadModifiedDate(request, lead, changedAt);
  return { id: oportunidadId, code, token, assignedUserId, createdBy: ownerUserId, lastModifiedDate: changedAt };
}

async function syncFordLeadsToOpportunities(request, { leadIds = [], manualLeadId = "" } = {}) {
  const cleanManualLeadId = String(manualLeadId || "").trim();
  if (cleanManualLeadId) {
    const lead = await fordLeadsFetch(`/leads/${encodeURIComponent(cleanManualLeadId)}`, { request });
    const normalized = normalizeFordLeadResponse(lead);
    return [{ ...normalized, id: normalized.id || cleanManualLeadId }];
  }

  const selectedIds = Array.from(new Set((leadIds || []).map((id) => String(id || "").trim()).filter(Boolean)));
  if (selectedIds.length) {
    const leads = [];
    for (const leadId of selectedIds) {
      const lead = await fordLeadsFetch(`/leads/${encodeURIComponent(leadId)}`, { request });
      const normalized = normalizeFordLeadResponse(lead);
      leads.push({ ...normalized, id: normalized.id || leadId });
    }
    return leads;
  }

  const searchParams = request.nextUrl.searchParams;
  const data = await fordLeadsFetch("/leads", {
    request,
    search: {
      startDate: todayStartDate(),
      endDate: todayEndDate(),
      dealerCode: envValue("FORD_DEALER_CODE", "DEALER_CODE") || searchParams.get("dealerCode") || "",
      country: envValue("FORD_COUNTRY", "COUNTRY") || searchParams.get("country") || "",
      status: searchParams.get("status") || "open",
      typeStatus: searchParams.get("typeStatus") || "",
    },
  });
  const leads = normalizeFordLeadListResponse(data);
  return leads;
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const user = await authorize(request);
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });

    const force = request.nextUrl.searchParams.get("force") === "1";
    const windowMinutes = Number(request.nextUrl.searchParams.get("windowMinutes") || 5);
    const schedule = await canRunBySchedule({ force, windowMinutes });
    if (!schedule.ok) {
      return NextResponse.json({ ok: true, skipped: true, reason: "No coincide con configuracion_horas.", schedule });
    }

    const body = await request.json().catch(() => ({}));
    const leads = await syncFordLeadsToOpportunities(request, { leadIds: body.leadIds || [], manualLeadId: body.manualLeadId || "" });
    const created = [];
    const skipped = [];
    await connection.beginTransaction();
    for (const lead of leads) {
      const result = await createOpportunityFromLead(connection, lead, user.id, request);
      if (result.skipped) skipped.push(result);
      else created.push(result);
    }
    await connection.commit();
    return NextResponse.json({ ok: true, schedule, total: leads.length, created, skipped });
  } catch (error) {
    await connection.rollback();
    console.error("Error syncing Ford leads to opportunities:", error);
    return NextResponse.json(
      { message: error.message || "No se pudieron crear oportunidades Ford.", detail: error.payload || null },
      { status: error.status || 500 }
    );
  } finally {
    connection.release();
  }
}

export async function GET(request) {
  return POST(request);
}
