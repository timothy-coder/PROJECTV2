function cleanEnv(value = "") {
  return String(value || "").trim().replace(/^["']|["']$/g, "");
}

function trimSlash(value = "") {
  return cleanEnv(value).replace(/\/+$/, "");
}

function normalizePath(path = "") {
  const text = String(path || "").trim();
  if (!text) return "/";
  return text.startsWith("/") ? text : `/${text}`;
}

let cachedExternalToken = null;

function externalApiConfig() {
  const baseUrl = trimSlash(process.env.EXTERNAL_API_BASE_URL);
  if (!baseUrl) throw new Error("Falta configurar EXTERNAL_API_BASE_URL.");

  return {
    baseUrl,
    loginUrl: cleanEnv(process.env.EXTERNAL_API_LOGIN_URL) || `${baseUrl}/api/users/login`,
    email: cleanEnv(process.env.EXTERNAL_API_EMAIL),
    password: cleanEnv(process.env.EXTERNAL_API_PASSWORD),
    token: cleanEnv(process.env.EXTERNAL_API_TOKEN),
    tokenField: cleanEnv(process.env.EXTERNAL_API_TOKEN_FIELD),
    apiKey: cleanEnv(process.env.EXTERNAL_API_KEY),
    apiKeyHeader: cleanEnv(process.env.EXTERNAL_API_KEY_HEADER) || "x-api-key",
    timeoutMs: Number(process.env.EXTERNAL_API_TIMEOUT_MS || 15000),
  };
}

function buildUrl(baseUrl, path, search = {}) {
  const url = new URL(`${baseUrl}${normalizePath(path)}`);
  Object.entries(search || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

function readTokenFromPayload(payload, tokenField = "") {
  if (!payload) return "";
  if (tokenField) {
    return tokenField.split(".").reduce((value, key) => value?.[key], payload) || "";
  }
  return (
    payload.access_token ||
    payload.accessToken ||
    payload.token ||
    payload.jwt ||
    payload.data?.access_token ||
    payload.data?.accessToken ||
    payload.data?.token ||
    payload.data?.jwt ||
    ""
  );
}

function readTokenExpiresIn(payload) {
  return Number(payload?.expires_in || payload?.expiresIn || payload?.data?.expires_in || payload?.data?.expiresIn || 3600);
}

async function getExternalAccessToken(config, { force = false, email = "", password = "" } = {}) {
  if (config.token) return config.token;
  if (!force && cachedExternalToken && cachedExternalToken.expiresAt > Date.now() + 60_000) {
    return cachedExternalToken.token;
  }
  const loginEmail = cleanEnv(email) || config.email;
  const loginPassword = cleanEnv(password) || config.password;
  if (!loginEmail || !loginPassword) {
    throw new Error("Faltan EXTERNAL_API_EMAIL/EXTERNAL_API_PASSWORD o EXTERNAL_API_TOKEN.");
  }

  const response = await fetch(config.loginUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: loginEmail,
      password: loginPassword,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `No se pudo generar token externo ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const token = readTokenFromPayload(payload, config.tokenField);
  if (!token) {
    const error = new Error("La API externa no devolvio token. Configura EXTERNAL_API_TOKEN_FIELD si el campo tiene otro nombre.");
    error.payload = payload;
    throw error;
  }

  cachedExternalToken = {
    token,
    expiresAt: Date.now() + Math.max(60, readTokenExpiresIn(payload) - 120) * 1000,
  };
  return token;
}

export async function externalApiFetch(path, options = {}) {
  const config = externalApiConfig();
  const url = buildUrl(config.baseUrl, path, options.search);
  const token = options.auth === false ? "" : await getExternalAccessToken(config, { force: options.forceToken });
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(config.apiKey ? { [config.apiKeyHeader]: config.apiKey } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `Error API externa ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function externalApiLoginStatus(credentials = {}) {
  const config = externalApiConfig();
  const token = await getExternalAccessToken(config, { force: true, email: credentials.email, password: credentials.password });
  return {
    ok: true,
    loginUrl: config.loginUrl,
    hasToken: Boolean(token),
  };
}
