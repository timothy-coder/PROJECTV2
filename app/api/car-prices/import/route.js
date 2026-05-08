import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function boolValue(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "si", "sí", "yes"].includes(normalize(value));
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });

    const [brandRows] = await connection.query(`SELECT id, name FROM administracion_marcas`);
    const [modelRows] = await connection.query(`SELECT id, marca_id, name FROM administracion_modelos`);
    const [currencyRows] = await connection.query(`SELECT id, codigo FROM configuracion_monedas`);
    const brands = new Map(brandRows.map((row) => [normalize(row.name), row.id]));
    const models = new Map(modelRows.map((row) => [`${row.marca_id}:${normalize(row.name)}`, row.id]));
    const currencies = new Map(currencyRows.map((row) => [normalize(row.codigo), row.id]));

    let imported = 0;
    let updated = 0;
    const errors = [];
    await connection.beginTransaction();

    for (const [index, row] of rows.entries()) {
      const marcaId = Number(row.marca_id || row.marcaId) || brands.get(normalize(row.marca || row.marcaName));
      const modeloId = Number(row.modelo_id || row.modeloId) || models.get(`${marcaId}:${normalize(row.modelo || row.modeloName)}`);
      const monedaId = Number(row.moneda_id || row.monedaId) || currencies.get(normalize(row.moneda || row.monedaCodigo));
      const version = String(row.version || "").trim();
      const precioBase = Number(row.precio_base ?? row.precioBase ?? 0);
      const enStock = boolValue(row.en_stock ?? row.enStock, true);
      const existe = boolValue(row.existe, true);
      const tiempoEntregaDias = Number(row.tiempo_entrega_dias ?? row.tiempoEntregaDias ?? 0);

      if (!marcaId || !modeloId || !monedaId || !version || Number.isNaN(precioBase)) {
        errors.push(`Fila ${index + 2}: marca/modelo/version/moneda/precio invalido.`);
        continue;
      }

      const [result] = await connection.query(
        `INSERT INTO ventas_precios
         (marca_id, modelo_id, version, moneda_id, precio_base, en_stock, existe, tiempo_entrega_dias)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE moneda_id = VALUES(moneda_id), precio_base = VALUES(precio_base),
           en_stock = VALUES(en_stock), existe = VALUES(existe), tiempo_entrega_dias = VALUES(tiempo_entrega_dias)`,
        [marcaId, modeloId, version, monedaId, precioBase, enStock ? 1 : 0, existe ? 1 : 0, tiempoEntregaDias]
      );
      imported += 1;
      if (result.affectedRows === 2) updated += 1;
    }

    if (!imported) {
      await connection.rollback();
      return NextResponse.json({ message: errors[0] || "No se pudo importar." }, { status: 400 });
    }

    await connection.commit();
    return NextResponse.json({ ok: true, imported, updated, errors });
  } catch (error) {
    await connection.rollback();
    console.error("Error importing car prices:", error);
    return NextResponse.json({ message: "No se pudo importar precios de carros." }, { status: 500 });
  } finally {
    connection.release();
  }
}
