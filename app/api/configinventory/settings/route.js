import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

const DEFAULT_SETTINGS = {
  habilitarMarcaManual: false,
  habilitarLotes: true,
  habilitarFechaVencimiento: true,
  habilitarProveedorEnLote: true,
  habilitarTipoMedida: true,
};

function mapSettings(row) {
  return {
    id: row?.id || null,
    habilitarMarcaManual: Boolean(row?.habilitar_marca_manual ?? DEFAULT_SETTINGS.habilitarMarcaManual),
    habilitarLotes: Boolean(row?.habilitar_lotes ?? DEFAULT_SETTINGS.habilitarLotes),
    habilitarFechaVencimiento: Boolean(row?.habilitar_fecha_vencimiento ?? DEFAULT_SETTINGS.habilitarFechaVencimiento),
    habilitarProveedorEnLote: Boolean(row?.habilitar_proveedor_en_lote ?? DEFAULT_SETTINGS.habilitarProveedorEnLote),
    habilitarTipoMedida: Boolean(row?.habilitar_tipo_medida ?? DEFAULT_SETTINGS.habilitarTipoMedida),
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
  };
}

function payloadValue(body, key) {
  return body[key] ? 1 : 0;
}

async function ensureSettingsRow() {
  const [[row]] = await pool.query(
    `SELECT *
     FROM configuracion_posventa_inventario
     ORDER BY id ASC
     LIMIT 1`
  );
  if (row) return row;

  const [result] = await pool.query(
    `INSERT INTO configuracion_posventa_inventario
     (habilitar_marca_manual, habilitar_lotes, habilitar_fecha_vencimiento, habilitar_proveedor_en_lote, habilitar_tipo_medida)
     VALUES (0, 1, 1, 1, 1)`
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
           habilitar_tipo_medida = ?
       WHERE id = ?`,
      [
        payloadValue(body, "habilitarMarcaManual"),
        payloadValue(body, "habilitarLotes"),
        payloadValue(body, "habilitarFechaVencimiento"),
        payloadValue(body, "habilitarProveedorEnLote"),
        payloadValue(body, "habilitarTipoMedida"),
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
