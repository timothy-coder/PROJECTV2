import { NextResponse } from "next/server";

import { fordLeadsFetch } from "@/lib/fordLeads";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function jsonError(message, status = 400, detail = null) {
  return NextResponse.json({ message, detail }, { status });
}

async function requireFordPermission(action) {
  const user = await getCurrentUser();
  if (!user) return { error: jsonError("No autorizado.", 401) };
  if (!hasPerm(user.permissions || {}, ["leads_ford", action])) {
    return { error: jsonError("No tienes permiso para Leads Ford.", 403) };
  }
  return { user };
}

function cleanId(id) {
  return String(id || "").trim();
}

function fordError(error) {
  return jsonError(error.message || "No se pudo conectar con Ford.", error.status || 500, error.payload || null);
}

export async function GET(request, { params }) {
  try {
    const allowed = await requireFordPermission("view");
    if (allowed.error) return allowed.error;

    const { id } = await params;
    const leadId = cleanId(id);
    if (!leadId) return jsonError("Falta el id del lead.");

    const data = await fordLeadsFetch(`/leads/${encodeURIComponent(leadId)}`, { request });
    return NextResponse.json(data);
  } catch (error) {
    return fordError(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const allowed = await requireFordPermission("edit");
    if (allowed.error) return allowed.error;

    const { id } = await params;
    const leadId = cleanId(id);
    if (!leadId) return jsonError("Falta el id del lead.");

    const body = await request.json();
    const data = await fordLeadsFetch(`/leads/${encodeURIComponent(leadId)}`, { request, method: "PATCH", body });
    return NextResponse.json(data);
  } catch (error) {
    return fordError(error);
  }
}
