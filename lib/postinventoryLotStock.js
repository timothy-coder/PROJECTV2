const LOT_TOTAL_COLUMNS = [
  "stock_total",
  "cantidad_total",
  "cantidad_inicial",
  "cantidad",
  "stock",
];

let cachedLotTotalColumn;

async function getLotTotalColumn(db) {
  if (cachedLotTotalColumn !== undefined) return cachedLotTotalColumn;

  const placeholders = LOT_TOTAL_COLUMNS.map(() => "?").join(", ");
  const [rows] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'posventa_productos_lotes'
       AND COLUMN_NAME IN (${placeholders})`,
    LOT_TOTAL_COLUMNS
  );
  const available = new Set(rows.map((row) => row.COLUMN_NAME));
  cachedLotTotalColumn = LOT_TOTAL_COLUMNS.find((column) => available.has(column)) || null;
  return cachedLotTotalColumn;
}

async function getLotTotal(db, loteId) {
  const lotTotalColumn = await getLotTotalColumn(db);
  if (lotTotalColumn) {
    const [rows] = await db.query(
      `SELECT \`${lotTotalColumn}\` AS total
       FROM posventa_productos_lotes
       WHERE id = ?
       LIMIT 1`,
      [loteId]
    );
    return {
      scope: "lote",
      total: Number(rows[0]?.total || 0),
    };
  }

  const [rows] = await db.query(
    `SELECT p.stock_total AS total
     FROM posventa_productos_lotes l
     INNER JOIN posventa_productos p ON p.id = l.producto_id
     WHERE l.id = ?
     LIMIT 1`,
    [loteId]
  );
  return {
    scope: "producto",
    total: Number(rows[0]?.total || 0),
  };
}

async function getAssignedQuantity(db, loteId, scope, excludeLocationId) {
  const params = [loteId];
  const excludeClause = excludeLocationId ? " AND u.id <> ?" : "";
  if (excludeLocationId) params.push(excludeLocationId);

  if (scope === "producto") {
    const [rows] = await db.query(
      `SELECT COALESCE(SUM(u.cantidad), 0) AS assigned
       FROM posventa_lotes_ubicaciones u
       INNER JOIN posventa_productos_lotes current_lot ON current_lot.id = ?
       INNER JOIN posventa_productos_lotes located_lot ON located_lot.id = u.lote_id
       WHERE located_lot.producto_id = current_lot.producto_id${excludeClause}`,
      params
    );
    return Number(rows[0]?.assigned || 0);
  }

  const [rows] = await db.query(
    `SELECT COALESCE(SUM(u.cantidad), 0) AS assigned
     FROM posventa_lotes_ubicaciones u
     WHERE u.lote_id = ?${excludeClause}`,
    params
  );
  return Number(rows[0]?.assigned || 0);
}

export async function validateLotLocationStock(db, loteId, quantity, excludeLocationId = null) {
  const nextQuantity = Number(quantity || 0);
  if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
    return { ok: false, message: "La cantidad debe ser mayor o igual a cero." };
  }

  const { scope, total } = await getLotTotal(db, loteId);
  const assigned = await getAssignedQuantity(db, loteId, scope, excludeLocationId);
  const available = Math.max(total - assigned, 0);

  if (nextQuantity > available) {
    const label = scope === "lote" ? "lote" : "producto";
    return {
      ok: false,
      message: `La cantidad supera el stock total del ${label}. Total: ${total}, ya ubicado: ${assigned}, disponible: ${available}.`,
    };
  }

  return { ok: true };
}
