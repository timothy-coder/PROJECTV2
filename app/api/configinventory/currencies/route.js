import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapCurrency(row) {
  const hasConfiguration = Number(row.configured_count || 0) > 0;
  return {
    id: row.id,
    codigo: row.codigo || "",
    nombre: row.nombre || "",
    simbolo: row.simbolo || "",
    isActive: hasConfiguration ? Boolean(row.posventa_is_active) : false,
    monedaActiva: Boolean(row.moneda_is_active),
    hasConfiguration,
    createdAt: row.posventa_created_at || null,
    updatedAt: row.posventa_updated_at || null,
  };
}

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT m.id, m.codigo, m.nombre, m.simbolo, m.is_active AS moneda_is_active,
              pm.is_active AS posventa_is_active,
              pm.created_at AS posventa_created_at,
              pm.updated_at AS posventa_updated_at,
              (SELECT COUNT(*) FROM configuracion_posventa_monedas) AS configured_count
       FROM configuracion_monedas m
       LEFT JOIN configuracion_posventa_monedas pm ON pm.moneda_id = m.id
       ORDER BY m.codigo ASC, m.nombre ASC`
    );

    return NextResponse.json({ currencies: rows.map(mapCurrency) });
  } catch (error) {
    console.error("Error loading post-sale currencies:", error);
    return NextResponse.json({ message: "No se pudieron cargar las monedas de posventa." }, { status: 500 });
  }
}

export async function PUT(request) {
  const connection = await pool.getConnection();
  try {
    const body = await request.json();
    const monedaId = Number(body.monedaId || (Array.isArray(body.monedaIds) ? body.monedaIds[0] : 0));

    if (!Number.isInteger(monedaId) || monedaId <= 0) {
      return NextResponse.json({ message: "Selecciona una moneda para posventa." }, { status: 400 });
    }

    const [[currency]] = await connection.query(
      `SELECT id FROM configuracion_monedas WHERE id = ? AND is_active = 1 LIMIT 1`,
      [monedaId]
    );

    if (!currency) {
      return NextResponse.json({ message: "La moneda seleccionada no existe o esta inactiva." }, { status: 400 });
    }

    await connection.beginTransaction();
    await connection.query(`DELETE FROM configuracion_posventa_monedas WHERE moneda_id <> ?`, [monedaId]);
    await connection.query(
      `INSERT INTO configuracion_posventa_monedas (moneda_id, is_active)
       VALUES (?, 1)
       ON DUPLICATE KEY UPDATE is_active = 1`,
      [monedaId]
    );
    await connection.commit();

    const [rows] = await connection.query(
      `SELECT m.id, m.codigo, m.nombre, m.simbolo, m.is_active AS moneda_is_active,
              pm.is_active AS posventa_is_active,
              pm.created_at AS posventa_created_at,
              pm.updated_at AS posventa_updated_at,
              (SELECT COUNT(*) FROM configuracion_posventa_monedas) AS configured_count
       FROM configuracion_monedas m
       LEFT JOIN configuracion_posventa_monedas pm ON pm.moneda_id = m.id
       ORDER BY m.codigo ASC, m.nombre ASC`
    );

    return NextResponse.json({ currencies: rows.map(mapCurrency) });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating post-sale currencies:", error);
    return NextResponse.json({ message: "No se pudieron guardar las monedas de posventa." }, { status: 500 });
  } finally {
    connection.release();
  }
}
