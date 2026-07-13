import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { validateLotLocationStock } from "@/lib/postinventoryLotStock";
import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { userCanAccessShelf } from "@/lib/warehouseLocationAccess";

async function requireLocationPermission(action) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["ubicacion_inventario", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para ubicaciones de inventario." }, { status: 403 }) };
  }
  return { user };
}

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
    `SELECT COALESCE(SUM(u.cantidad), 0) AS usado
     FROM posventa_lotes_ubicaciones u
     INNER JOIN posventa_productos_lotes l ON l.id = u.lote_id
     WHERE l.producto_id = ?`,
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
    const allowed = await requireLocationPermission("import");
    if (allowed.error) return allowed.error;

    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) {
      return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });
    }

    const [lotRows] = await connection.query(
      `SELECT l.id, l.producto_id, p.numero_parte
       FROM posventa_productos_lotes l
       INNER JOIN posventa_productos p ON p.id = l.producto_id`
    );
    const [shelfRows] = await connection.query(`SELECT id, codigo FROM almacen_anaqueles`);
    const [levelRows] = await connection.query(`SELECT id, anaquel_id, codigo_nivel FROM almacen_anaquel_niveles`);
    const [positionRows] = await connection.query(`SELECT id, nivel_id, posicion FROM almacen_nivel_posiciones`);
    const lotMap = buildMap(lotRows, ["id"]);
    const shelfMap = buildMap(shelfRows, ["codigo"]);
    const levelMap = buildMap(levelRows, ["codigo_nivel"]);
    const positionMap = buildMap(positionRows, ["posicion"]);
    const productByLot = new Map(lotRows.map((row) => [Number(row.id), row.producto_id]));

    let imported = 0;
    const touchedProducts = new Set();
    const errors = [];

    await connection.beginTransaction();
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const lotRaw = cleanText(value(row, ["lote_id", "Lote ID", "lote", "Lote"]));
      const shelfRaw = cleanText(value(row, ["anaquel_id", "Anaquel ID", "anaquel", "Anaquel"]));
      const levelRaw = cleanText(value(row, ["nivel_id", "Nivel ID", "nivel", "Nivel"]));
      const positionRaw = cleanText(value(row, ["posicion_id", "Posicion ID", "posicion", "Posicion"]));
      const stock = numberValue(value(row, ["cantidad", "Cantidad", "stock", "Stock"]));

      const loteId = lotMap.get(lotRaw) || lotMap.get(lotRaw.toLowerCase());
      const anaquelId = shelfMap.get(shelfRaw) || shelfMap.get(shelfRaw.toLowerCase());
      const nivelId = levelRaw ? levelMap.get(levelRaw) || levelMap.get(levelRaw.toLowerCase()) || null : null;
      const posicionId = positionRaw ? positionMap.get(positionRaw) || positionMap.get(positionRaw.toLowerCase()) || null : null;

      if (!loteId || !anaquelId || Number.isNaN(stock)) {
        errors.push(`Fila ${index + 2}: lote, anaquel y cantidad son obligatorios.`);
        continue;
      }
      if (!(await userCanAccessShelf(allowed.user.id, anaquelId))) {
        errors.push(`Fila ${index + 2}: no tienes asignado el almacen o mostrador de ese anaquel.`);
        continue;
      }

      const stockValidation = await validateLotLocationStock(connection, loteId, stock);
      if (!stockValidation.ok) {
        errors.push(`Fila ${index + 2}: ${stockValidation.message}`);
        continue;
      }

      await connection.query(
        `INSERT INTO posventa_lotes_ubicaciones (lote_id, anaquel_id, nivel_id, posicion_id, cantidad)
         VALUES (?, ?, ?, ?, ?)`,
        [loteId, anaquelId, nivelId, posicionId, stock]
      );
      if (productByLot.get(Number(loteId))) touchedProducts.add(productByLot.get(Number(loteId)));
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
