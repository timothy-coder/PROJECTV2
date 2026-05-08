import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export async function PUT(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ message: "Completa todos los campos." }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: "La nueva contrasena debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ message: "La confirmacion no coincide." }, { status: 400 });
    }

    const [rows] = await pool.query(
      "SELECT id, password_hash FROM administracion_usuarios WHERE id = ? LIMIT 1",
      [user.id]
    );

    const dbUser = rows?.[0];
    if (!dbUser) {
      return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });
    }

    const validPassword = await bcrypt.compare(currentPassword, dbUser.password_hash);
    if (!validPassword) {
      return NextResponse.json({ message: "La contrasena actual es incorrecta." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE administracion_usuarios SET password_hash = ? WHERE id = ?", [
      passwordHash,
      user.id,
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Error al cambiar la contrasena." }, { status: 500 });
  }
}
