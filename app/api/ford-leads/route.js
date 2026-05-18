import { NextResponse } from "next/server";

import { fordLeadsConfigStatus, fordLeadsFetch, fordTokenDiagnostics } from "@/lib/fordLeads";
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
    return NextResponse.json({ items: Array.isArray(data) ? data : data?.items || [], raw: data });
  } catch (error) {
    return fordError(error);
  }
}

export async function POST(request) {
  try {
    const allowed = await requireFordPermission("create");
    if (allowed.error) return allowed.error;

    const body = await request.json();
    const data = await fordLeadsFetch("/leads", { request, method: "POST", body });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return fordError(error);
  }
}
