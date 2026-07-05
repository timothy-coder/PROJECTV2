import { NextResponse } from "next/server";

import { externalApiLoginStatus } from "@/lib/externalApi";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    }
    if (!hasPerm(user.permissions || {}, ["external_api", "view"])) {
      return NextResponse.json({ message: "No tienes permiso para probar API externa." }, { status: 403 });
    }

    const payload = await requestJsonSafe(request);
    const data = await externalApiLoginStatus({
      email: payload.email,
      password: payload.password,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "No se pudo generar el token externo.",
        detail: error.payload || null,
      },
      { status: error.status || 500 }
    );
  }
}

async function requestJsonSafe(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
