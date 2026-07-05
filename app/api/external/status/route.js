import { NextResponse } from "next/server";

import { externalApiFetch } from "@/lib/externalApi";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    }
    if (!hasPerm(user.permissions || {}, ["external_api", "view"])) {
      return NextResponse.json({ message: "No tienes permiso para probar API externa." }, { status: 403 });
    }

    const path = process.env.EXTERNAL_API_STATUS_PATH || "/";
    const data = await externalApiFetch(path);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "No se pudo conectar con la API externa.",
        detail: error.payload || null,
      },
      { status: error.status || 500 }
    );
  }
}
