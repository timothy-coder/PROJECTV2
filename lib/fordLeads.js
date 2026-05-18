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
