const DEFAULT_BASE_URL = "https://api-qat.mss.ford.com/dms-mulesoft";
const DEFAULT_TOKEN_URL = "https://login.microsoftonline.com/azureford.onmicrosoft.com/oauth2/v2.0/token";
let cachedToken = null;

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function envValue(...names) {
  for (const name of names) {
    if (process.env[name]) return String(process.env[name]).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

function missingFordConfig(request) {
  const missing = [];
  const hasManualToken = Boolean(request?.headers?.get("x-ford-access-token") || request?.headers?.get("authorization"));
  if (!envValue("FORD_APPLICATION_ID", "APPLICATION_ID")) missing.push("APPLICATION_ID");
  if (!envValue("FORD_API_CLIENT_SECRET", "API_CLIENT_SECRET", "CLIENT_SECRET", "MULESOFT_CLIENT_SECRET", "FORD_MULESOFT_CLIENT_SECRET")) {
    missing.push("CLIENT_SECRET");
  }
  if (!hasManualToken && !envValue("FORD_APIGEE_CLIENT_ID", "FORD_OAUTH_CLIENT_ID", "ENTRA_CLIENT_ID")) {
    missing.push("ENTRA_CLIENT_ID");
  }
  if (!hasManualToken && !envValue("FORD_APIGEE_CLIENT_SECRET", "FORD_OAUTH_CLIENT_SECRET", "ENTRA_CLIENT_SECRET")) {
    missing.push("ENTRA_CLIENT_SECRET");
  }
  if (!hasManualToken && !envValue("FORD_OAUTH_SCOPE", "ENTRA_SCOPE")) {
    missing.push("ENTRA_SCOPE");
  }
  return missing;
}

function baseUrl() {
  return trimSlash(envValue("API_BASE_URL", "FORD_LEADS_BASE_URL") || DEFAULT_BASE_URL);
}

function buildFordUrl(path, search = {}) {
  const query = Object.entries(search)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeFordQueryValue(key, value)}`)
    .join("&");
  return `${baseUrl()}${path}${query ? `?${query}` : ""}`;
}

function encodeFordQueryValue(key, value) {
  return encodeURIComponent(normalizeFordQueryValue(key, value)).replace(/%3A/g, ":");
}

function normalizeFordQueryValue(key, value) {
  const text = String(value).trim();
  if ((key === "startDate" || key === "endDate") && text) {
    const clean = text.replace(" ", "T").replace(".000Z", "Z").replace(/[zZ]$/, "");
    const [datePart, timePart = "00:00:00"] = clean.split("T");
    const timePieces = timePart.split(":");
    const hours = timePieces[0] || "00";
    const minutes = timePieces[1] || "00";
    const seconds = timePieces[2] || "00";
    return `${datePart}T${hours}:${minutes}:${seconds}Z`;
  }
  return text;
}

export async function getFordAccessToken({ force = false } = {}) {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.accessToken;

  const tokenUrl = envValue("FORD_OAUTH_TOKEN_URL", "TOKEN_URL") || DEFAULT_TOKEN_URL;

  const clientId = envValue("FORD_APIGEE_CLIENT_ID", "FORD_OAUTH_CLIENT_ID", "ENTRA_CLIENT_ID");
  const clientSecret = envValue("FORD_APIGEE_CLIENT_SECRET", "FORD_OAUTH_CLIENT_SECRET", "ENTRA_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Faltan ENTRA_CLIENT_ID/ENTRA_CLIENT_SECRET para obtener el Bearer token.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const scope = envValue("FORD_OAUTH_SCOPE", "ENTRA_SCOPE");
  if (scope) body.set("scope", scope.endsWith("/.default") ? scope : `${scope}/.default`);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    const detail = payload?.error_description || payload?.error || payload?.message || text || `HTTP ${response.status}`;
    throw new Error(`No se pudo obtener el token OAuth de Ford usando ${tokenUrl}: ${detail}`);
  }

  if (!payload?.access_token) throw new Error("La respuesta OAuth no devolvio access_token.");
  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 3600) - 120) * 1000,
    expiresIn: Number(payload.expires_in || 3600),
    tokenType: payload.token_type || "Bearer",
  };
  return payload.access_token;
}

export async function fordTokenDiagnostics() {
  const accessToken = await getFordAccessToken({ force: true });
  return {
    ok: true,
    tokenType: cachedToken?.tokenType || "Bearer",
    expiresIn: cachedToken?.expiresIn || null,
    accessToken,
    tokenPreview: `${accessToken.slice(0, 18)}...${accessToken.slice(-8)}`,
  };
}

async function resolveToken(request, token) {
  const headerToken = request?.headers?.get("x-ford-access-token");
  const authHeader = request?.headers?.get("authorization");
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  return token || headerToken || bearerToken || getFordAccessToken();
}

function fordHeaders(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const applicationId = envValue("FORD_APPLICATION_ID", "APPLICATION_ID") || requiredEnv("FORD_APPLICATION_ID");
  headers["Application-Id"] = applicationId;
  headers.application_id = applicationId;
  headers.client_id = envValue("FORD_API_CLIENT_ID", "API_CLIENT_ID", "CLIENT_ID") || applicationId;
  headers.client_secret =
    envValue("FORD_API_CLIENT_SECRET", "API_CLIENT_SECRET", "CLIENT_SECRET", "MULESOFT_CLIENT_SECRET", "FORD_MULESOFT_CLIENT_SECRET") ||
    requiredEnv("CLIENT_SECRET");
  headers.cliente_id = headers.client_id;
  headers.cliente_secret = headers.client_secret;
  return headers;
}

export async function fordLeadsFetch(path, { request, token, search, method = "GET", body } = {}) {
  const missing = missingFordConfig(request);
  if (missing.length) {
    throw new Error(`Faltan variables para conectar con Ford: ${missing.join(", ")}.`);
  }

  const accessToken = await resolveToken(request, token);
  const url = buildFordUrl(path, search);

  const response = await fetch(url, {
    method,
    headers: fordHeaders(accessToken),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error_description || `Ford respondio ${response.status}.`);
    error.status = response.status;
    error.payload = { ...(payload || {}), outboundUrl: url, outboundBody: body || null };
    throw error;
  }

  return payload;
}

export function fordLeadsConfigStatus() {
  return {
    baseUrl: envValue("API_BASE_URL", "FORD_LEADS_BASE_URL") || DEFAULT_BASE_URL,
    hasMulesoftClientId: true,
    hasMulesoftClientSecret: Boolean(envValue("FORD_API_CLIENT_SECRET", "API_CLIENT_SECRET", "CLIENT_SECRET", "MULESOFT_CLIENT_SECRET", "FORD_MULESOFT_CLIENT_SECRET")),
    hasApplicationId: Boolean(envValue("FORD_APPLICATION_ID", "APPLICATION_ID")),
    oauthTokenUrl: envValue("FORD_OAUTH_TOKEN_URL", "TOKEN_URL") || DEFAULT_TOKEN_URL,
    hasOauthTokenUrl: Boolean(envValue("FORD_OAUTH_TOKEN_URL", "TOKEN_URL") || DEFAULT_TOKEN_URL),
    hasOauthClientId: Boolean(envValue("FORD_APIGEE_CLIENT_ID", "FORD_OAUTH_CLIENT_ID", "ENTRA_CLIENT_ID")),
    hasOauthClientSecret: Boolean(envValue("FORD_APIGEE_CLIENT_SECRET", "FORD_OAUTH_CLIENT_SECRET", "ENTRA_CLIENT_SECRET")),
    hasOauthScope: Boolean(envValue("FORD_OAUTH_SCOPE", "ENTRA_SCOPE")),
    dealerCode: envValue("FORD_DEALER_CODE", "DEALER_CODE") || "",
    country: envValue("FORD_COUNTRY", "COUNTRY") || "",
  };
}

const COUNTRY_NAME_BY_CODE = {
  PER: "Peru",
};

const FORD_SOURCE_OPTIONS = {
  "Digital Dealer": ["Sitio Web", "Facebook", "Landing Page"],
  Manual: ["Telefónico", "Telefonico", "Piso", "Evento"],
};
const FORD_MOBILE_TYPES = ["Personal", "Casa", "Otro", "Trabajo"];
const FORD_DOCUMENT_TYPES = ["DNI", "RUC", "RUT", "Cedula de identidad", "Cédula de identidad", "Pasaporte"];
const FORD_MODELS = ["Mustang Peru", "Territory Peru", "Escape Peru", "Edge Peru", "Explorer Peru", "Expedition Peru", "Ranger Peru", "F150 Peru", "Bronco Sport Peru", "Maverick Peru", "Maverick Hibrida", "Mustang", "Territory", "Escape", "Edge", "Explorer", "Expedition", "Ranger", "F150", "Bronco Sport", "Maverick"];
const FORD_CREATE_STATUSES = ["New", "Contacted", "Closed Won", "Closed Lost"];
const FORD_PATCH_STATUSES = [
  "New",
  "Certified",
  "Seller",
  "Order",
  "Signed",
  "Billing",
  "Contacted",
  "Assigned",
  "Warming",
  "Agency Classification",
  "ChatBot Classification",
  "Rescheduled",
  "SalesManager",
  "ContactFail",
  "Test-Drive",
  "Negotiating",
  "OnVisit",
  "Quotation",
  "Purchase Order",
  "Closed Won",
  "Closed Lost",
];

function normalizeFordDocumentType(value) {
  const text = String(value || "").trim();
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (["OTHER", "OTHE", "OTRO", "OTROS"].includes(normalized)) return "RUC";
  return text;
}

function normalizeModelText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function fordBaseModel(value = "") {
  const text = normalizeModelText(value);
  if (!text) return null;
  if (text.startsWith("bronco sport")) return "Bronco Sport";
  if (text.startsWith("f150") || text.startsWith("f 150")) return "F150";
  if (text.startsWith("maverick")) return "Maverick";
  const firstWord = text.split(" ")[0];
  return FORD_MODELS
    .filter((model) => !normalizeModelText(model).endsWith("peru"))
    .find((model) => normalizeModelText(model).split(" ")[0] === firstWord) || value;

}

function cleanObject(value) {
  if (Array.isArray(value)) return value.map(cleanObject).filter((item) => item !== undefined);
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, cleanObject(item)])
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (value === "") return undefined;
  return value;
}

function fullNameFromContact(contact = {}) {
  return contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
}

function normalizeFordContactForRead(contact = {}) {
  const documentType = normalizeFordDocumentType(contact.documentType);
  return {
    name: fullNameFromContact(contact),
    firstName: contact.firstName ?? null,
    lastName: contact.lastName ?? null,
    phoneAreaCode: contact.phoneAreaCode ?? null,
    phone: contact.phone ?? null,
    mobilePhoneType: contact.mobilePhoneType ?? null,
    mobilePhone: contact.mobilePhone ?? null,
    mobileComplete: contact.mobileComplete ?? null,
    documentType: documentType || null,
    documentNumber: contact.documentNumber ?? null,
    email: contact.email ?? null,
    contactPreference: contact.contactPreference ?? null,
    company: contact.company ?? null,
    agreeReceiveContact: contact.agreeReceiveContact ?? null,
    country: contact.country ?? null,
    address: {
      city: contact.address?.city ?? null,
      countryCode: contact.address?.countryCode ?? null,
      street: contact.address?.street ?? null,
      postalCode: contact.address?.postalCode ?? null,
      state: contact.address?.state ?? null,
    },
  };
}

export function normalizeFordLeadResponse(lead = {}) {
  return {
    id: lead.id ?? lead.recordId ?? lead.token ?? lead.leadId ?? lead.LeadId ?? null,
    status: lead.status ?? null,
    mediaOption: lead.mediaOption ?? null,
    contact: normalizeFordContactForRead(lead.contact || {}),
    businessName: lead.businessName ?? null,
    vehicle: {
      model: lead.vehicle?.model ?? null,
      accessories: lead.vehicle?.accessories ?? null,
      accessoriesDetails: Array.isArray(lead.vehicle?.accessoriesDetails) ? lead.vehicle.accessoriesDetails.map((item) => ({ name: item?.name ?? null })) : [],
      version: lead.vehicle?.version ?? null,
      tma: lead.vehicle?.tma ?? null,
      seq: lead.vehicle?.seq ?? null,
    },
    preferenceDealer: {
      code: lead.preferenceDealer?.code ?? null,
      uniqueCode: lead.preferenceDealer?.uniqueCode ?? null,
      name: lead.preferenceDealer?.name ?? null,
    },
    leadSource: {
      origin: lead.leadSource?.origin ?? null,
      subOrigin: lead.leadSource?.subOrigin ?? null,
      subOrigin2: lead.leadSource?.subOrigin2 ?? null,
    },
    campaignName: lead.campaignName ?? null,
    fleet: {
      form: lead.fleet?.form ?? null,
      numberUnits: lead.fleet?.numberUnits ?? null,
    },
    classification: lead.classification ?? null,
    preferredContactTime: lead.preferredContactTime ?? null,
    financingFlag: lead.financingFlag ?? null,
    plan: {
      planCode: lead.plan?.planCode ?? null,
      ovaloPlan: lead.plan?.ovaloPlan ?? null,
    },
    vehicleAsPartPayment: lead.vehicleAsPartPayment ?? null,
    currentVehicleExchange: lead.currentVehicleExchange ?? null,
    description: lead.description ?? null,
    lostReason: lead.lostReason ?? null,
    directSales: lead.directSales ?? null,
    traditionalSales: lead.traditionalSales ?? null,
    modelColor: lead.modelColor ?? null,
    colorCode: lead.colorCode ?? null,
    ackDate: lead.ackDate ?? null,
    recordType: {
      id: lead.recordType?.id ?? null,
      name: lead.recordType?.name ?? null,
    },
    createdDate: lead.createdDate ?? null,
    createdBy: {
      id: lead.createdBy?.id ?? null,
      name: lead.createdBy?.name ?? null,
    },
    owner: {
      id: lead.owner?.id ?? null,
      name: lead.owner?.name ?? null,
    },
    lastModifiedDate: lead.lastModifiedDate ?? null,
  };
}

export function normalizeFordLeadListResponse(data) {
  const items = Array.isArray(data) ? data : data?.items || [];
  return items.map((item) => normalizeFordLeadResponse(item));
}

function dealerPayload(body = {}) {
  const country = envValue("FORD_COUNTRY", "COUNTRY") || body.contact?.country || "PER";
  const code = envValue("FORD_DEALER_CODE", "DEALER_CODE") || body.preferenceDealer?.code || "";
  return {
    code,
    uniqueCode: envValue("FORD_DEALER_UNIQUE_CODE") || body.preferenceDealer?.uniqueCode || `${code}${COUNTRY_NAME_BY_CODE[country] || country}`,
    name: envValue("FORD_DEALER_NAME") || body.preferenceDealer?.name || "WANKAMOTORS",
  };
}

function validateFordLeadPayload(payload, { patch = false } = {}) {
  const errors = [];
  const contact = payload.contact || {};
  const vehicle = payload.vehicle || {};
  const dealer = payload.preferenceDealer || {};
  const source = payload.leadSource || {};
  const required = (value, label) => {
    if (value === undefined || value === null || String(value).trim() === "") errors.push(label);
  };

  required(payload.status, "status");
  required(dealer.code, "preferenceDealer.code");
  required(payload.lastModifiedDate, "lastModifiedDate");
  if (patch && !FORD_PATCH_STATUSES.includes(payload.status)) errors.push("status no es un estado Ford permitido para actualizar");
  if (!patch && !FORD_CREATE_STATUSES.includes(payload.status)) errors.push("status debe ser New, Contacted, Closed Won o Closed Lost");
  if (payload.status === "Closed Lost") required(payload.lossReason, "lossReason");

  if (!patch || payload.contact) {
    required(contact.name, "contact.name");
    required(contact.mobilePhoneType, "contact.mobilePhoneType");
    required(contact.mobilePhone, "contact.mobilePhone");
    required(contact.documentType, "contact.documentType");
    required(contact.documentNumber, "contact.documentNumber");
    required(contact.email, "contact.email");
    required(contact.country, "contact.country");
    if (contact.documentType === "RUC") required(contact.company, "contact.company");
    if (contact.mobilePhoneType && !FORD_MOBILE_TYPES.includes(contact.mobilePhoneType)) errors.push("contact.mobilePhoneType invalido");
    if (contact.documentType && !FORD_DOCUMENT_TYPES.includes(contact.documentType)) errors.push("contact.documentType invalido");
  }

  if (!patch || payload.vehicle) {
    if (vehicle.model && !FORD_MODELS.includes(vehicle.model)) errors.push("vehicle.model invalido");
  }

  if (!patch) {
    required(source.origin, "leadSource.origin");
    required(source.subOrigin, "leadSource.subOrigin");
    if (source.origin && !FORD_SOURCE_OPTIONS[source.origin]) errors.push("leadSource.origin invalido");
    if (source.origin && source.subOrigin && !FORD_SOURCE_OPTIONS[source.origin]?.includes(source.subOrigin)) {
      errors.push("leadSource.subOrigin no corresponde al origen");
    }
  }

  if (errors.length) {
    const error = new Error(`Completa o corrige: ${errors.join(", ")}.`);
    error.status = 400;
    throw error;
  }
}

function normalizeFordContact(body = {}) {
  const country = envValue("FORD_COUNTRY", "COUNTRY") || body.contact?.country || "PER";
  const documentType = normalizeFordDocumentType(body.contact?.documentType);
  return {
    name: fullNameFromContact(body.contact || {}),
    phone: body.contact?.phone ?? null,
    mobilePhoneType: body.contact?.mobilePhoneType,
    mobilePhone: body.contact?.mobilePhone,
    documentType,
    documentNumber: body.contact?.documentNumber,
    email: body.contact?.email,
    contactPreference: body.contact?.contactPreference || "WhatsApp",
    company: body.contact?.company || (documentType === "RUC" ? fullNameFromContact(body.contact || {}) : null),
    country,
    address: {
      city: body.contact?.address?.city,
      countryCode: body.contact?.address?.countryCode || "PER",
      street: body.contact?.address?.street,
      postalCode: body.contact?.address?.postalCode ?? null,
      state: body.contact?.address?.state,
    },
  };
}

export function normalizeFordLeadCreate(body = {}) {
  const country = envValue("FORD_COUNTRY", "COUNTRY") || body.contact?.country || "PER";
  const payload = cleanObject({
    status: body.status || "New",
    contact: normalizeFordContact(body),
    vehicle: {
      model: fordBaseModel(body.vehicle?.model),
      version: body.vehicle?.version,
      accessories: body.vehicle?.accessories ?? null,
      accessoriesDetails: Array.isArray(body.vehicle?.accessoriesDetails) ? body.vehicle.accessoriesDetails : [],
    },
    preferenceDealer: dealerPayload({ ...body, contact: { ...(body.contact || {}), country } }),
    leadSource: {
      origin: body.leadSource?.origin || "Manual",
      subOrigin: body.leadSource?.subOrigin || "Piso",
    },
    lastModifiedDate: body.lastModifiedDate || new Date().toISOString(),
    lossReason: body.status === "Closed Lost" ? body.lossReason : undefined,
  });
  validateFordLeadPayload(payload);
  return payload;
}

export function normalizeFordLeadPatch(body = {}) {
  const payload = cleanObject({
    status: body.status,
    contact: body.contact ? normalizeFordContact(body) : undefined,
    vehicle: body.vehicle ? {
      model: fordBaseModel(body.vehicle?.model),
      version: body.vehicle?.version,
      accessories: body.vehicle?.accessories ?? null,
      accessoriesDetails: Array.isArray(body.vehicle?.accessoriesDetails) ? body.vehicle.accessoriesDetails : [],
    } : undefined,
    preferenceDealer: dealerPayload(body),
    lastModifiedDate: body.lastModifiedDate || new Date().toISOString(),
    lossReason: body.status === "Closed Lost" ? body.lossReason : undefined,
  });
  validateFordLeadPayload(payload, { patch: true });
  return payload;
}
