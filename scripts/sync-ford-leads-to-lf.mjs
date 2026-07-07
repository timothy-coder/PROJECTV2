#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

loadEnvFile(path.join(projectRoot, ".env.local"));
loadEnvFile(path.join(projectRoot, ".env"));

const args = parseArgs(process.argv.slice(2));
const endpoint = buildEndpoint(args);
const secret = envValue("FORD_SYNC_SECRET", "CRON_SECRET");

if (!secret) {
  console.error("[ford-sync] Falta FORD_SYNC_SECRET o CRON_SECRET en el entorno.");
  console.error("[ford-sync] Agrega uno en .env.local y usa el mismo valor para proteger el endpoint.");
  process.exit(1);
}

const body = {};
if (args.manualLeadId) body.manualLeadId = args.manualLeadId;
if (args.leadIds.length) body.leadIds = args.leadIds;

const controller = new AbortController();
const timeoutMs = Number(envValue("FORD_SYNC_TIMEOUT_MS") || 10 * 60 * 1000);
const timeout = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
      "x-ford-sync-secret": secret,
      "user-agent": "hubcrm-ford-sync-script",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  const text = await response.text();
  const payload = parseJson(text);

  if (!response.ok) {
    console.error(`[ford-sync] Error HTTP ${response.status}: ${payload?.message || text || response.statusText}`);
    if (payload?.detail) console.error(`[ford-sync] Detalle: ${JSON.stringify(payload.detail)}`);
    process.exit(1);
  }

  printSummary(payload);
  process.exit(0);
} catch (error) {
  console.error(`[ford-sync] ${error.name === "AbortError" ? "Tiempo de espera agotado" : error.message}`);
  process.exit(1);
} finally {
  clearTimeout(timeout);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = stripQuotes(rawValue.trim());
  }
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function envValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

function parseArgs(items) {
  const parsed = {
    force: false,
    manualLeadId: "",
    leadIds: [],
    status: "",
    typeStatus: "",
    dealerCode: "",
    country: "",
    windowMinutes: envValue("FORD_SYNC_WINDOW_MINUTES") || "5",
    baseUrl: "",
  };

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const next = items[index + 1];
    if (item === "--force") parsed.force = true;
    else if (item === "--manual-id") {
      parsed.manualLeadId = next || "";
      index += 1;
    } else if (item === "--lead-id") {
      if (next) parsed.leadIds.push(next);
      index += 1;
    } else if (item === "--status") {
      parsed.status = next || "";
      index += 1;
    } else if (item === "--type-status") {
      parsed.typeStatus = next || "";
      index += 1;
    } else if (item === "--dealer-code") {
      parsed.dealerCode = next || "";
      index += 1;
    } else if (item === "--country") {
      parsed.country = next || "";
      index += 1;
    } else if (item === "--window-minutes") {
      parsed.windowMinutes = next || "5";
      index += 1;
    } else if (item === "--base-url") {
      parsed.baseUrl = next || "";
      index += 1;
    }
  }

  if (envValue("FORD_SYNC_FORCE") === "1") parsed.force = true;
  return parsed;
}

function buildEndpoint(options) {
  const fullUrl = envValue("FORD_SYNC_URL");
  const baseUrl = trimSlash(
    options.baseUrl ||
      envValue("APP_URL", "NEXT_PUBLIC_APP_URL", "PUBLIC_APP_URL", "BASE_URL") ||
      `http://127.0.0.1:${envValue("PORT") || "3000"}`
  );
  const url = new URL(fullUrl || `${baseUrl}/api/ford-leads/sync-opportunities`);
  if (options.force) url.searchParams.set("force", "1");
  if (options.windowMinutes) url.searchParams.set("windowMinutes", options.windowMinutes);
  if (options.status) url.searchParams.set("status", options.status);
  if (options.typeStatus) url.searchParams.set("typeStatus", options.typeStatus);
  if (options.dealerCode) url.searchParams.set("dealerCode", options.dealerCode);
  if (options.country) url.searchParams.set("country", options.country);
  return url.toString();
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function printSummary(payload) {
  const created = payload?.created?.length || 0;
  const skipped = payload?.skipped?.length || 0;
  const total = payload?.total ?? created + skipped;
  const now = new Date().toISOString();

  if (payload?.skipped === true) {
    console.log(`[ford-sync] ${now} omitido por horario: ${payload.reason || "sin detalle"}`);
    return;
  }

  console.log(`[ford-sync] ${now} procesados=${total} creados=${created} omitidos=${skipped}`);

  for (const item of payload?.created || []) {
    const warnings = item.warnings?.length ? ` warnings=${item.warnings.length}` : "";
    console.log(`[ford-sync] creado ${item.code || item.id} lead=${item.token || "-"} asignado=${item.assignedUserId || "-"}${warnings}`);
  }

  for (const item of payload?.skipped || []) {
    console.log(`[ford-sync] omitido lead=${item.token || "-"} motivo=${item.reason || "sin motivo"}`);
  }
}
