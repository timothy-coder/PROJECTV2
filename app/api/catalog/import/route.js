import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function boolValue(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "si", "sí", "yes"].includes(norm(value));
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const { rows = [] } = await request.json();
    if (!Array.isArray(rows) || !rows.length) return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });
    const [priceRows] = await connection.query(
      `SELECT p.id, p.version, ma.name AS marca, mo.name AS modelo
       FROM ventas_precios p
       INNER JOIN administracion_marcas ma ON ma.id = p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id`
    );
    const prices = new Map(priceRows.map((row) => [`${norm(row.marca)}:${norm(row.modelo)}:${norm(row.version)}`, row.id]));
    let imported = 0;
    const errors = [];
    await connection.beginTransaction();
    for (const [index, row] of rows.entries()) {
      const precioId = Number(row.precio_id || row.precioId) || prices.get(`${norm(row.marca || row.marcaName)}:${norm(row.modelo || row.modeloName)}:${norm(row.version)}`);
      const grupo = String(row.grupo || row.group || row.nombre_grupo || row.nombreGrupo || "").trim();
      const clave = String(row.clave || "").trim();
      const valor = String(row.valor || "").trim();
      const ordenGrupo = Number(row.orden_grupo ?? row.ordenGrupo ?? 0);
      const ordenItem = Number(row.orden_item ?? row.ordenItem ?? 0);
      const grupoActivo = boolValue(row.grupo_activo ?? row.grupoActivo, true);
      const itemActivo = boolValue(row.item_activo ?? row.itemActivo, true);
      if (!precioId || !grupo || !clave) {
        errors.push(`Fila ${index + 2}: precio/grupo/clave invalido.`);
        continue;
      }
      await connection.query(
        `INSERT INTO ventas_precio_specs_group (precio_id, nombre, orden, is_active)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE orden=VALUES(orden), is_active=VALUES(is_active)`,
        [precioId, grupo, ordenGrupo, grupoActivo ? 1 : 0]
      );
      const [[groupRow]] = await connection.query(`SELECT id FROM ventas_precio_specs_group WHERE precio_id=? AND nombre=?`, [precioId, grupo]);
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
      return NextResponse.json({ message: errors[0] || "No se pudo importar." }, { status: 400 });
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
