import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

async function requirePermission(action) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["config_anaqueles", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para configurar anaqueles." }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  try {
    const allowed = await requirePermission("view");
    if (allowed.error) return allowed.error;

    const [shelves] = await pool.query(
      `SELECT a.id, a.codigo, a.descripcion, a.taller_id, a.mostrador_id, a.activo, a.created_at,
              t.nombre AS taller_nombre, m.nombre AS mostrador_nombre
       FROM almacen_anaqueles a
       LEFT JOIN configuracion_talleres t ON t.id = a.taller_id
       LEFT JOIN configuracion_mostradores m ON m.id = a.mostrador_id
       ORDER BY a.codigo ASC`
    );
    const [levels] = await pool.query(
      `SELECT n.id, n.anaquel_id, n.codigo_nivel, n.orden_nivel, n.activo, n.created_at,
              a.codigo AS anaquel_codigo
       FROM almacen_anaquel_niveles n
       INNER JOIN almacen_anaqueles a ON a.id = n.anaquel_id
       ORDER BY a.codigo ASC, n.orden_nivel ASC`
    );
    const [positions] = await pool.query(
      `SELECT p.id, p.nivel_id, p.posicion, p.activo, p.created_at,
              n.codigo_nivel, a.id AS anaquel_id, a.codigo AS anaquel_codigo
       FROM almacen_nivel_posiciones p
       INNER JOIN almacen_anaquel_niveles n ON n.id = p.nivel_id
       INNER JOIN almacen_anaqueles a ON a.id = n.anaquel_id
       ORDER BY a.codigo ASC, n.orden_nivel ASC, p.posicion ASC`
    );
    const [workshops] = await pool.query(`SELECT id, centro_id, nombre FROM configuracion_talleres ORDER BY nombre ASC`);
    const [counters] = await pool.query(`SELECT id, centro_id, nombre FROM configuracion_mostradores ORDER BY nombre ASC`);

    return NextResponse.json({
      shelves: shelves.map((row) => ({
        id: row.id,
        codigo: row.codigo,
        descripcion: row.descripcion || "",
        tallerId: row.taller_id,
        mostradorId: row.mostrador_id,
        tallerNombre: row.taller_nombre || "",
        mostradorNombre: row.mostrador_nombre || "",
        activo: Boolean(row.activo),
        createdAt: row.created_at,
      })),
      levels: levels.map((row) => ({
        id: row.id,
        anaquelId: row.anaquel_id,
        anaquelCodigo: row.anaquel_codigo || "",
        codigoNivel: row.codigo_nivel,
        ordenNivel: row.orden_nivel,
        activo: Boolean(row.activo),
        createdAt: row.created_at,
      })),
      positions: positions.map((row) => ({
        id: row.id,
        nivelId: row.nivel_id,
        codigoNivel: row.codigo_nivel || "",
        anaquelId: row.anaquel_id,
        anaquelCodigo: row.anaquel_codigo || "",
        posicion: row.posicion,
        activo: Boolean(row.activo),
        createdAt: row.created_at,
      })),
      options: {
        workshops: workshops.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
        counters: counters.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
      },
    });
  } catch (error) {
    console.error("Error loading warehouse locations:", error);
    return NextResponse.json({ message: "No se pudo cargar ubicaciones de almacen." }, { status: 500 });
  }
}
