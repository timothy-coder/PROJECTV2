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

function numberValue(input, fallback = 0) {
  const value = Number(String(input ?? "").replace(/,/g, ""));
  return Number.isFinite(value) ? value : fallback;
}

function parseYearMonth(input) {
  if (!input) return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return { anio: input.getFullYear(), mes: input.getMonth() + 1 };
  }

  const text = String(input).trim();
  const localMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/);
  if (localMatch) {
    return { anio: Number(localMatch[3]), mes: Number(localMatch[2]) };
  }

  const isoDate = new Date(text);
  if (!Number.isNaN(isoDate.getTime())) {
    return { anio: isoDate.getFullYear(), mes: isoDate.getMonth() + 1 };
  }

  return null;
}

async function addToSoldMonth(connection, productoId, anio, mes, cantidad) {
  const [existingRows] = await connection.query(
    `SELECT id, cantidad FROM posventa_productos_ventames
     WHERE producto_id = ? AND anio = ? AND mes = ?
     LIMIT 1`,
    [productoId, anio, mes]
  );

  if (existingRows.length) {
    await connection.query(
      `UPDATE posventa_productos_ventames
       SET cantidad = ?
       WHERE id = ?`,
      [Number(existingRows[0].cantidad || 0) + cantidad, existingRows[0].id]
    );
    return "updated";
  }

  await connection.query(
    `INSERT INTO posventa_productos_ventames (producto_id, anio, mes, cantidad)
     VALUES (?, ?, ?, ?)`,
    [productoId, anio, mes, cantidad]
  );
  return "imported";
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
    const productMap = new Map();
    productRows.forEach((item) => {
      productMap.set(String(item.id), item.id);
      if (item.numero_parte) productMap.set(String(item.numero_parte).trim().toLowerCase(), item.id);
    });

    const grouped = new Map();
    const errors = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const productRaw = cleanText(value(row, ["producto_id", "Producto ID", "numero_parte", "Numero Parte", "N Parte", "numeroParte"]));
      const productoId = productMap.get(productRaw) || productMap.get(productRaw.toLowerCase());
      const parsedDate = parseYearMonth(value(row, ["fecha_venta", "Fecha Venta", "fecha", "Fecha", "fechaHora", "Fecha Hora"]));
      const anio = parsedDate?.anio || numberValue(value(row, ["anio", "AÃ±o", "Ano", "year"]), 0);
      const mes = parsedDate?.mes || numberValue(value(row, ["mes", "Mes", "month"]), 0);
      const cantidad = numberValue(value(row, ["cantidad", "Cantidad"]), 1);

      if (!productoId || !anio || mes < 1 || mes > 12 || cantidad <= 0) {
        errors.push(`Fila ${index + 2}: producto, fecha y cantidad son obligatorios.`);
        continue;
      }

      const key = `${productoId}-${anio}-${mes}`;
      const current = grouped.get(key) || { productoId, anio, mes, cantidad: 0 };
      current.cantidad += cantidad;
      grouped.set(key, current);
    }

    if (!grouped.size) {
      return NextResponse.json({ message: errors[0] || "No hay filas validas para importar.", errors }, { status: 400 });
    }

    let imported = 0;
    let updated = 0;
    await connection.beginTransaction();
    for (const item of grouped.values()) {
      const result = await addToSoldMonth(connection, item.productoId, item.anio, item.mes, item.cantidad);
      if (result === "updated") updated += 1;
      else imported += 1;
    }
    await connection.commit();

    return NextResponse.json({ imported, updated, errors });
  } catch (error) {
    await connection.rollback();
    console.error("Error importing sold products:", error);
    return NextResponse.json({ message: "No se pudo importar productos vendidos." }, { status: 500 });
  } finally {
    connection.release();
  }
}
