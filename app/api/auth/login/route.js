import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { COOKIE_NAME, signSession, sessionCookieOptions } from "@/lib/auth";

export async function POST(req) {
  try {
    const body = await req.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return NextResponse.json(
        { message: "Usuario y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // OJO: ajusta tabla si tu FK es a `roles` en vez de `configuracion_roles`
    const [rows] = await pool.query(
      `
      SELECT 
        u.id, u.fullname, u.username, u.email, u.phone, u.password_hash, u.is_active, u.color,
        u.permissions, u.work_schedule,
        r.id as role_id, r.name as role_name, r.description as role_description
      FROM administracion_usuarios u
      LEFT JOIN configuracion_roles r ON r.id = u.role_id
      WHERE u.username = ?
      LIMIT 1
      `,
      [username]
    );

    const user = rows?.[0];
    if (!user) {
      return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 });
    }
    if (!user.is_active) {
      return NextResponse.json({ message: "Usuario inactivo" }, { status: 403 });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 });
    }

    // Arma payload mínimo para el token
    const sessionPayload = {
      sub: String(user.id),
      username: user.username,
      role: user.role_name || null,
      color: user.color || null,
    };

    const token = signSession(sessionPayload);

    // Respuesta sin password_hash
    const safeUser = {
      id: user.id,
      fullname: user.fullname,
      username: user.username,
      email: user.email,
      phone: user.phone,
      color: user.color,
      role: user.role_name ? { id: user.role_id, name: user.role_name } : null,
      permissions: user.permissions ? JSON.parse(user.permissions) : null,
      work_schedule: user.work_schedule ? JSON.parse(user.work_schedule) : null,
    };

    const res = NextResponse.json({ user: safeUser }, { status: 200 });
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Error interno" }, { status: 500 });
  }
}