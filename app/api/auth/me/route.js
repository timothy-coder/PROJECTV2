import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return NextResponse.json({ user: null }, { status: 200 });

    const payload = verifySession(token);
    const userId = Number(payload.sub);

    const [rows] = await pool.query(
      `
      SELECT 
        u.id, u.fullname, u.username, u.email, u.phone, u.is_active, u.color,
        u.permissions, u.work_schedule,
        r.id as role_id, r.name as role_name
      FROM administracion_usuarios u
      LEFT JOIN configuracion_roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [userId]
    );

    const user = rows?.[0];
    if (!user || !user.is_active) return NextResponse.json({ user: null }, { status: 200 });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          fullname: user.fullname,
          username: user.username,
          email: user.email,
          phone: user.phone,
          color: user.color,
          role: user.role_name ? { id: user.role_id, name: user.role_name } : null,
          permissions: user.permissions ? JSON.parse(user.permissions) : null,
          work_schedule: user.work_schedule ? JSON.parse(user.work_schedule) : null,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}