import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

const DEFAULT_SETTINGS = {
  habilitarMarcaManual: false,
  habilitarLotes: true,
  habilitarFechaVencimiento: true,
  habilitarProveedorEnLote: true,
  habilitarTipoMedida: true,
  habilitarAperturaCaja: false,
  tcReferencial: 0,
};

function mapSettings(row) {
  return {
    id: row?.id || null,
    habilitarMarcaManual: Boolean(row?.habilitar_marca_manual ?? DEFAULT_SETTINGS.habilitarMarcaManual),
    habilitarLotes: Boolean(row?.habilitar_lotes ?? DEFAULT_SETTINGS.habilitarLotes),
    habilitarFechaVencimiento: Boolean(row?.habilitar_fecha_vencimiento ?? DEFAULT_SETTINGS.habilitarFechaVencimiento),
    habilitarProveedorEnLote: Boolean(row?.habilitar_proveedor_en_lote ?? DEFAULT_SETTINGS.habilitarProveedorEnLote),
    habilitarTipoMedida: Boolean(row?.habilitar_tipo_medida ?? DEFAULT_SETTINGS.habilitarTipoMedida),
    habilitarAperturaCaja: Boolean(row?.habilitar_apertura_caja ?? DEFAULT_SETTINGS.habilitarAperturaCaja),
    tcReferencial: Number(row?.tc_referencial ?? DEFAULT_SETTINGS.tcReferencial),
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
  };
}

function payloadValue(body, key) {
  return body[key] ? 1 : 0;
}

function decimalValue(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

async function ensureSettingsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS configuracion_posventa_inventario (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      habilitar_marca_manual TINYINT(1) NOT NULL DEFAULT 0,
      habilitar_lotes TINYINT(1) NOT NULL DEFAULT 1,
      habilitar_fecha_vencimiento TINYINT(1) NOT NULL DEFAULT 1,
      habilitar_proveedor_en_lote TINYINT(1) NOT NULL DEFAULT 1,
      habilitar_tipo_medida TINYINT(1) NOT NULL DEFAULT 1,
      habilitar_apertura_caja TINYINT(1) NOT NULL DEFAULT 0,
      tc_referencial DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB COLLATE='utf8mb4_0900_ai_ci'`
  );

  const requiredColumns = [
    ["habilitar_marca_manual", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["habilitar_lotes", "TINYINT(1) NOT NULL DEFAULT 1"],
    ["habilitar_fecha_vencimiento", "TINYINT(1) NOT NULL DEFAULT 1"],
    ["habilitar_proveedor_en_lote", "TINYINT(1) NOT NULL DEFAULT 1"],
    ["habilitar_tipo_medida", "TINYINT(1) NOT NULL DEFAULT 1"],
    ["habilitar_apertura_caja", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["tc_referencial", "DECIMAL(10,4) NOT NULL DEFAULT 0.0000"],
    ["created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"],
    ["updated_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"],
  ];
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'configuracion_posventa_inventario'`
  );
  const existing = new Set(columns.map((column) => column.COLUMN_NAME));
  for (const [column, definition] of requiredColumns) {
    if (!existing.has(column)) {
      await pool.query(`ALTER TABLE configuracion_posventa_inventario ADD COLUMN \`${column}\` ${definition}`);
    }
  }
}

async function ensureSettingsRow() {
  await ensureSettingsTable();
  const [[row]] = await pool.query(
    `SELECT *
     FROM configuracion_posventa_inventario
     ORDER BY id ASC
     LIMIT 1`
  );
  if (row) {
    await pool.query(`DELETE FROM configuracion_posventa_inventario WHERE id <> ?`, [row.id]);
    return row;
  }

  const [result] = await pool.query(
    `INSERT INTO configuracion_posventa_inventario
     (habilitar_marca_manual, habilitar_lotes, habilitar_fecha_vencimiento, habilitar_proveedor_en_lote, habilitar_tipo_medida, habilitar_apertura_caja, tc_referencial)
     VALUES (0, 1, 1, 1, 1, 0, 0.0000)`
  );
  const [[created]] = await pool.query(`SELECT * FROM configuracion_posventa_inventario WHERE id = ?`, [result.insertId]);
  return created;
}

export async function GET() {
  try {
    const row = await ensureSettingsRow();
    return NextResponse.json({ settings: mapSettings(row) });
  } catch (error) {
    console.error("Error loading inventory settings:", error);
    return NextResponse.json({ message: "No se pudo cargar la configuracion de inventario." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const current = await ensureSettingsRow();

    await pool.query(
      `UPDATE configuracion_posventa_inventario
       SET habilitar_marca_manual = ?,
           habilitar_lotes = ?,
           habilitar_fecha_vencimiento = ?,
           habilitar_proveedor_en_lote = ?,
           habilitar_tipo_medida = ?,
           habilitar_apertura_caja = ?,
           tc_referencial = ?
       WHERE id = ?`,
      [
        payloadValue(body, "habilitarMarcaManual"),
        payloadValue(body, "habilitarLotes"),
        payloadValue(body, "habilitarFechaVencimiento"),
        payloadValue(body, "habilitarProveedorEnLote"),
        payloadValue(body, "habilitarTipoMedida"),
        payloadValue(body, "habilitarAperturaCaja"),
        decimalValue(body.tcReferencial),
        current.id,
      ]
    );

    const [[updated]] = await pool.query(`SELECT * FROM configuracion_posventa_inventario WHERE id = ?`, [current.id]);
    return NextResponse.json({ settings: mapSettings(updated) });
  } catch (error) {
    console.error("Error updating inventory settings:", error);
    return NextResponse.json({ message: "No se pudo guardar la configuracion de inventario." }, { status: 500 });
  }
}
