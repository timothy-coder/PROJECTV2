import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { buildPointOfSaleQuoteScope, canViewPointOfSaleModule } from "@/lib/pointOfSaleScope";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

const VALID_STATES = new Set(["cotizacion", "vendida", "anticipo", "cancelada"]);

function mapQuote(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    puntoVentaId: row.punto_venta_id,
    puntoVentaCodigo: row.punto_venta_codigo || "",
    clienteId: row.cliente_id,
    clienteNombre: row.cliente_nombre || "",
    clienteRazonSocial: row.cliente_razon_social || "",
    clienteCelular: row.cliente_celular || "",
    clienteEmail: row.cliente_email || "",
    clienteDocumento: row.cliente_documento || "",
    subtotalSinIgv: Number(row.subtotal_sin_igv || 0),
    igvMonto: Number(row.igv_monto || 0),
    descuentoProductos: Number(row.descuento_productos || 0),
    descuentoTotalTipo: row.descuento_total_tipo || "monto",
    descuentoTotalValor: Number(row.descuento_total_valor || 0),
    descuentoTotalMonto: Number(row.descuento_total_monto || 0),
    total: Number(row.total || 0),
    estado: row.estado || "cotizacion",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row) {
  return {
    id: row.id,
    cotizacionId: row.cotizacion_id,
    productoId: row.producto_id,
    comboId: row.combo_id,
    loteId: row.lote_id,
    ubicacionId: row.ubicacion_id,
    numeroParte: row.numero_parte || "",
    descripcion: row.descripcion || "",
    marca: row.marca || "",
    tipoLogistico: row.tipo_logistico || "",
    cantidad: Number(row.cantidad || 0),
    precioUnitario: Number(row.precio_unitario || 0),
    precioCompra: Number(row.precio_compra || 0),
    descuentoTipo: row.descuento_tipo || "monto",
    descuentoValor: Number(row.descuento_valor || 0),
    descuentoMonto: Number(row.descuento_monto || 0),
    subtotal: Number(row.subtotal || 0),
    total: Number(row.total || 0),
    createdAt: row.created_at,
  };
}

async function requirePointOfSale(action = "view") {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  const permissions = user.permissions || {};
  const allowed =
    hasPerm(permissions, ["puntoventa_cotizaciones", action]) ||
    (action === "view" && canViewPointOfSaleModule(user, "puntoventa_cotizaciones"));
  if (!allowed) {
    return { error: NextResponse.json({ message: "No tienes permiso para Punto de Venta." }, { status: 403 }) };
  }
  return { user };
}

async function paramsId(params) {
  const resolvedParams = await params;
  return Number(resolvedParams?.id || 0);
}

export async function GET(_request, { params }) {
  try {
    const allowed = await requirePointOfSale("view");
    if (allowed.error) return allowed.error;

    const id = await paramsId(params);
    if (!id) return NextResponse.json({ message: "Cotizacion invalida." }, { status: 400 });

    const scope = buildPointOfSaleQuoteScope(allowed.user, { moduleKey: "puntoventa_cotizaciones", quoteAlias: "q" });
    const [quotes] = await pool.query(
      `SELECT q.*, pv.codigo AS punto_venta_codigo
       FROM posventa_punto_venta_cotizaciones q
       LEFT JOIN configuracion_puntos_venta pv ON pv.id = q.punto_venta_id
       WHERE q.id = ? ${scope.where ? `AND ${scope.where}` : ""}
       LIMIT 1`,
      [id, ...scope.params]
    );

    if (!quotes.length) return NextResponse.json({ message: "Cotizacion no encontrada." }, { status: 404 });

    const [items] = await pool.query(
      `SELECT *
       FROM posventa_punto_venta_cotizacion_items
       WHERE cotizacion_id = ?
       ORDER BY id ASC`,
      [id]
    );

    return NextResponse.json({ item: { ...mapQuote(quotes[0]), items: items.map(mapItem) } });
  } catch (error) {
    console.error("Error loading point of sale quote:", error);
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ message: "Falta crear las tablas de cotizaciones de punto de venta." }, { status: 500 });
    }
    return NextResponse.json({ message: "No se pudo cargar la cotizacion de punto de venta." }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const allowed = await requirePointOfSale("edit");
    if (allowed.error) return allowed.error;

    const id = await paramsId(params);
    if (!id) return NextResponse.json({ message: "Cotizacion invalida." }, { status: 400 });

    const body = await request.json();
    const estado = String(body.estado || "").trim();
    if (!VALID_STATES.has(estado)) {
      return NextResponse.json({ message: "Estado invalido." }, { status: 400 });
    }

    const scope = buildPointOfSaleQuoteScope(allowed.user, { moduleKey: "puntoventa_cotizaciones", quoteAlias: "q" });
    const [result] = await pool.query(
      `UPDATE posventa_punto_venta_cotizaciones q
       SET estado = ?
       WHERE q.id = ? ${scope.where ? `AND ${scope.where}` : ""}`,
      [estado, id, ...scope.params]
    );

    if (!result.affectedRows) return NextResponse.json({ message: "Cotizacion no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating point of sale quote:", error);
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ message: "Falta crear las tablas de cotizaciones de punto de venta." }, { status: 500 });
    }
    return NextResponse.json({ message: "No se pudo actualizar la cotizacion." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const allowed = await requirePointOfSale("delete");
    if (allowed.error) return allowed.error;

    const id = await paramsId(params);
    if (!id) return NextResponse.json({ message: "Cotizacion invalida." }, { status: 400 });

    const scope = buildPointOfSaleQuoteScope(allowed.user, { moduleKey: "puntoventa_cotizaciones", quoteAlias: "q" });
    const [result] = await pool.query(
      `DELETE q FROM posventa_punto_venta_cotizaciones q
       WHERE q.id = ? ${scope.where ? `AND ${scope.where}` : ""}`,
      [id, ...scope.params]
    );

    if (!result.affectedRows) return NextResponse.json({ message: "Cotizacion no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting point of sale quote:", error);
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ message: "Falta crear las tablas de cotizaciones de punto de venta." }, { status: 500 });
    }
    return NextResponse.json({ message: "No se pudo eliminar la cotizacion." }, { status: 500 });
  }
}
