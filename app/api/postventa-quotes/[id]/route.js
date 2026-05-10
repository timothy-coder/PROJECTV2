import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function canSeeAll(user) {
  return Boolean(hasPerm(user?.permissions, ["cotizacion", "viewall"]));
}

function moneyNumber(value) {
  return Number(Number(value || 0).toFixed(2));
}

function calculate(payload) {
  const products = Array.isArray(payload.products) ? payload.products : [];
  const extras = Array.isArray(payload.extras) ? payload.extras : [];
  const subtotalProductos = products.reduce((sum, item) => {
    const subtotal = Number(item.precioUnitario || 0) * Number(item.cantidad || 1);
    return sum + Math.max(subtotal - subtotal * Number(item.descuentoPorcentaje || 0) / 100, 0);
  }, 0);
  const subtotalManoObra = Number(payload.horasTrabajo || 0) * Number(payload.tarifaHora || 0);
  const subtotalExtras = extras.reduce((sum, item) => {
    const monto = Number(item.monto || 0);
    const discount = item.descuentoTipo === "monto" ? Number(item.descuentoValor || 0) : monto * Number(item.descuentoValor || 0) / 100;
    return sum + Math.max(monto - discount, 0);
  }, 0);
  const base = subtotalProductos + subtotalManoObra + subtotalExtras;
  const discount = Number(payload.descuentoMonto || 0) + base * Number(payload.descuentoPorcentaje || 0) / 100;
  const taxable = Math.max(base - discount, 0);
  const tax = payload.incluirIgv ? taxable * Number(payload.impuestoPorcentaje || 0) / 100 : 0;
  return {
    subtotalProductos: moneyNumber(subtotalProductos),
    subtotalManoObra: moneyNumber(subtotalManoObra),
    subtotalExtras: moneyNumber(subtotalExtras),
    total: moneyNumber(taxable + tax),
  };
}

async function loadQuote(connection, id, user, allowPublic = false) {
  const viewAll = user ? canSeeAll(user) : false;
  const [[quote]] = await connection.query(
    `SELECT q.*, CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente,
            u.fullname AS creado_por, m.codigo AS moneda_codigo, m.simbolo AS moneda_simbolo,
            i.nombre AS impuesto_nombre, t.nombre AS tarifa_nombre
     FROM posventa_cotizaciones q
     LEFT JOIN administracion_clientes c ON c.id=q.cliente_id
     LEFT JOIN administracion_usuarios u ON u.id=q.usuario_id
     LEFT JOIN configuracion_monedas m ON m.id=q.moneda_id
     LEFT JOIN configuracion_impuestos i ON i.id=q.impuesto_id
     LEFT JOIN configuracion_tarifas t ON t.id=q.tarifa_id
     WHERE q.id=? ${allowPublic || viewAll ? "" : "AND q.usuario_id=?"}
     LIMIT 1`,
    allowPublic || viewAll ? [id] : [id, user.id]
  );
  if (!quote) return null;
  const [products] = await connection.query(
    `SELECT cp.*, p.numero_parte, p.descripcion
     FROM posventa_cotizacion_productos cp
     INNER JOIN posventa_productos p ON p.id=cp.producto_id
     WHERE cp.cotizacion_id=?
     ORDER BY cp.id ASC`,
    [id]
  );
  const [extras] = await connection.query(`SELECT * FROM posventa_cotizacion_extras WHERE cotizacion_id=? ORDER BY id ASC`, [id]);
  const [views] = await connection.query(`SELECT * FROM posventa_cotizaciones_views WHERE cotizacion_id=? ORDER BY viewed_at DESC`, [id]);
  return {
    id: quote.id,
    tipo: quote.tipo,
    clienteId: quote.cliente_id,
    cliente: String(quote.cliente || "").trim() || "-",
    usuarioId: quote.usuario_id,
    creadoPor: quote.creado_por || "-",
    centroId: quote.centro_id,
    tallerId: quote.taller_id,
    mostradorId: quote.mostrador_id,
    descripcion: quote.descripcion || "",
    subtotalProductos: Number(quote.subtotal_productos || 0),
    subtotalManoObra: Number(quote.subtotal_mano_obra || 0),
    subtotalExtras: Number(quote.subtotal_extras || 0),
    descuentoPorcentaje: Number(quote.descuento_porcentaje || 0),
    descuentoMonto: Number(quote.descuento_monto || 0),
    total: Number(quote.monto_total || 0),
    horasTrabajo: Number(quote.horas_trabajo || 0),
    tarifaId: quote.tarifa_id,
    tarifaNombre: quote.tarifa_nombre || "",
    tarifaHora: Number(quote.tarifa_hora || 0),
    monedaId: quote.moneda_id,
    monedaCodigo: quote.moneda_codigo || "",
    monedaSimbolo: quote.moneda_simbolo || "",
    impuestoId: quote.impuesto_id,
    impuestoNombre: quote.impuesto_nombre || "",
    incluirIgv: Boolean(quote.incluir_igv),
    impuestoPorcentaje: Number(quote.impuesto_porcentaje || 0),
    estado: quote.estado || "pendiente",
    createdAt: quote.created_at,
    publicToken: quote.public_token || "",
    products: products.map((row) => ({
      id: row.id,
      productoId: row.producto_id,
      numeroParte: row.numero_parte,
      descripcion: row.descripcion,
      cantidad: Number(row.cantidad || 0),
      precioUnitario: Number(row.precio_unitario || 0),
      subtotal: Number(row.subtotal || 0),
      descuentoPorcentaje: Number(row.descuento_porcentaje || 0),
    })),
    extras: extras.map((row) => ({
      id: row.id,
      descripcion: row.descripcion,
      monto: Number(row.monto || 0),
      descuentoTipo: row.descuento_tipo,
      descuentoValor: Number(row.descuento_valor || 0),
    })),
    views: views.map((row) => ({ id: row.id, ipAddress: row.ip_address || "", userAgent: row.user_agent || "", viewedAt: row.viewed_at })),
  };
}

export async function GET(_request, { params }) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (!hasPerm(user.permissions, ["cotizacion", "view"])) return NextResponse.json({ message: "No tienes permiso." }, { status: 403 });
    const { id } = await params;
    const quote = await loadQuote(connection, Number(id), user);
    if (!quote) return NextResponse.json({ message: "Cotizacion no encontrada." }, { status: 404 });
    return NextResponse.json({ quote, currentUser: { id: user.id, name: user.fullname, canViewAll: canSeeAll(user) } });
  } catch (error) {
    console.error("Error loading postventa quote:", error);
    return NextResponse.json({ message: "No se pudo cargar la cotizacion." }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function PUT(request, { params }) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const { id } = await params;
    const quoteId = Number(id);
    const body = await request.json();
    const [[owned]] = await connection.query(`SELECT usuario_id, public_token FROM posventa_cotizaciones WHERE id=? LIMIT 1`, [quoteId]);
    if (!owned || (!canSeeAll(user) && Number(owned.usuario_id) !== Number(user.id))) return NextResponse.json({ message: "Cotizacion no encontrada." }, { status: 404 });

    if (body.action === "status") {
      if (!hasPerm(user.permissions, ["cotizacion", "status"])) return NextResponse.json({ message: "No tienes permiso para cambiar estado." }, { status: 403 });
      const allowedStatuses = new Set(["pendiente", "aprobada", "rechazada"]);
      const nextStatus = String(body.estado || "").toLowerCase();
      if (!allowedStatuses.has(nextStatus)) return NextResponse.json({ message: "Estado invalido." }, { status: 400 });
      await connection.query(`UPDATE posventa_cotizaciones SET estado=? WHERE id=?`, [nextStatus, quoteId]);
      return NextResponse.json({ ok: true, estado: nextStatus });
    }

    if (!hasPerm(user.permissions, ["cotizacion", "edit"])) return NextResponse.json({ message: "No tienes permiso para editar." }, { status: 403 });

    if (body.action === "public-token") {
      const token = owned.public_token || crypto.randomBytes(24).toString("hex");
      await connection.query(`UPDATE posventa_cotizaciones SET public_token=? WHERE id=?`, [token, quoteId]);
      return NextResponse.json({ ok: true, token });
    }

    const calc = calculate(body);
    await connection.beginTransaction();
    await connection.query(
      `UPDATE posventa_cotizaciones
       SET cliente_id=?, centro_id=?, taller_id=?, mostrador_id=?, descripcion=?,
           subtotal_productos=?, subtotal_mano_obra=?, subtotal_extras=?, descuento_porcentaje=?, descuento_monto=?,
           monto_total=?, horas_trabajo=?, tarifa_id=?, tarifa_hora=?, moneda_id=?, impuesto_id=?, incluir_igv=?, impuesto_porcentaje=?, estado=?
       WHERE id=?`,
      [
        body.clienteId || null, body.centroId || null, body.tallerId || null, body.mostradorId || null, body.descripcion || null,
        calc.subtotalProductos, calc.subtotalManoObra, calc.subtotalExtras, body.descuentoPorcentaje || 0, body.descuentoMonto || 0,
        calc.total, body.horasTrabajo || 0, body.tarifaId || null, body.tarifaHora || 0, body.monedaId || null, body.impuestoId || null,
        body.incluirIgv ? 1 : 0, body.impuestoPorcentaje || 0, body.estado || "pendiente", quoteId,
      ]
    );
    await connection.query(`DELETE FROM posventa_cotizacion_productos WHERE cotizacion_id=?`, [quoteId]);
    await connection.query(`DELETE FROM posventa_cotizacion_extras WHERE cotizacion_id=?`, [quoteId]);
    const products = Array.isArray(body.products) ? body.products : [];
    if (products.length) {
      await connection.query(
        `INSERT INTO posventa_cotizacion_productos (cotizacion_id, producto_id, cantidad, precio_unitario, subtotal, descuento_porcentaje)
         VALUES ${products.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}`,
        products.flatMap((item) => {
          const subtotal = Number(item.precioUnitario || 0) * Number(item.cantidad || 1);
          return [quoteId, item.productoId, item.cantidad || 1, item.precioUnitario || 0, subtotal, item.descuentoPorcentaje || 0];
        })
      );
    }
    const extras = Array.isArray(body.extras) ? body.extras.filter((item) => item.descripcion && Number(item.monto || 0) > 0) : [];
    if (extras.length) {
      await connection.query(
        `INSERT INTO posventa_cotizacion_extras (cotizacion_id, descripcion, monto, descuento_tipo, descuento_valor)
         VALUES ${extras.map(() => "(?, ?, ?, ?, ?)").join(", ")}`,
        extras.flatMap((item) => [quoteId, item.descripcion, item.monto || 0, item.descuentoTipo || "porcentaje", item.descuentoValor || 0])
      );
    }
    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating postventa quote:", error);
    return NextResponse.json({ message: "No se pudo guardar la cotizacion." }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function DELETE(_request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (!hasPerm(user.permissions, ["cotizacion", "delete"])) return NextResponse.json({ message: "No tienes permiso para eliminar." }, { status: 403 });
    const { id } = await params;
    await pool.query(`DELETE FROM posventa_cotizaciones WHERE id=? ${canSeeAll(user) ? "" : "AND usuario_id=?"}`, canSeeAll(user) ? [Number(id)] : [Number(id), user.id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting postventa quote:", error);
    return NextResponse.json({ message: "No se pudo eliminar la cotizacion." }, { status: 500 });
  }
}
