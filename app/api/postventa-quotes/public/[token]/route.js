import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const [[quote]] = await pool.query(
      `SELECT q.*, CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente,
              u.fullname AS creado_por, m.codigo AS moneda_codigo, m.simbolo AS moneda_simbolo
       FROM posventa_cotizaciones q
       LEFT JOIN administracion_clientes c ON c.id=q.cliente_id
       LEFT JOIN administracion_usuarios u ON u.id=q.usuario_id
       LEFT JOIN configuracion_monedas m ON m.id=q.moneda_id
       WHERE q.public_token=?
       LIMIT 1`,
      [token]
    );
    if (!quote) return NextResponse.json({ message: "Cotizacion no encontrada." }, { status: 404 });
    await pool.query(
      `INSERT INTO posventa_cotizaciones_views (cotizacion_id, ip_address, user_agent)
       VALUES (?, ?, ?)`,
      [
        quote.id,
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "",
        request.headers.get("user-agent") || "",
      ]
    );
    const [products] = await pool.query(
      `SELECT cp.*, p.numero_parte, p.descripcion
       FROM posventa_cotizacion_productos cp
       INNER JOIN posventa_productos p ON p.id=cp.producto_id
       WHERE cp.cotizacion_id=?
       ORDER BY cp.id ASC`,
      [quote.id]
    );
    const [extras] = await pool.query(`SELECT * FROM posventa_cotizacion_extras WHERE cotizacion_id=? ORDER BY id ASC`, [quote.id]);
    return NextResponse.json({
      quote: {
        id: quote.id,
        tipo: quote.tipo,
        cliente: String(quote.cliente || "").trim() || "-",
        creadoPor: quote.creado_por || "-",
        descripcion: quote.descripcion || "",
        subtotalProductos: Number(quote.subtotal_productos || 0),
        subtotalManoObra: Number(quote.subtotal_mano_obra || 0),
        subtotalExtras: Number(quote.subtotal_extras || 0),
        descuentoPorcentaje: Number(quote.descuento_porcentaje || 0),
        descuentoMonto: Number(quote.descuento_monto || 0),
        total: Number(quote.monto_total || 0),
        horasTrabajo: Number(quote.horas_trabajo || 0),
        tarifaHora: Number(quote.tarifa_hora || 0),
        monedaCodigo: quote.moneda_codigo || "",
        monedaSimbolo: quote.moneda_simbolo || "",
        incluirIgv: Boolean(quote.incluir_igv),
        impuestoPorcentaje: Number(quote.impuesto_porcentaje || 0),
        estado: quote.estado || "pendiente",
        createdAt: quote.created_at,
        products: products.map((row) => ({
          id: row.id,
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
      },
    });
  } catch (error) {
    console.error("Error loading public postventa quote:", error);
    return NextResponse.json({ message: "No se pudo cargar la cotizacion." }, { status: 500 });
  }
}
