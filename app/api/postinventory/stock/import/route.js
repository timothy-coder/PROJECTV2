import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function value(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return "";
}

function cleanText(input) {
  return String(input || "").trim();
}

function numberValue(input) {
  const value = Number(String(input ?? "").replace(/,/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function buildMap(rows, fields = ["nombre"]) {
  const map = new Map();
  rows.forEach((row) => {
    map.set(String(row.id), row.id);
    fields.forEach((field) => {
      const key = row[field];
      if (key !== undefined && key !== null && String(key).trim() !== "") {
        map.set(String(key).trim().toLowerCase(), row.id);
      }
    });
  });
  return map;
}

async function syncProductStock(connection, productoId) {
  const [sumRows] = await connection.query(
    `SELECT COALESCE(SUM(stock), 0) AS usado FROM posventa_stock WHERE producto_id = ?`,
    [productoId]
  );
  const [productRows] = await connection.query(
    `SELECT stock_total FROM posventa_productos WHERE id = ?`,
    [productoId]
  );
  const usado = Number(sumRows[0]?.usado || 0);
  const total = Number(productRows[0]?.stock_total || 0);
  await connection.query(
    `UPDATE posventa_productos SET stock_usado = ?, stock_disponible = ? WHERE id = ?`,
    [usado, Math.max(total - usado, 0), productoId]
  );
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) {
      return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });
    }

    const [productRows] = await connection.query(`SELECT id, numero_parte FROM posventa_productos`);
    const [centerRows] = await connection.query(`SELECT id, nombre FROM configuracion_centros`);
    const [workshopRows] = await connection.query(`SELECT id, centro_id, nombre FROM configuracion_talleres`);
    const [counterRows] = await connection.query(`SELECT id, centro_id, nombre FROM configuracion_mostradores`);
    const productMap = buildMap(productRows, ["numero_parte"]);
    const centerMap = buildMap(centerRows);
    const workshopMap = buildMap(workshopRows);
    const counterMap = buildMap(counterRows);

    let imported = 0;
    const touchedProducts = new Set();
    const errors = [];

    await connection.beginTransaction();
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const productRaw = cleanText(value(row, ["producto_id", "Producto ID", "numero_parte", "Numero Parte", "N Parte", "numeroParte"]));
      const centerRaw = cleanText(value(row, ["centro_id", "Centro ID", "centro", "Centro"]));
      const workshopRaw = cleanText(value(row, ["taller_id", "Taller ID", "taller", "Taller"]));
      const counterRaw = cleanText(value(row, ["mostrador_id", "Mostrador ID", "mostrador", "Mostrador"]));
      const stock = numberValue(value(row, ["stock", "Stock", "cantidad", "Cantidad"]));

      const productoId = productMap.get(productRaw) || productMap.get(productRaw.toLowerCase());
      const centroId = centerMap.get(centerRaw) || centerMap.get(centerRaw.toLowerCase());
      const tallerId = workshopRaw ? workshopMap.get(workshopRaw) || workshopMap.get(workshopRaw.toLowerCase()) || null : null;
      const mostradorId = counterRaw ? counterMap.get(counterRaw) || counterMap.get(counterRaw.toLowerCase()) || null : null;

      if (!productoId || !centroId || Number.isNaN(stock) || (tallerId && mostradorId)) {
        errors.push(`Fila ${index + 2}: producto, centro y stock son obligatorios; usa solo taller o mostrador.`);
        continue;
      }

      await connection.query(
        `INSERT INTO posventa_stock (producto_id, centro_id, taller_id, mostrador_id, stock)
         VALUES (?, ?, ?, ?, ?)`,
        [productoId, centroId, tallerId, mostradorId, stock]
      );
      touchedProducts.add(productoId);
      imported += 1;
    }

    if (errors.length && !imported) {
      await connection.rollback();
      return NextResponse.json({ message: errors[0], errors }, { status: 400 });
    }

    for (const productoId of touchedProducts) {
      await syncProductStock(connection, productoId);
    }

    await connection.commit();
    return NextResponse.json({ imported, errors });
  } catch (error) {
    await connection.rollback();
    console.error("Error importing post inventory stock:", error);
    return NextResponse.json({ message: "No se pudo importar stock." }, { status: 500 });
  } finally {
    connection.release();
  }
}
