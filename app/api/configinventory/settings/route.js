import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

const DEFAULT_SETTINGS = {
  habilitarMarcaManual: false,
  habilitarLotes: true,
  habilitarFechaVencimiento: true,
  habilitarProveedorEnLote: true,
  habilitarTipoMedida: true,
  habilitarProcedencia: false,
  habilitarAperturaCaja: false,
  habilitarTaller: true,
  habilitarMostrador: true,
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
    habilitarProcedencia: Boolean(row?.habilitar_procedencia ?? DEFAULT_SETTINGS.habilitarProcedencia),
    habilitarAperturaCaja: Boolean(row?.habilitar_apertura_caja ?? DEFAULT_SETTINGS.habilitarAperturaCaja),
    habilitarTaller: Boolean(row?.habilitar_taller ?? DEFAULT_SETTINGS.habilitarTaller),
    habilitarMostrador: Boolean(row?.habilitar_mostrador ?? DEFAULT_SETTINGS.habilitarMostrador),
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

async function ensureSettingsRow() {
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
     (habilitar_marca_manual, habilitar_lotes, habilitar_fecha_vencimiento, habilitar_proveedor_en_lote, habilitar_tipo_medida, habilitar_procedencia, habilitar_apertura_caja, habilitar_taller, habilitar_mostrador, tc_referencial)
     VALUES (0, 1, 1, 1, 1, 0, 0, 1, 1, 0.0000)`
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
           habilitar_procedencia = ?,
           habilitar_apertura_caja = ?,
           habilitar_taller = ?,
           habilitar_mostrador = ?,
           tc_referencial = ?
       WHERE id = ?`,
      [
        payloadValue(body, "habilitarMarcaManual"),
        payloadValue(body, "habilitarLotes"),
        payloadValue(body, "habilitarFechaVencimiento"),
        payloadValue(body, "habilitarProveedorEnLote"),
        payloadValue(body, "habilitarTipoMedida"),
        payloadValue(body, "habilitarProcedencia"),
        payloadValue(body, "habilitarAperturaCaja"),
        payloadValue(body, "habilitarTaller"),
        payloadValue(body, "habilitarMostrador"),
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
