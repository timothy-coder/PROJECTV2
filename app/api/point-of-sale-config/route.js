import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

const IGNORABLE_SCHEMA_ERRORS = new Set([
  "ER_DUP_FIELDNAME",
  "ER_DUP_KEYNAME",
  "ER_CANT_DROP_FIELD_OR_KEY",
  "ER_BAD_FIELD_ERROR",
]);

async function tryQuery(sql) {
  try {
    await pool.query(sql);
  } catch (error) {
    if (!IGNORABLE_SCHEMA_ERRORS.has(error?.code)) throw error;
  }
}

async function ensureTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS configuracion_puntos_venta (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      codigo VARCHAR(30) NOT NULL,
      taller_id INT NULL DEFAULT NULL,
      mostrador_id INT NULL DEFAULT NULL,
      created_by BIGINT UNSIGNED NULL DEFAULT NULL,
      hora_apertura TIME NULL DEFAULT NULL,
      hora_cierre TIME NULL DEFAULT NULL,
      monto_inicial DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      monto_recaudado DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_punto_venta_codigo (codigo),
      KEY idx_punto_venta_taller (taller_id),
      KEY idx_punto_venta_mostrador (mostrador_id),
      KEY idx_punto_venta_created_by (created_by),
      CONSTRAINT fk_punto_venta_taller
        FOREIGN KEY (taller_id) REFERENCES configuracion_talleres (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
      CONSTRAINT fk_punto_venta_mostrador
        FOREIGN KEY (mostrador_id) REFERENCES configuracion_mostradores (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
      CONSTRAINT fk_punto_venta_created_by
        FOREIGN KEY (created_by) REFERENCES administracion_usuarios (id)
        ON UPDATE CASCADE ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`
  );

  await tryQuery(`ALTER TABLE configuracion_puntos_venta ADD COLUMN taller_id INT NULL DEFAULT NULL AFTER codigo`);
  await tryQuery(`ALTER TABLE configuracion_puntos_venta ADD COLUMN created_by BIGINT UNSIGNED NULL DEFAULT NULL AFTER mostrador_id`);
  await tryQuery(`ALTER TABLE configuracion_puntos_venta ADD COLUMN hora_apertura TIME NULL DEFAULT NULL AFTER created_by`);
  await tryQuery(`ALTER TABLE configuracion_puntos_venta ADD COLUMN hora_cierre TIME NULL DEFAULT NULL AFTER hora_apertura`);
  await tryQuery(`ALTER TABLE configuracion_puntos_venta ADD COLUMN monto_inicial DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER hora_cierre`);
  await tryQuery(`ALTER TABLE configuracion_puntos_venta ADD COLUMN monto_recaudado DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER monto_inicial`);
  await tryQuery(`ALTER TABLE configuracion_puntos_venta ADD KEY idx_punto_venta_taller (taller_id)`);
  await tryQuery(`ALTER TABLE configuracion_puntos_venta ADD KEY idx_punto_venta_created_by (created_by)`);
  await tryQuery(`ALTER TABLE configuracion_puntos_venta MODIFY nombre VARCHAR(120) NULL DEFAULT NULL`);
}

async function requirePointOfSale() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["puntoventa", "view"])) {
    return { error: NextResponse.json({ message: "No tienes permiso para Punto de Venta." }, { status: 403 }) };
  }
  return { user };
}

async function getInventorySettings() {
  try {
    const [rows] = await pool.query(
      `SELECT habilitar_apertura_caja
       FROM configuracion_posventa_inventario
       ORDER BY id ASC
       LIMIT 1`
    );
    return { habilitarAperturaCaja: Boolean(rows?.[0]?.habilitar_apertura_caja) };
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
    return { habilitarAperturaCaja: false };
  }
}

function mapPoint(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo,
    tallerId: row.taller_id,
    mostradorId: row.mostrador_id,
    createdBy: row.created_by,
    horaApertura: row.hora_apertura || "",
    horaCierre: row.hora_cierre || "",
    montoInicial: Number(row.monto_inicial || 0),
    montoRecaudado: Number(row.monto_recaudado || 0),
    tallerNombre: row.taller_nombre || "",
    mostradorNombre: row.mostrador_nombre || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getActivePoint(userId) {
  const [rows] = await pool.query(
    `SELECT pv.id, pv.codigo, pv.taller_id, pv.mostrador_id, pv.created_by,
            pv.hora_apertura, pv.hora_cierre, pv.monto_inicial, pv.monto_recaudado,
            pv.created_at, pv.updated_at,
            t.nombre AS taller_nombre, m.nombre AS mostrador_nombre
     FROM configuracion_puntos_venta pv
     LEFT JOIN configuracion_talleres t ON t.id = pv.taller_id
     LEFT JOIN configuracion_mostradores m ON m.id = pv.mostrador_id
     WHERE pv.created_by = ? AND pv.hora_cierre IS NULL
     ORDER BY pv.updated_at DESC, pv.id DESC
     LIMIT 1`,
    [userId]
  );
  return mapPoint(rows?.[0]);
}

async function getOptions() {
  const [workshops] = await pool.query(`SELECT id, centro_id, nombre FROM configuracion_talleres ORDER BY nombre ASC`);
  const [counters] = await pool.query(`SELECT id, centro_id, nombre FROM configuracion_mostradores ORDER BY nombre ASC`);
  return {
    workshops: workshops.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
    counters: counters.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
  };
}

export async function GET() {
  try {
    const allowed = await requirePointOfSale();
    if (allowed.error) return allowed.error;
    await ensureTable();

    const [settings, activePoint, options] = await Promise.all([
      getInventorySettings(),
      getActivePoint(allowed.user.id),
      getOptions(),
    ]);

    return NextResponse.json({
      settings,
      activePoint,
      items: activePoint ? [activePoint] : [],
      options,
    });
  } catch (error) {
    console.error("Error loading point of sale status:", error);
    return NextResponse.json({ message: "No se pudo cargar el estado de Punto de Venta." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const allowed = await requirePointOfSale();
    if (allowed.error) return allowed.error;
    await ensureTable();

    const settings = await getInventorySettings();
    if (!settings.habilitarAperturaCaja) {
      return NextResponse.json({ message: "La apertura de caja no esta habilitada." }, { status: 400 });
    }

    const current = await getActivePoint(allowed.user.id);
    if (current) return NextResponse.json({ ok: true, activePoint: current });

    const body = await request.json();
    const codigo = String(body.codigo || "").trim().toUpperCase();
    const tallerId = body.tallerId ? Number(body.tallerId) : null;
    const mostradorId = body.mostradorId ? Number(body.mostradorId) : null;
    const montoInicial = Number(body.montoInicial || 0);

    if (!codigo) return NextResponse.json({ message: "El codigo del punto de venta es obligatorio." }, { status: 400 });
    if (Number.isNaN(montoInicial) || montoInicial < 0) {
      return NextResponse.json({ message: "El monto inicial debe ser mayor o igual a cero." }, { status: 400 });
    }

    const [existingRows] = await pool.query(
      `SELECT id, created_by, hora_cierre
       FROM configuracion_puntos_venta
       WHERE codigo = ?
       LIMIT 1`,
      [codigo]
    );
    const existing = existingRows?.[0];
    if (existing?.hora_cierre === null && existing.created_by && Number(existing.created_by) !== Number(allowed.user.id)) {
      return NextResponse.json({ message: "Este punto de venta ya esta abierto por otro usuario." }, { status: 409 });
    }

    if (existing) {
      await pool.query(
        `UPDATE configuracion_puntos_venta
         SET taller_id=?, mostrador_id=?, created_by=?, hora_apertura=CURRENT_TIME(),
             hora_cierre=NULL, monto_inicial=?, monto_recaudado=0
         WHERE id=?`,
        [tallerId, mostradorId, allowed.user.id, montoInicial, existing.id]
      );
    } else {
      await pool.query(
        `INSERT INTO configuracion_puntos_venta
           (codigo, taller_id, mostrador_id, created_by, hora_apertura, hora_cierre, monto_inicial, monto_recaudado)
         VALUES (?, ?, ?, ?, CURRENT_TIME(), NULL, ?, 0)`,
        [codigo, tallerId, mostradorId, allowed.user.id, montoInicial]
      );
    }

    const activePoint = await getActivePoint(allowed.user.id);
    return NextResponse.json({ ok: true, activePoint }, { status: 201 });
  } catch (error) {
    console.error("Error opening point of sale:", error);
    return NextResponse.json({ message: "No se pudo abrir el punto de venta." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const allowed = await requirePointOfSale();
    if (allowed.error) return allowed.error;
    await ensureTable();

    const body = await request.json();
    const id = Number(body.id || 0);
    const montoRecaudado = body.montoRecaudado === undefined || body.montoRecaudado === ""
      ? null
      : Number(body.montoRecaudado);

    if (montoRecaudado !== null && (Number.isNaN(montoRecaudado) || montoRecaudado < 0)) {
      return NextResponse.json({ message: "El monto recaudado debe ser mayor o igual a cero." }, { status: 400 });
    }

    const activePoint = await getActivePoint(allowed.user.id);
    if (!activePoint || (id && Number(activePoint.id) !== id)) {
      return NextResponse.json({ message: "No tienes un punto de venta abierto para cerrar." }, { status: 404 });
    }

    await pool.query(
      `UPDATE configuracion_puntos_venta
       SET hora_cierre=CURRENT_TIME(), monto_recaudado=COALESCE(?, monto_recaudado)
       WHERE id=? AND created_by=? AND hora_cierre IS NULL`,
      [montoRecaudado, activePoint.id, allowed.user.id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error closing point of sale:", error);
    return NextResponse.json({ message: "No se pudo cerrar el punto de venta." }, { status: 500 });
  }
}
