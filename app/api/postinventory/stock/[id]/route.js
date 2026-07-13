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

export async function PUT(request, { params }) {
  try {
    const allowed = await requireLocationPermission("edit");
    if (allowed.error) return allowed.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const loteId = Number(body.loteId);
    const anaquelId = Number(body.anaquelId);
    const nivelId = body.nivelId ? Number(body.nivelId) : null;
    const posicionId = body.posicionId ? Number(body.posicionId) : null;
    const stock = Number(body.stock || body.cantidad || 0);

    if (!id || !loteId || !anaquelId || Number.isNaN(stock)) {
      return NextResponse.json({ message: "Ubicacion o stock invalido." }, { status: 400 });
    }
    if (!(await userCanAccessShelf(allowed.user.id, anaquelId))) {
      return NextResponse.json({ message: "No tienes asignado el almacen o mostrador de ese anaquel." }, { status: 403 });
    }

    const [previousRows] = await pool.query(`SELECT lote_id, anaquel_id FROM posventa_lotes_ubicaciones WHERE id = ?`, [id]);
    const previousLoteId = previousRows[0]?.lote_id;
    if (!previousLoteId) {
      return NextResponse.json({ message: "Ubicacion no encontrada." }, { status: 404 });
    }
    if (!(await userCanAccessShelf(allowed.user.id, previousRows[0]?.anaquel_id))) {
      return NextResponse.json({ message: "No tienes asignada la ubicacion actual." }, { status: 403 });
    }

    const stockValidation = await validateLotLocationStock(pool, loteId, stock, id);
    if (!stockValidation.ok) {
      return NextResponse.json({ message: stockValidation.message }, { status: 400 });
    }

    await pool.query(
      `UPDATE posventa_lotes_ubicaciones
       SET lote_id = ?, anaquel_id = ?, nivel_id = ?, posicion_id = ?, cantidad = ?
       WHERE id = ?`,
      [loteId, anaquelId, nivelId, posicionId, stock, id]
    );
    await syncProductStockByLot(loteId);
    if (previousLoteId && Number(previousLoteId) !== Number(loteId)) await syncProductStockByLot(previousLoteId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating stock:", error);
    return NextResponse.json({ message: "No se pudo actualizar la ubicacion." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const allowed = await requireLocationPermission("delete");
    if (allowed.error) return allowed.error;

    const { id: rawId } = await params;
    const [rows] = await pool.query(`SELECT lote_id, anaquel_id FROM posventa_lotes_ubicaciones WHERE id = ?`, [Number(rawId)]);
    const loteId = rows[0]?.lote_id;
    if (!loteId) {
      return NextResponse.json({ message: "Ubicacion no encontrada." }, { status: 404 });
    }
    if (!(await userCanAccessShelf(allowed.user.id, rows[0]?.anaquel_id))) {
      return NextResponse.json({ message: "No tienes asignada esa ubicacion." }, { status: 403 });
    }
    await pool.query(`DELETE FROM posventa_lotes_ubicaciones WHERE id = ?`, [Number(rawId)]);
    if (loteId) await syncProductStockByLot(loteId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting stock:", error);
    return NextResponse.json({ message: "No se pudo eliminar la ubicacion." }, { status: 500 });
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
