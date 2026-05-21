import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (!hasPerm(user.permissions, ["citas", "view"]) && !hasPerm(user.permissions, ["citas", "create"]) && !hasPerm(user.permissions, ["citas", "viewall"])) {
      return NextResponse.json({ message: "No tienes permiso para usar citas de PostVenta." }, { status: 403 });
    }
    const [centers] = await pool.query(`SELECT id, nombre FROM configuracion_centros ORDER BY nombre ASC`);
    const [workshops] = await pool.query(`SELECT id, centro_id, nombre FROM configuracion_talleres ORDER BY nombre ASC`);
    const [origins] = await pool.query(`SELECT id, name FROM configuracion_origenes_citas WHERE is_active=1 ORDER BY name ASC`);
    const [users] = await pool.query(`SELECT id, fullname FROM administracion_usuarios WHERE is_active=1 ORDER BY fullname ASC`);
    return NextResponse.json({
      centers: centers.map((row) => ({ id: row.id, nombre: row.nombre })),
      workshops: workshops.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
      origins: origins.map((row) => ({ id: row.id, name: row.name })),
      users: users.map((row) => ({ id: row.id, fullname: row.fullname })),
    });
  } catch (error) {
    console.error("Error loading postventa appointment options:", error);
    return NextResponse.json({ message: "No se pudieron cargar opciones de citas." }, { status: 500 });
  }
}
