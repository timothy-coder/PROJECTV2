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

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) {
      return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });
    }

    const [typeRows] = await connection.query(`SELECT id, nombre FROM configuracion_inventario_tipo`);
    const [currencyRows] = await connection.query(`SELECT id, codigo, nombre, simbolo FROM configuracion_monedas`);
    const typeMap = new Map(typeRows.map((item) => [String(item.nombre || "").trim().toLowerCase(), item.id]));
    const currencyMap = new Map();
    currencyRows.forEach((item) => {
      [item.codigo, item.nombre, item.simbolo, item.id].forEach((key) => {
        if (key !== undefined && key !== null && String(key).trim() !== "") currencyMap.set(String(key).trim().toLowerCase(), item.id);
      });
    });

    let imported = 0;
    let updated = 0;
    const errors = [];

    await connection.beginTransaction();
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const numeroParte = cleanText(value(row, ["numero_parte", "Numero Parte", "N Parte", "numeroParte"]));
      const descripcion = cleanText(value(row, ["descripcion", "Descripcion", "Descripción"]));
      const marca = cleanText(value(row, ["marca", "Marca"])) || null;
      if (!numeroParte || !descripcion) {
        errors.push(`Fila ${index + 2}: numero_parte y descripcion son obligatorios.`);
        continue;
      }

      const tipoRaw = cleanText(value(row, ["tipo_inventario", "Tipo Inventario", "tipoId", "tipo_id"]));
      const monedaRaw = cleanText(value(row, ["moneda", "Moneda", "monedaId", "moneda_id"]));
      const tipoId = tipoRaw ? Number(tipoRaw) || typeMap.get(tipoRaw.toLowerCase()) || null : null;
      const monedaId = monedaRaw ? Number(monedaRaw) || currencyMap.get(monedaRaw.toLowerCase()) || null : null;
      const fechaIngreso = cleanText(value(row, ["fecha_ingreso", "Fecha Ingreso", "fechaIngreso"])) || null;
      const stockTotal = numberValue(value(row, ["stock_total", "Stock Total", "stockTotal"]));
      const precioCompra = numberValue(value(row, ["precio_compra", "Precio Compra", "precioCompra"]));
      const precioVenta = numberValue(value(row, ["precio_venta", "Precio Venta", "precioVenta"]));

      const [existingRows] = await connection.query(`SELECT id FROM posventa_productos WHERE numero_parte = ? LIMIT 1`, [numeroParte]);
      if (existingRows.length) {
        await connection.query(
          `UPDATE posventa_productos
           SET descripcion = ?, tipo_inventario_id = ?, fecha_ingreso = ?, stock_total = ?,
               marca = ?, precio_compra = ?, precio_venta = ?, moneda_id = ?,
               stock_disponible = GREATEST(? - stock_usado, 0)
           WHERE id = ?`,
          [descripcion, tipoId, fechaIngreso, stockTotal, marca, precioCompra, precioVenta, monedaId, stockTotal, existingRows[0].id]
        );
        updated += 1;
      } else {
        await connection.query(
          `INSERT INTO posventa_productos
           (numero_parte, descripcion, marca, tipo_inventario_id, fecha_ingreso, stock_total, stock_usado, stock_disponible, precio_compra, precio_venta, moneda_id)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [numeroParte, descripcion, marca, tipoId, fechaIngreso, stockTotal, stockTotal, precioCompra, precioVenta, monedaId]
        );
        imported += 1;
      }
    }

    if (errors.length && !imported && !updated) {
      await connection.rollback();
      return NextResponse.json({ message: errors[0], errors }, { status: 400 });
    }

    await connection.commit();
    return NextResponse.json({ imported, updated, errors });
  } catch (error) {
    await connection.rollback();
    console.error("Error importing post inventory products:", error);
    return NextResponse.json({ message: "No se pudo importar productos." }, { status: 500 });
  } finally {
    connection.release();
  }
}
