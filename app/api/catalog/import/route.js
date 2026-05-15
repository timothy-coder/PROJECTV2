import { NextResponse } from "next/server";

import { encodeSpecValue } from "@/app/api/catalog/valueUtils";
import { pool } from "@/lib/db";

function exact(value) {
  return String(value ?? "").trim();
}

function boolValue(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "si", "sí", "yes"].includes(exact(value).toLowerCase());
}

function keyFor(marca, modelo, version) {
  return `${exact(marca)}\u0000${exact(modelo)}\u0000${exact(version)}`;
}

function getRowValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return "";
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const { rows = [] } = await request.json();
    if (!Array.isArray(rows) || !rows.length) {
      return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });
    }

    const [priceRows] = await connection.query(
      `SELECT p.id, p.version, ma.name AS marca, mo.name AS modelo
       FROM ventas_precios p
       INNER JOIN administracion_marcas ma ON ma.id = p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id`
    );
    const prices = new Map();
    const duplicatedPrices = new Set();
    priceRows.forEach((row) => {
      const key = keyFor(row.marca, row.modelo, row.version);
      if (prices.has(key)) duplicatedPrices.add(key);
      prices.set(key, row.id);
    });

    let imported = 0;
    const errors = [];
    await connection.beginTransaction();

    for (const [index, row] of rows.entries()) {
      const marca = exact(getRowValue(row, ["marca", "Marca", "MARCA"]));
      const modelo = exact(getRowValue(row, ["modelo", "Modelo", "MODELO"]));
      const version = exact(getRowValue(row, ["version", "Version", "VERSION", "versión", "Versión"]));
      const priceKey = keyFor(marca, modelo, version);
      const precioId = prices.get(priceKey);
      const grupo = exact(getRowValue(row, ["grupo", "Grupo", "GRUPO", "nombre_grupo", "nombreGrupo"]));
      const clave = exact(getRowValue(row, ["clave", "Clave", "CLAVE"]));
      const valorTipo = exact(getRowValue(row, ["tipo_valor", "tipoValor", "tipo", "Tipo"])).toUpperCase() || "TEXTO";
      const valorTexto = exact(getRowValue(row, ["valor", "Valor", "VALOR", "texto", "Texto"]));
      const valorUrl = exact(getRowValue(row, ["url", "URL", "link", "Link"]));
      const valorPath = exact(getRowValue(row, ["archivo", "Archivo", "path", "Path", "ruta", "Ruta"]));
      const valor = encodeSpecValue({ valorTipo, valor: valorTexto, valorUrl, valorPath });
      const ordenGrupo = Number(row.orden_grupo ?? row.ordenGrupo ?? 0);
      const ordenItem = Number(row.orden_item ?? row.ordenItem ?? 0);
      const grupoActivo = boolValue(row.grupo_activo ?? row.grupoActivo, true);
      const itemActivo = boolValue(row.item_activo ?? row.itemActivo, true);

      if (!marca || !modelo || !version || !grupo || !clave) {
        errors.push(`Fila ${index + 2}: marca/modelo/version/grupo/clave son obligatorios.`);
        continue;
      }
      if (duplicatedPrices.has(priceKey)) {
        errors.push(`Fila ${index + 2}: existe mas de un precio con marca "${marca}", modelo "${modelo}" y version "${version}".`);
        continue;
      }
      if (!precioId) {
        errors.push(`Fila ${index + 2}: no se encontro exactamente "${marca}" / "${modelo}" / "${version}".`);
        continue;
      }

      await connection.query(
        `INSERT INTO ventas_precio_specs_group (precio_id, nombre, orden, is_active)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE orden=VALUES(orden), is_active=VALUES(is_active)`,
        [precioId, grupo, ordenGrupo, grupoActivo ? 1 : 0]
      );
      const [[groupRow]] = await connection.query(
        `SELECT id FROM ventas_precio_specs_group WHERE precio_id=? AND nombre=?`,
        [precioId, grupo]
      );
      await connection.query(
        `INSERT INTO ventas_precio_specs_item (group_id, clave, valor, orden, is_active)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE valor=VALUES(valor), orden=VALUES(orden), is_active=VALUES(is_active)`,
        [groupRow.id, clave, valor, ordenItem, itemActivo ? 1 : 0]
      );
      imported += 1;
    }

    if (!imported) {
      await connection.rollback();
      return NextResponse.json({ message: errors[0] || "No se pudo importar.", errors }, { status: 400 });
    }
    await connection.commit();
    return NextResponse.json({ ok: true, imported, errors });
  } catch (error) {
    await connection.rollback();
    console.error("Error importing catalog specs:", error);
    return NextResponse.json({ message: "No se pudo importar catalogo." }, { status: 500 });
  } finally {
    connection.release();
  }
}
