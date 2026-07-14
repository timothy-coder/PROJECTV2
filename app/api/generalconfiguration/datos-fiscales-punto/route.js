import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function mapFiscal(row) {
  return {
    id: row.id,
    razonSocial: row.razon_social,
    direccion: row.direccion || "",
    ruc: row.ruc,
    celular: row.celular || "",
    logoPath: row.logo_path || "",
    tallerId: row.taller_id,
    mostradorId: row.mostrador_id,
    tallerNombre: row.taller_nombre || "",
    mostradorNombre: row.mostrador_nombre || "",
    scope: row.taller_id ? "taller" : row.mostrador_id ? "mostrador" : "global",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function getMode() {
  const [[mode]] = await pool.query(
    `SELECT id, usar_global
     FROM configuracion_datos_fiscales_modo
     ORDER BY id ASC
     LIMIT 1`
  );
  if (mode) return { id: mode.id, usarGlobal: Boolean(mode.usar_global) };
  const [result] = await pool.query(`INSERT INTO configuracion_datos_fiscales_modo (usar_global) VALUES (1)`);
  return { id: result.insertId, usarGlobal: true };
}

async function getAssignedPoints(userId) {
  const [talleres] = await pool.query(
    `SELECT t.id, t.nombre
     FROM administracion_usuario_talleres ut
     INNER JOIN configuracion_talleres t ON t.id = ut.taller_id
     WHERE ut.usuario_id = ?
     ORDER BY t.nombre ASC`,
    [userId]
  );
  const [mostradores] = await pool.query(
    `SELECT m.id, m.nombre
     FROM administracion_usuario_mostradores um
     INNER JOIN configuracion_mostradores m ON m.id = um.mostrador_id
     WHERE um.usuario_id = ?
     ORDER BY m.nombre ASC`,
    [userId]
  );
  return {
    talleres: talleres.map((row) => ({ id: row.id, nombre: row.nombre })),
    mostradores: mostradores.map((row) => ({ id: row.id, nombre: row.nombre })),
  };
}

function canAccessPoint(assigned, tallerId, mostradorId) {
  if (!tallerId && !mostradorId) return true;
  if (tallerId) return assigned.talleres.some((item) => Number(item.id) === Number(tallerId));
  if (mostradorId) return assigned.mostradores.some((item) => Number(item.id) === Number(mostradorId));
  return false;
}

async function requireUser(action = "view") {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autenticado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["configuracion_datos_fiscales_punto", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para datos fiscales." }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  try {
    const auth = await requireUser("view");
    if (auth.error) return auth.error;
    const mode = await getMode();
    const assigned = await getAssignedPoints(auth.user.id);
    const scopeSql = mode.usarGlobal
      ? "WHERE f.taller_id IS NULL AND f.mostrador_id IS NULL"
      : `WHERE (
           f.taller_id IS NULL AND f.mostrador_id IS NULL
           OR f.taller_id IN (SELECT taller_id FROM administracion_usuario_talleres WHERE usuario_id = ?)
           OR f.mostrador_id IN (SELECT mostrador_id FROM administracion_usuario_mostradores WHERE usuario_id = ?)
         )`;
    const params = mode.usarGlobal ? [] : [auth.user.id, auth.user.id];
    const [rows] = await pool.query(
      `SELECT f.*, t.nombre AS taller_nombre, m.nombre AS mostrador_nombre
       FROM configuracion_datos_fiscales_punto f
       LEFT JOIN configuracion_talleres t ON t.id = f.taller_id
       LEFT JOIN configuracion_mostradores m ON m.id = f.mostrador_id
       ${scopeSql}
       ORDER BY f.id DESC`,
      params
    );
    return NextResponse.json({ mode, assigned, items: rows.map(mapFiscal) });
  } catch (error) {
    console.error("Error loading fiscal point data:", error);
    return NextResponse.json({ message: "No se pudieron cargar los datos fiscales." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireUser("create");
    if (auth.error) return auth.error;
    const body = await request.json();
    const mode = await getMode();
    const assigned = await getAssignedPoints(auth.user.id);
    const usarGlobal = Boolean(body?.usarGlobal ?? mode.usarGlobal);

    await pool.query(`UPDATE configuracion_datos_fiscales_modo SET usar_global = ? WHERE id = ?`, [usarGlobal ? 1 : 0, mode.id]);

    const razonSocial = clean(body?.razonSocial);
    const ruc = clean(body?.ruc);
    const direccion = clean(body?.direccion);
    const celular = clean(body?.celular);
    const logoPath = clean(body?.logoPath);
    let tallerId = usarGlobal ? null : Number(body?.tallerId) || null;
    let mostradorId = usarGlobal ? null : Number(body?.mostradorId) || null;

    if (!razonSocial || !ruc) {
      return NextResponse.json({ message: "Razon social y RUC son obligatorios." }, { status: 400 });
    }
    if (!usarGlobal && Boolean(tallerId) === Boolean(mostradorId)) {
      return NextResponse.json({ message: "Selecciona un almacen o un mostrador." }, { status: 400 });
    }
    if (!canAccessPoint(assigned, tallerId, mostradorId)) {
      return NextResponse.json({ message: "No tienes asignado ese almacen o mostrador." }, { status: 403 });
    }

    if (usarGlobal) {
      const [[existing]] = await pool.query(
        `SELECT id FROM configuracion_datos_fiscales_punto
         WHERE taller_id IS NULL AND mostrador_id IS NULL
         ORDER BY id ASC
         LIMIT 1`
      );
      if (existing) {
        await pool.query(
          `UPDATE configuracion_datos_fiscales_punto
           SET razon_social = ?, direccion = ?, ruc = ?, celular = ?, logo_path = ?, taller_id = NULL, mostrador_id = NULL
           WHERE id = ?`,
          [razonSocial, direccion, ruc, celular, logoPath, existing.id]
        );
      } else {
        await pool.query(
          `INSERT INTO configuracion_datos_fiscales_punto
           (razon_social, direccion, ruc, celular, logo_path, taller_id, mostrador_id)
           VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
          [razonSocial, direccion, ruc, celular, logoPath]
        );
      }
    } else {
      await pool.query(
        `INSERT INTO configuracion_datos_fiscales_punto
         (razon_social, direccion, ruc, celular, logo_path, taller_id, mostrador_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [razonSocial, direccion, ruc, celular, logoPath, tallerId, mostradorId]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving fiscal point data:", error);
    return NextResponse.json({ message: "No se pudieron guardar los datos fiscales." }, { status: 500 });
  }
}
