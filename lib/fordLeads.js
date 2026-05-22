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
  headers.client_id = envValue("FORD_API_CLIENT_ID", "API_CLIENT_ID", "CLIENT_ID") || applicationId;
  headers.client_secret =
    envValue("FORD_API_CLIENT_SECRET", "API_CLIENT_SECRET", "CLIENT_SECRET", "MULESOFT_CLIENT_SECRET", "FORD_MULESOFT_CLIENT_SECRET") ||
    requiredEnv("CLIENT_SECRET");
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
    error.payload = { ...(payload || {}), outboundUrl: url };
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
const FORD_DOCUMENT_TYPES = ["RUT", "Cedula de identidad", "Cédula de identidad", "Pasaporte", "RUC"];
const FORD_MODELS = ["Mustang Peru", "Territory Peru", "Escape Peru", "Edge Peru", "Explorer Peru", "Expedition Peru", "Ranger Peru", "F150 Peru", "Bronco Sport Peru", "Maverick Peru", "Maverick Hibrida"];
const FORD_PATCH_STATUSES = ["New", "Contacted", "Closed Won", "Closed Lost"];

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
  if (patch && !FORD_PATCH_STATUSES.includes(payload.status)) errors.push("status debe ser New, Contacted, Closed Won o Closed Lost");
  if (!patch && payload.status !== "New") errors.push("status debe ser New");
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
    required(vehicle.model, "vehicle.model");
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
  return {
    name: body.contact?.name,
    phone: body.contact?.phone ?? null,
    mobilePhoneType: body.contact?.mobilePhoneType,
    mobilePhone: body.contact?.mobilePhone,
    documentType: body.contact?.documentType,
    documentNumber: body.contact?.documentNumber,
    email: body.contact?.email,
    contactPreference: body.contact?.contactPreference || "WhatsApp",
    company: body.contact?.company ?? null,
    country,
    address: {
      city: body.contact?.address?.city,
      countryCode: body.contact?.address?.countryCode || "Unknown",
      street: body.contact?.address?.street,
      postalCode: body.contact?.address?.postalCode ?? null,
      state: body.contact?.address?.state,
    },
  };
}

export function normalizeFordLeadCreate(body = {}) {
  const country = envValue("FORD_COUNTRY", "COUNTRY") || body.contact?.country || "PER";
  const payload = cleanObject({
    status: "New",
    contact: normalizeFordContact(body),
    vehicle: {
      model: body.vehicle?.model,
      version: body.vehicle?.version,
      accessories: body.vehicle?.accessories ?? null,
      accessoriesDetails: Array.isArray(body.vehicle?.accessoriesDetails) ? body.vehicle.accessoriesDetails : [],
    },
    preferenceDealer: dealerPayload({ ...body, contact: { ...(body.contact || {}), country } }),
    leadSource: {
      origin: body.leadSource?.origin,
      subOrigin: body.leadSource?.subOrigin,
    },
    lastModifiedDate: body.lastModifiedDate || new Date().toISOString(),
  });
  validateFordLeadPayload(payload);
  return payload;
}

export function normalizeFordLeadPatch(body = {}) {
  const payload = cleanObject({
    status: body.status,
    contact: body.contact ? normalizeFordContact(body) : undefined,
    vehicle: body.vehicle ? {
      model: body.vehicle?.model,
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
