import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function normalizeContact(body) {
  return {
    email: String(body.email || "").trim() || null,
    phone: String(body.phone || "").trim() || null,
  };
}

export async function PUT(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const payload = normalizeContact(await request.json());

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return NextResponse.json({ message: "Ingresa un correo valido." }, { status: 400 });
    }

    await pool.query(
      `UPDATE administracion_usuarios
       SET email = ?, phone = ?
       WHERE id = ?`,
      [payload.email, payload.phone, user.id]
    );

    return NextResponse.json({ ok: true, email: payload.email, phone: payload.phone });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ message: "No se pudo actualizar el perfil." }, { status: 500 });
  }
}
