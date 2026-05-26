import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { hasPerm } from "@/lib/permissions";

function canEdit(user) {
  return Boolean(hasPerm(user?.permissions || {}, ["oportunidades", "edit"]) || hasPerm(user?.permissions || {}, ["cotizacion", "edit"]));
}

function discountValues(subtotal, type, value) {
  const discount = Math.max(Number(value || 0), 0);
  const porcentaje = type === "percentage" ? discount : null;
  const monto = type === "amount" ? discount : 0;
  const total = Math.max(subtotal - monto - (porcentaje ? subtotal * porcentaje / 100 : 0), 0);
  return { porcentaje, monto, total };
}

export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  if (!canEdit(user)) return NextResponse.json({ message: "No tienes permiso para modificar cotizaciones." }, { status: 403 });

  const { id: rawId } = await params;
  const cotizacionId = Number(rawId);
  const body = await request.json();
  const connection = await pool.getConnection();

  try {
    const [[quote]] = await connection.query(`SELECT id FROM ventas_cotizaciones WHERE id=? LIMIT 1`, [cotizacionId]);
    if (!quote) return NextResponse.json({ message: "Cotizacion no encontrada." }, { status: 404 });

    if (body.type === "vehicle") {
      const { porcentaje, monto } = discountValues(0, body.discountType, body.discountValue);
      await connection.query(
        `UPDATE ventas_cotizaciones SET \`descuento_vehículo\`=?, \`descuento_vehículo_porcentaje\`=? WHERE id=?`,
        [monto, porcentaje || 0, cotizacionId]
      );
      return NextResponse.json({ ok: true });
    }

    if (body.type === "vehicle-pricing") {
      const precioBase = body.precioBase !== undefined && body.precioBase !== "" ? Number(body.precioBase) : null;
      const tcReferencial = body.tcReferencial !== undefined && body.tcReferencial !== "" ? Number(body.tcReferencial) : null;
      const diasValidez = body.diasValidez !== undefined && body.diasValidez !== "" ? String(body.diasValidez).trim() : null;
      const precioTramite = body.precioTramite !== undefined && body.precioTramite !== "" ? Number(body.precioTramite) : 0;
      const observaciones = String(body.observaciones || "").trim() || null;
      const otrosProductos = String(body.otrosProductos || "").trim() || null;
      if (precioBase === null || Number.isNaN(precioBase) || precioBase < 0) {
        return NextResponse.json({ message: "Precio base invalido." }, { status: 400 });
      }
      if (tcReferencial !== null && (Number.isNaN(tcReferencial) || tcReferencial < 0)) {
        return NextResponse.json({ message: "Tipo de cambio invalido." }, { status: 400 });
      }
      if (Number.isNaN(precioTramite) || precioTramite < 0) {
        return NextResponse.json({ message: "Precio de tramite invalido." }, { status: 400 });
      }
      await connection.query(
        `UPDATE ventas_cotizaciones SET precio_base=?, tc_referencial=?, sku=?, observaciones=?, otros_productos=?, precio_tramite=? WHERE id=?`,
        [precioBase, tcReferencial, diasValidez, observaciones, otrosProductos, precioTramite, cotizacionId]
      );
      return NextResponse.json({ ok: true });
    }

    if (body.type === "vehicle-colors") {
      await connection.query(
        `UPDATE ventas_cotizaciones SET color_externo=?, color_interno=? WHERE id=?`,
        [String(body.colorExterno || "").trim() || null, String(body.colorInterno || "").trim() || null, cotizacionId]
      );
      return NextResponse.json({ ok: true });
    }

    if (body.mode === "delete") {
      const table = body.type === "gift" ? "ventas_cotizaciones_regalos" : "ventas_cotizaciones_accesorios";
      await connection.query(`DELETE FROM ${table} WHERE id=? AND cotizacion_id=?`, [Number(body.itemId), cotizacionId]);
      return NextResponse.json({ ok: true });
    }

    const isGift = body.type === "gift";
    const catalogId = Number(body.catalogId);
    const cantidad = Math.max(Number(body.cantidad || 1), 1);
    const [[catalog]] = isGift
      ? await connection.query(`SELECT id, precio_compra, precio_venta, moneda_id FROM ventas_regalos_disponibles WHERE id=?`, [catalogId])
      : await connection.query(`SELECT id, precio, precio_venta, moneda_id FROM ventas_accesorios_disponibles WHERE id=?`, [catalogId]);

    if (!catalog) return NextResponse.json({ message: isGift ? "Regalo no encontrado." : "Accesorio no encontrado." }, { status: 404 });

    const unit = Number(isGift ? (catalog.precio_venta ?? catalog.precio_compra ?? 0) : (catalog.precio_venta ?? catalog.precio ?? 0));
    const subtotal = unit * cantidad;
    const { porcentaje, monto, total } = discountValues(subtotal, body.discountType, body.discountValue);
    const notas = body.notas || null;

    if (body.mode === "update") {
      const table = isGift ? "ventas_cotizaciones_regalos" : "ventas_cotizaciones_accesorios";
      const fk = isGift ? "regalo_id" : "accesorio_id";
      await connection.query(
        `UPDATE ${table}
         SET ${fk}=?, cantidad=?, precio_unitario=?, moneda_id=?, subtotal=?, descuento_porcentaje=?, descuento_monto=?, total=?, notas=?
         WHERE id=? AND cotizacion_id=?`,
        [catalog.id, cantidad, unit, catalog.moneda_id, subtotal, porcentaje, monto, total, notas, Number(body.itemId), cotizacionId]
      );
      return NextResponse.json({ ok: true });
    }

    if (isGift) {
      await connection.query(
        `INSERT INTO ventas_cotizaciones_regalos (cotizacion_id, regalo_id, cantidad, precio_unitario, moneda_id, subtotal, descuento_porcentaje, descuento_monto, total, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cotizacionId, catalog.id, cantidad, unit, catalog.moneda_id, subtotal, porcentaje, monto, total, notas]
      );
    } else {
      await connection.query(
        `INSERT INTO ventas_cotizaciones_accesorios (cotizacion_id, accesorio_id, cantidad, precio_unitario, moneda_id, subtotal, descuento_porcentaje, descuento_monto, total, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cotizacionId, catalog.id, cantidad, unit, catalog.moneda_id, subtotal, porcentaje, monto, total, notas]
      );
    }

    return NextResponse.json({ ok: true });
  } finally {
    connection.release();
  }
}
