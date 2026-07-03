import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { validateLotLocationStock } from "@/lib/postinventoryLotStock";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

async function requireLocationPermission(action) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (!hasPerm(user.permissions || {}, ["ubicacion_inventario", action])) {
    return { error: NextResponse.json({ message: "No tienes permiso para ubicaciones de inventario." }, { status: 403 }) };
  }
  return { user };
}

export async function POST(request) {
  try {
    const allowed = await requireLocationPermission("create");
    if (allowed.error) return allowed.error;

    const body = await request.json();
    const loteId = Number(body.loteId);
    const anaquelId = Number(body.anaquelId);
    const nivelId = body.nivelId ? Number(body.nivelId) : null;
    const posicionId = body.posicionId ? Number(body.posicionId) : null;
    const stock = Number(body.stock || body.cantidad || 0);

    if (!loteId || !anaquelId || Number.isNaN(stock)) {
      return NextResponse.json({ message: "Ubicacion o stock invalido." }, { status: 400 });
    }

    const stockValidation = await validateLotLocationStock(pool, loteId, stock);
    if (!stockValidation.ok) {
      return NextResponse.json({ message: stockValidation.message }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO posventa_lotes_ubicaciones (lote_id, anaquel_id, nivel_id, posicion_id, cantidad)
       VALUES (?, ?, ?, ?, ?)`,
      [loteId, anaquelId, nivelId, posicionId, stock]
    );
    await syncProductStockByLot(loteId);

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating stock:", error);
    return NextResponse.json({ message: "No se pudo crear la ubicacion." }, { status: 500 });
  }
}

async function syncProductStockByLot(loteId) {
  const [lotRows] = await pool.query(`SELECT producto_id FROM posventa_productos_lotes WHERE id = ?`, [loteId]);
  const productoId = lotRows[0]?.producto_id;
  if (!productoId) return;
  const [sumRows] = await pool.query(
    `SELECT COALESCE(SUM(u.cantidad), 0) AS usado
     FROM posventa_lotes_ubicaciones u
     INNER JOIN posventa_productos_lotes l ON l.id = u.lote_id
     WHERE l.producto_id = ?`,
    [productoId]
  );
  const [productRows] = await pool.query(
    `SELECT stock_total FROM posventa_productos WHERE id = ?`,
    [productoId]
  );
  const usado = Number(sumRows[0]?.usado || 0);
  const total = Number(productRows[0]?.stock_total || 0);
  await pool.query(
    `UPDATE posventa_productos SET stock_usado = ?, stock_disponible = ? WHERE id = ?`,
    [usado, Math.max(total - usado, 0), productoId]
  );
}
