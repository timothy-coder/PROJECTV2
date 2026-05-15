import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function canSeeAll(user) {
  return Boolean(hasPerm(user?.permissions, ["cotizacion", "viewall"]));
}

function normalizeTipo(value) {
  return value === "pyp" ? "pyp" : "taller";
}

function moneyNumber(value) {
  return Number(Number(value || 0).toFixed(2));
}

function calculate(payload) {
  const products = Array.isArray(payload.products) ? payload.products : [];
  const extras = Array.isArray(payload.extras) ? payload.extras : [];
  const subtotalProductos = products.reduce((sum, item) => {
    const subtotal = Number(item.precioUnitario || 0) * Number(item.cantidad || 1);
    const discount = subtotal * Number(item.descuentoPorcentaje || 0) / 100;
    return sum + Math.max(subtotal - discount, 0);
  }, 0);
  const subtotalManoObra = Number(payload.horasTrabajo || 0) * Number(payload.tarifaHora || 0);
  const subtotalExtras = extras.reduce((sum, item) => {
    const monto = Number(item.monto || 0);
    const discount = item.descuentoTipo === "monto" ? Number(item.descuentoValor || 0) : monto * Number(item.descuentoValor || 0) / 100;
    return sum + Math.max(monto - discount, 0);
  }, 0);
  const base = subtotalProductos + subtotalManoObra + subtotalExtras;
  const discountAmount = Number(payload.descuentoMonto || 0) + base * Number(payload.descuentoPorcentaje || 0) / 100;
  const taxable = Math.max(base - discountAmount, 0);
  const tax = payload.incluirIgv ? taxable * Number(payload.impuestoPorcentaje || 0) / 100 : 0;
  return {
    subtotalProductos: moneyNumber(subtotalProductos),
    subtotalManoObra: moneyNumber(subtotalManoObra),
    subtotalExtras: moneyNumber(subtotalExtras),
    total: moneyNumber(taxable + tax),
  };
}

function mapQuote(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    cliente: row.cliente || "-",
    descripcion: row.descripcion || "",
    total: Number(row.monto_total || 0),
    estado: row.estado || "pendiente",
    creadoPor: row.creado_por || "-",
    usuarioId: row.usuario_id,
    createdAt: row.created_at,
    publicToken: row.public_token || "",
    views: Number(row.views || 0),
    monedaCodigo: row.moneda_codigo || row.moneda_simbolo || "",
  };
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (!hasPerm(user.permissions, ["cotizacion", "view"])) {
      return NextResponse.json({ message: "No tienes permiso para ver cotizaciones." }, { status: 403 });
    }
    const tipo = normalizeTipo(request.nextUrl.searchParams.get("tipo"));
    const viewAll = canSeeAll(user);
    const [quoteRows] = await pool.query(
      `SELECT q.*, CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente,
              u.fullname AS creado_por, m.codigo AS moneda_codigo, m.simbolo AS moneda_simbolo,
              COUNT(v.id) AS views
       FROM posventa_cotizaciones q
       LEFT JOIN administracion_clientes c ON c.id=q.cliente_id
       LEFT JOIN administracion_usuarios u ON u.id=q.usuario_id
       LEFT JOIN configuracion_monedas m ON m.id=q.moneda_id
       LEFT JOIN posventa_cotizaciones_views v ON v.cotizacion_id=q.id
       WHERE q.tipo=? ${viewAll ? "" : "AND q.usuario_id=?"}
       GROUP BY q.id
       ORDER BY q.created_at DESC`,
      viewAll ? [tipo] : [tipo, user.id]
    );
    const [clientRows] = await pool.query(`SELECT id, nombre, apellido, celular FROM administracion_clientes ORDER BY nombre ASC`);
    const [centerRows] = await pool.query(`SELECT id, nombre FROM configuracion_centros ORDER BY nombre ASC`);
    const [workshopRows] = await pool.query(`SELECT id, centro_id, nombre FROM configuracion_talleres ORDER BY nombre ASC`);
    const [counterRows] = await pool.query(`SELECT id, centro_id, nombre FROM configuracion_mostradores ORDER BY nombre ASC`);
    const [productRows] = await pool.query(
      `SELECT p.id, p.numero_parte, p.descripcion, p.stock_disponible, p.precio_venta
       FROM posventa_productos p
       ORDER BY p.numero_parte ASC`
    );
    const [currencyRows] = await pool.query(`SELECT id, codigo, nombre, simbolo FROM configuracion_monedas WHERE is_active=1 ORDER BY codigo ASC`);
    const [taxRows] = await pool.query(`SELECT id, nombre, porcentaje FROM configuracion_impuestos WHERE is_active=1 ORDER BY nombre ASC`);
    const [tariffRows] = await pool.query(
      `SELECT t.id, t.nombre, t.precio_hora, t.moneda_id, m.codigo AS moneda_codigo, m.simbolo
       FROM configuracion_tarifas t
       LEFT JOIN configuracion_monedas m ON m.id=t.moneda_id
       WHERE t.activo=1 AND t.tipo=?
       ORDER BY t.nombre ASC`,
      [tipo === "pyp" ? "panos" : "mano_obra"]
    );

    return NextResponse.json({
      currentUser: { id: user.id, name: user.fullname, canViewAll: viewAll },
      quotes: quoteRows.map(mapQuote),
      options: {
        clients: clientRows.map((row) => ({ id: row.id, nombre: `${row.nombre || ""} ${row.apellido || ""}`.trim() || row.celular || `Cliente ${row.id}` })),
        centers: centerRows.map((row) => ({ id: row.id, nombre: row.nombre })),
        workshops: workshopRows.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
        counters: counterRows.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
        products: productRows.map((row) => ({ id: row.id, numeroParte: row.numero_parte, descripcion: row.descripcion, stock: Number(row.stock_disponible || 0), precioVenta: Number(row.precio_venta || 0) })),
        currencies: currencyRows.map((row) => ({ id: row.id, codigo: row.codigo, nombre: row.nombre, simbolo: row.simbolo })),
        taxes: taxRows.map((row) => ({ id: row.id, nombre: row.nombre, porcentaje: Number(row.porcentaje || 0) })),
        tariffs: tariffRows.map((row) => ({ id: row.id, nombre: row.nombre, precioHora: Number(row.precio_hora || 0), monedaId: row.moneda_id, monedaCodigo: row.moneda_codigo || "", simbolo: row.simbolo || "" })),
      },
    });
  } catch (error) {
    console.error("Error loading postventa quotes:", error);
    return NextResponse.json({ message: "No se pudieron cargar las cotizaciones." }, { status: 500 });
  }
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (!hasPerm(user.permissions, ["cotizacion", "create"])) {
      return NextResponse.json({ message: "No tienes permiso para crear cotizaciones." }, { status: 403 });
    }
    const body = await request.json();
    const tipo = normalizeTipo(body.tipo);
    const calc = calculate(body);
    const publicToken = crypto.randomBytes(24).toString("hex");

    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO posventa_cotizaciones
       (tipo, cliente_id, usuario_id, centro_id, taller_id, mostrador_id, descripcion,
        subtotal_productos, subtotal_mano_obra, subtotal_extras, descuento_porcentaje, descuento_monto,
        monto_total, horas_trabajo, tarifa_id, tarifa_hora, moneda_id, impuesto_id, incluir_igv, impuesto_porcentaje, public_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tipo, body.clienteId || null, user.id, body.centroId || null, body.tallerId || null, body.mostradorId || null, body.descripcion || null,
        calc.subtotalProductos, calc.subtotalManoObra, calc.subtotalExtras, body.descuentoPorcentaje || 0, body.descuentoMonto || 0,
        calc.total, body.horasTrabajo || 0, body.tarifaId || null, body.tarifaHora || 0, body.monedaId || null, body.impuestoId || null,
        body.incluirIgv ? 1 : 0, body.impuestoPorcentaje || 0, publicToken,
      ]
    );
    const quoteId = result.insertId;
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
    return NextResponse.json({ ok: true, id: quoteId, token: publicToken }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating postventa quote:", error);
    return NextResponse.json({ message: "No se pudo crear la cotizacion." }, { status: 500 });
  } finally {
    connection.release();
  }
}
