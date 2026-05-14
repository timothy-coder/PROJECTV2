import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { pool } from "@/lib/db";

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default async function PublicQuotePage({ params }) {
  const { token } = await params;
  const connection = await pool.getConnection();
  try {
    const [[link]] = await connection.query(`SELECT * FROM ventas_cotizacion_enlaces_publicos WHERE token=? LIMIT 1`, [token]);
    if (!link) notFound();

    const h = await headers();
    const ip = String(h.get("x-forwarded-for") || "").split(",")[0] || null;
    const userAgent = h.get("user-agent") || null;
    await connection.query(`UPDATE ventas_cotizacion_enlaces_publicos SET vistas_totales=COALESCE(vistas_totales,0)+1 WHERE id=?`, [link.id]);
    await connection.query(`INSERT INTO ventas_cotizacion_vistas_historial (enlace_id, ip_address, user_agent) VALUES (?, ?, ?)`, [link.id, ip, userAgent]);

    const [[quote]] = await connection.query(
      `SELECT q.*, o.oportunidad_id, CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente,
              c.email, c.celular, oc.name AS origen, au.fullname AS asignado,
              p.version, p.precio_base, p.en_stock, p.tiempo_entrega_dias, ma.name AS marca, mo.name AS modelo
       FROM ventas_cotizaciones q
       INNER JOIN ventas_oportunidades o ON o.id=q.oportunidad_id
       INNER JOIN administracion_clientes c ON c.id=o.cliente_id
       LEFT JOIN configuracion_origenes_citas oc ON oc.id=o.origen_id
       LEFT JOIN administracion_usuarios au ON au.id=o.asignado_a
       INNER JOIN ventas_precios p ON p.id=q.precio_id
       INNER JOIN administracion_marcas ma ON ma.id=p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id=p.modelo_id
       WHERE q.id=? LIMIT 1`,
      [link.cotizacion_id]
    );
    if (!quote) notFound();

    const [accessories] = await connection.query(
      `SELECT ca.*, ad.detalle, ad.numero_parte
       FROM ventas_cotizaciones_accesorios ca
       INNER JOIN ventas_accesorios_disponibles ad ON ad.id=ca.accesorio_id
       WHERE ca.cotizacion_id=? ORDER BY ca.id ASC`,
      [quote.id]
    );
    const [gifts] = await connection.query(
      `SELECT cr.*, rd.detalle, rd.lote
       FROM ventas_cotizaciones_regalos cr
       INNER JOIN ventas_regalos_disponibles rd ON rd.id=cr.regalo_id
       WHERE cr.cotizacion_id=? ORDER BY cr.id ASC`,
      [quote.id]
    );

    const discountAmount = Number(quote["descuento_vehículo"] || quote["descuento_vehÃ­culo"] || 0);
    const discountPercent = Number(quote["descuento_vehículo_porcentaje"] || quote["descuento_vehÃ­culo_porcentaje"] || 0);
    const vehicleDiscount = discountAmount + (Number(quote.precio_base || 0) * discountPercent / 100);
    const vehicleTotal = Math.max(Number(quote.precio_base || 0) - vehicleDiscount, 0);
    const accessoriesTotal = accessories.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const giftsTotal = gifts.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const grandTotal = vehicleTotal + accessoriesTotal + giftsTotal;

    return (
      <main className="min-h-screen bg-slate-50 p-4 text-slate-950">
        <div className="mx-auto max-w-6xl space-y-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">Resumen de Cotizacion</h1>
              <p className="text-sm text-slate-600">Q-{String(quote.id).padStart(6, "0")}</p>
            </div>
          </header>

          <section className="rounded-lg border border-violet-200 bg-violet-50 p-5">
            <h2 className="mb-4 font-bold text-violet-800">Informacion de la Oportunidad</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Info label="Cliente" value={quote.cliente || "-"} />
              <Info label="Oportunidad" value={quote.oportunidad_id || "-"} />
              <Info label="Origen" value={quote.origen || "-"} />
              <Info label="Correo" value={quote.email || "-"} />
              <Info label="Celular" value={quote.celular || "-"} />
              <Info label="Asignado a" value={quote.asignado || "No asignado"} />
            </div>
          </section>

          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-bold">Informacion General - Vehiculo</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <Info label="Marca" value={quote.marca} />
              <Info label="Modelo" value={quote.modelo} />
              <Info label="Version" value={quote.version} />
              <Info label="Año" value={quote.anio || "-"} />
              <Info label="Color Ext." value={quote.color_externo || "-"} />
              <Info label="Color Int." value={quote.color_interno || "-"} />
              <Info label="SKU" value={quote.sku || "N/A"} />
              <Info label="Estado" value={quote.estado} />
            </div>
          </section>

          <section className="rounded-lg border border-orange-200 bg-orange-50 p-5">
            <h2 className="mb-4 font-bold text-orange-900">Precio del Vehiculo</h2>
            <div className="grid gap-3 md:grid-cols-4">
              <Info label="Modelo/Version" value={`${quote.modelo} ${quote.version}`} />
              <Info label="Stock" value={quote.en_stock ? "Disponible" : "Bajo pedido"} />
              <Info label="Entrega (dias)" value={quote.tiempo_entrega_dias || 0} />
              <Info label="Precio" value={money(quote.precio_base)} />
            </div>
            {vehicleDiscount ? <div className="mt-4 rounded-md border border-orange-300 bg-orange-100 p-3 font-bold text-orange-900">Descuento aplicado: -{money(vehicleDiscount)} ({discountPercent || 0}%)</div> : null}
            <div className="mt-4 rounded-md border border-blue-300 bg-blue-50 p-3">
              <p className="text-xs font-bold text-blue-700">Precio final del vehiculo</p>
              <p className="text-xl font-bold text-blue-800">{money(vehicleTotal)}</p>
            </div>
          </section>

          <ItemsSection title="Accesorios" rows={accessories} partKey="numero_parte" />
          <ItemsSection title="Regalos" rows={gifts} partKey="lote" />

          <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-5">
            <h2 className="mb-4 font-bold text-emerald-900">Resumen General</h2>
            <div className="grid gap-3 md:grid-cols-4">
              <Info label="Precio Vehiculo" value={money(vehicleTotal)} />
              <Info label="Accesorios" value={money(accessoriesTotal)} />
              <Info label="Regalos" value={money(giftsTotal)} />
              <Info label="Total Descuentos" value={`-${money(vehicleDiscount)}`} />
            </div>
            <div className="mt-5 rounded-lg border border-emerald-500 bg-white p-5">
              <p className="text-xs font-bold text-slate-600">GRAN TOTAL</p>
              <p className="text-4xl font-bold text-emerald-700">{money(grandTotal)}</p>
            </div>
          </section>
        </div>
      </main>
    );
  } finally {
    connection.release();
  }
}

function Info({ label, value }) {
  return <div><p className="text-xs font-bold text-slate-500">{label}</p><p className="font-bold">{value}</p></div>;
}

function ItemsSection({ title, rows, partKey }) {
  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-bold"><FileText className="size-4" />{title} ({rows.length})</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left"><tr><th className="px-3 py-3">Descripcion</th><th>Referencia</th><th>Cant.</th><th>Unitario</th><th>Desc.</th><th>Total Final</th></tr></thead>
          <tbody className="divide-y">
            {rows.map((row) => <tr key={row.id}><td className="px-3 py-3">{row.detalle}</td><td>{row[partKey] || "-"}</td><td>{row.cantidad}</td><td>{money(row.precio_unitario)}</td><td>{money(row.descuento_monto || 0)}</td><td className="font-bold text-blue-700">{money(row.total)}</td></tr>)}
            {!rows.length ? <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={6}>Sin registros.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
