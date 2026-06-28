import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

const MAP = {
  ventas: {
    schedule: "ventas_agenda_centro",
    stages: "ventas_etapasconversion",
    times: "ventas_configuracion_estados_tiempo",
    closings: "configuracion_ventas_cierres_detalle",
    hours: "configuracion_horas",
  },
  posventa: {
    schedule: "configuracion_posventa_citas_centro",
    stages: "configuracion_posventa_etapasconversion",
    times: "configuracion_posventa_estados_tiempo",
    closings: "configuracion_posventas_cierres_detalle",
    measurementTypes: "configuracion_tipos_medida",
  },
};

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

export async function GET(_request, { params }) {
  const { scope } = await params;
  const cfg = MAP[scope];
  if (!cfg) return NextResponse.json({ message: "Scope invalido." }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  if (!canReadSettings(user, scope)) return NextResponse.json({ message: "No tienes permiso para ver esta configuracion." }, { status: 403 });
  try {
    const [centers] = await pool.query(`SELECT id, nombre FROM configuracion_centros ORDER BY nombre ASC`);
    const [scheduleRows] = await pool.query(
      `SELECT s.id, s.centro_id, s.slot_minutes, s.week_json, c.nombre AS centro_nombre
       FROM ${cfg.schedule} s INNER JOIN configuracion_centros c ON c.id = s.centro_id ORDER BY c.nombre ASC`
    );
    const [stageRows] = await pool.query(
      `SELECT id, nombre, descripcion, color, sort_order, is_active, created_at FROM ${cfg.stages} ORDER BY COALESCE(sort_order, id) ASC`
    );
    const [timeRows] = await pool.query(
      `SELECT id, nombre, estado, minutos_desde, minutos_hasta, color_hexadecimal, descripcion, activo, created_at, updated_at FROM ${cfg.times} ORDER BY minutos_desde ASC`
    );
    let closings = [];
    if (cfg.closings) {
      const [closingRows] = await pool.query(`SELECT id, detalle, created_at, updated_at FROM ${cfg.closings} ORDER BY id DESC`);
      closings = closingRows.map((row) => ({ id: row.id, detalle: row.detalle, createdAt: row.created_at, updatedAt: row.updated_at }));
    }
    let hours = [];
    if (cfg.hours) {
      const [hourRows] = await pool.query(`SELECT id, TIME_FORMAT(hora, '%H:%i') AS hora FROM ${cfg.hours} ORDER BY hora ASC`);
      hours = hourRows.map((row) => ({ id: row.id, hora: row.hora }));
    }
    let measurementTypes = [];
    if (scope === "posventa" && cfg.measurementTypes && hasPerm(user.permissions || {}, ["config_tipos_medida", "view"])) {
      const [measurementRows] = await pool.query(`SELECT id, nombre, abreviatura, created_at FROM ${cfg.measurementTypes} ORDER BY nombre ASC`);
      measurementTypes = measurementRows.map((row) => ({ id: row.id, nombre: row.nombre, abreviatura: row.abreviatura || "", createdAt: row.created_at }));
    }
    let userCounts = [];
    let userCountUsers = [];
    if (scope === "ventas" && hasPerm(user.permissions || {}, ["configuracion_usuario_counts", "view"])) {
      const [countRows] = await pool.query(
        `SELECT u.id AS usuario_id, u.fullname, u.username, auc.id, COALESCE(auc.count, 0) AS count, auc.created_at, auc.updated_at
         FROM (
           SELECT c1.*
           FROM administracion_usuario_counts c1
           INNER JOIN (
             SELECT usuario_id, MIN(id) AS id
             FROM administracion_usuario_counts
             GROUP BY usuario_id
           ) first_count ON first_count.id = c1.id
         ) auc
         INNER JOIN administracion_usuarios u ON u.id = auc.usuario_id
         ORDER BY COALESCE(NULLIF(u.fullname, ''), u.username) ASC, u.id ASC`
      );
      userCounts = countRows.map((row) => ({
        id: row.id,
        usuarioId: row.usuario_id,
        fullname: row.fullname,
        username: row.username,
        count: Number(row.count || 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      const [userRows] = await pool.query(
        `SELECT u.id, u.fullname, u.username
         FROM administracion_usuarios u
         WHERE NOT EXISTS (
           SELECT 1 FROM administracion_usuario_counts c WHERE c.usuario_id = u.id
         )
         ORDER BY COALESCE(NULLIF(u.fullname, ''), u.username) ASC, u.id ASC`
      );
      userCountUsers = userRows.map((row) => ({
        id: row.id,
        fullname: row.fullname,
        username: row.username,
      }));
    }
    return NextResponse.json({
      centers: centers.map((row) => ({ id: row.id, nombre: row.nombre })),
      schedules: scheduleRows.map((row) => ({ id: row.id, centroId: row.centro_id, centroNombre: row.centro_nombre, slotMinutes: row.slot_minutes, week: parseJson(row.week_json, defaultWeek()) })),
      stages: stageRows.map((row) => ({ id: row.id, nombre: row.nombre, descripcion: row.descripcion, color: row.color || "#2563eb", sortOrder: row.sort_order ?? row.id, isActive: Boolean(row.is_active), createdAt: row.created_at })),
      times: timeRows.map((row) => ({ id: row.id, nombre: row.nombre, estado: row.estado, minutosDesde: row.minutos_desde, minutosHasta: row.minutos_hasta, colorHexadecimal: row.color_hexadecimal, descripcion: row.descripcion || "", activo: Boolean(row.activo), createdAt: row.created_at, updatedAt: row.updated_at })),
      closings,
      hours,
      measurementTypes,
      userCounts,
      userCountUsers,
    });
  } catch (error) {
    console.error("Error loading sales settings:", error);
    return NextResponse.json({ message: "No se pudo cargar la configuracion." }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { scope } = await params;
  const cfg = MAP[scope];
  if (!cfg) return NextResponse.json({ message: "Scope invalido." }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  try {
    const body = await request.json();
    if (!canWriteSettings(user, scope, body)) return NextResponse.json({ message: "No tienes permiso para guardar esta configuracion." }, { status: 403 });
    if (body.action === "delete") {
      if (scope === "ventas" && body.resource === "user-count") await deleteUserCount(body);
      else await deleteResource(cfg, body);
    } else if (body.resource === "stage-order") {
      await reorderStages(cfg.stages, body.items || []);
    } else if (body.resource === "schedule") {
      const week = JSON.stringify(body.week || defaultWeek());
      await pool.query(
        `INSERT INTO ${cfg.schedule} (centro_id, slot_minutes, week_json)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE slot_minutes = VALUES(slot_minutes), week_json = VALUES(week_json)`,
        [Number(body.centroId), Number(body.slotMinutes || 30), week]
      );
    } else if (body.resource === "stage") {
      await upsertStage(cfg.stages, body);
    } else if (body.resource === "time") {
      await upsertTime(cfg.times, body);
    } else if (body.resource === "closing" && cfg.closings) {
      await upsertClosing(cfg.closings, body);
    } else if (body.resource === "hour" && cfg.hours) {
      await upsertHour(cfg.hours, body);
    } else if (scope === "posventa" && body.resource === "measurement-type" && cfg.measurementTypes) {
      await upsertMeasurementType(cfg.measurementTypes, body);
    } else if (scope === "ventas" && body.resource === "user-count") {
      await upsertUserCount(body);
    } else if (scope === "ventas" && body.resource === "user-count-reset") {
      await resetUserCounts();
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving sales settings:", error);
    return NextResponse.json({ message: "No se pudo guardar la configuracion." }, { status: 500 });
  }
}

async function upsertStage(table, body) {
  if (body.id) {
    await pool.query(`UPDATE ${table} SET nombre=?, descripcion=?, color=?, sort_order=?, is_active=? WHERE id=?`, [body.nombre, Number(body.descripcion || 0), body.color, Number(body.sortOrder || 0), body.isActive ? 1 : 0, Number(body.id)]);
  } else {
    await pool.query(`INSERT INTO ${table} (nombre, descripcion, color, sort_order, is_active) VALUES (?, ?, ?, ?, ?)`, [body.nombre, Number(body.descripcion || 0), body.color, Number(body.sortOrder || 0), body.isActive ? 1 : 0]);
  }
}
async function reorderStages(table, items) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const item of items) {
      await connection.query(`UPDATE ${table} SET sort_order=? WHERE id=?`, [Number(item.sortOrder), Number(item.id)]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
async function upsertTime(table, body) {
  if (body.id) {
    await pool.query(`UPDATE ${table} SET nombre=?, estado=?, minutos_desde=?, minutos_hasta=?, color_hexadecimal=?, descripcion=?, activo=? WHERE id=?`, [body.nombre, body.estado, Number(body.minutosDesde), Number(body.minutosHasta), body.colorHexadecimal, body.descripcion || null, body.activo ? 1 : 0, Number(body.id)]);
  } else {
    await pool.query(`INSERT INTO ${table} (nombre, estado, minutos_desde, minutos_hasta, color_hexadecimal, descripcion, activo) VALUES (?, ?, ?, ?, ?, ?, ?)`, [body.nombre, body.estado, Number(body.minutosDesde), Number(body.minutosHasta), body.colorHexadecimal, body.descripcion || null, body.activo ? 1 : 0]);
  }
}
async function upsertClosing(table, body) {
  if (body.id) await pool.query(`UPDATE ${table} SET detalle=? WHERE id=?`, [body.detalle, Number(body.id)]);
  else await pool.query(`INSERT INTO ${table} (detalle) VALUES (?)`, [body.detalle]);
}
async function upsertHour(table, body) {
  const hora = String(body.hora || "").trim();
  if (!/^\d{2}:\d{2}$/.test(hora)) throw new Error("Hora invalida");
  if (body.id) await pool.query(`UPDATE ${table} SET hora=? WHERE id=?`, [`${hora}:00`, Number(body.id)]);
  else await pool.query(`INSERT INTO ${table} (hora) VALUES (?)`, [`${hora}:00`]);
}
async function upsertMeasurementType(table, body) {
  const nombre = String(body.nombre || "").trim();
  const abreviatura = String(body.abreviatura || "").trim() || null;
  if (!nombre) throw new Error("Nombre requerido");
  if (body.id) await pool.query(`UPDATE ${table} SET nombre=?, abreviatura=? WHERE id=?`, [nombre, abreviatura, Number(body.id)]);
  else await pool.query(`INSERT INTO ${table} (nombre, abreviatura) VALUES (?, ?)`, [nombre, abreviatura]);
}
async function upsertUserCount(body) {
  const usuarioId = Number(body.usuarioId);
  const count = Math.max(0, Number(body.count || 0));
  if (!usuarioId) throw new Error("Usuario invalido");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id FROM administracion_usuario_counts WHERE usuario_id=? ORDER BY id ASC`,
      [usuarioId]
    );
    if (rows.length) {
      await connection.query(`UPDATE administracion_usuario_counts SET count=? WHERE id=?`, [count, rows[0].id]);
      if (rows.length > 1) {
        await connection.query(
          `DELETE FROM administracion_usuario_counts WHERE usuario_id=? AND id<>?`,
          [usuarioId, rows[0].id]
        );
      }
    } else {
      await connection.query(
        `INSERT INTO administracion_usuario_counts (usuario_id, count) VALUES (?, ?)`,
        [usuarioId, 0]
      );
      await connection.query(`UPDATE administracion_usuario_counts SET count=0`);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
async function deleteUserCount(body) {
  const id = Number(body.id);
  if (!id) throw new Error("Registro invalido");
  await pool.query(`DELETE FROM administracion_usuario_counts WHERE id=?`, [id]);
}
async function resetUserCounts() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO administracion_usuario_counts (usuario_id, count)
       SELECT u.id, 0
       FROM administracion_usuarios u
       WHERE NOT EXISTS (
         SELECT 1 FROM administracion_usuario_counts c WHERE c.usuario_id = u.id
       )`
    );
    await connection.query(
      `DELETE c2
       FROM administracion_usuario_counts c1
       INNER JOIN administracion_usuario_counts c2
         ON c1.usuario_id = c2.usuario_id AND c1.id < c2.id`
    );
    await connection.query(`UPDATE administracion_usuario_counts SET count=0`);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
async function deleteResource(cfg, body) {
  const tables = { stage: cfg.stages, time: cfg.times, closing: cfg.closings, hour: cfg.hours, "measurement-type": cfg.measurementTypes };
  const table = tables[body.resource];
  if (table) await pool.query(`DELETE FROM ${table} WHERE id=?`, [Number(body.id)]);
}
function defaultWeek() {
  return ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].reduce((acc, day) => ({ ...acc, [day]: { active: true, start: "08:00", end: "18:00" } }), {});
}

function canReadSettings(user, scope) {
  const permissions = user?.permissions || {};
  if (scope === "ventas") {
    return (
      hasPerm(permissions, ["configagenda", "view"]) ||
      hasPerm(permissions, ["configuracion_horas", "view"]) ||
      hasPerm(permissions, ["configuracion_usuario_counts", "view"]) ||
      hasPerm(permissions, ["config_ventas_plantillas", "view"])
    );
  }
  return hasPerm(permissions, ["configcotizacion", "view"]) || hasPerm(permissions, ["config_posventa_cierres", "view"]) || hasPerm(permissions, ["config_tipos_medida", "view"]);
}

function canWriteSettings(user, scope, body) {
  const permissions = user?.permissions || {};
  const resource = body?.resource;
  const action = body?.action === "delete" ? "delete" : body?.id ? "edit" : "create";
  if (scope === "ventas" && resource === "hour") return hasPerm(permissions, ["configuracion_horas", action]);
  if (scope === "ventas" && resource === "user-count") return hasPerm(permissions, ["configuracion_usuario_counts", action]);
  if (scope === "ventas" && resource === "user-count-reset") {
    return hasPerm(permissions, ["configuracion_usuario_counts", "create"]) || hasPerm(permissions, ["configuracion_usuario_counts", "edit"]);
  }
  if (scope === "posventa" && resource === "closing") return hasPerm(permissions, ["config_posventa_cierres", action]);
  if (scope === "posventa" && resource === "measurement-type") return hasPerm(permissions, ["config_tipos_medida", action]);
  const baseKey = scope === "ventas" ? "configagenda" : "configcotizacion";
  const baseAction = resource === "stage-order" || resource === "schedule" ? "edit" : action;
  return hasPerm(permissions, [baseKey, baseAction]);
}
