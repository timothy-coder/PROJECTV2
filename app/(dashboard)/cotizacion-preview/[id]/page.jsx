import Link from "next/link";
import { ArrowRight, UserRound, MapPin, Check, CalendarDays, Plus, Pencil, Trash2 } from "lucide-react";

import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { hasPerm } from "@/lib/permissions";
import { decodeSpecValue } from "@/app/api/catalog/valueUtils";
import { QuotePreviewItems, QuoteVehicleColorEditor, QuoteVehicleDiscountEditor } from "@/components/quotes/QuotePreviewItems";
import { QuotePreviewActions } from "@/components/quotes/QuotePreviewActions";

function money(value) {
  return `$${Number(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function Page({ params }) {
  const user = await getCurrentUser();
  if (!hasPerm(user?.permissions || {}, ["oportunidades", "view"])) {
    return <div className="p-4 text-sm font-bold">No tienes permiso para ver cotizaciones.</div>;
  }
  const { id: rawId } = await params;
  const id = Number(rawId);
  const connection = await pool.getConnection();
  try {
    const [[quote]] = await connection.query(
      `SELECT q.*, o.oportunidad_id, o.id AS oportunidad_pk, CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente,
              c.email, au.fullname AS asignado, cu.fullname AS creado, oc.name AS origen,
              d.fecha_agenda,
              p.version, p.precio_base, p.en_stock, p.tiempo_entrega_dias, ma.name AS marca, mo.name AS modelo
       FROM ventas_cotizaciones q
       INNER JOIN ventas_oportunidades o ON o.id=q.oportunidad_id
       INNER JOIN administracion_clientes c ON c.id=o.cliente_id
       LEFT JOIN administracion_usuarios au ON au.id=o.asignado_a
       LEFT JOIN administracion_usuarios cu ON cu.id=q.created_by
       LEFT JOIN configuracion_origenes_citas oc ON oc.id=o.origen_id
       INNER JOIN ventas_precios p ON p.id=q.precio_id
       INNER JOIN administracion_marcas ma ON ma.id=p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id=p.modelo_id
       LEFT JOIN (
         SELECT oportunidad_padre_id, MAX(fecha_agenda) AS fecha_agenda FROM ventas_oportunidades_detalles GROUP BY oportunidad_padre_id
       ) d ON d.oportunidad_padre_id=o.id
       WHERE q.id=? LIMIT 1`,
      [id]
    );
    if (!quote) return <div className="p-4 text-sm font-bold">Cotizacion no encontrada.</div>;
    const [accessories] = await connection.query(`SELECT ca.*, ad.detalle, ad.numero_parte FROM ventas_cotizaciones_accesorios ca INNER JOIN ventas_accesorios_disponibles ad ON ad.id=ca.accesorio_id WHERE ca.cotizacion_id=?`, [id]);
    const [gifts] = await connection.query(`SELECT cr.*, rd.detalle, rd.lote FROM ventas_cotizaciones_regalos cr INNER JOIN ventas_regalos_disponibles rd ON rd.id=cr.regalo_id WHERE cr.cotizacion_id=?`, [id]);
    const [availableAccessories] = await connection.query(
      `SELECT ad.id, ad.detalle, ad.numero_parte, ad.precio, ad.precio_venta, ad.moneda_id
       FROM ventas_accesorios_disponibles ad
       INNER JOIN ventas_precios p ON p.id=?
       WHERE ad.marca_id=p.marca_id AND ad.modelo_id=p.modelo_id
       ORDER BY ad.detalle ASC`,
      [quote.precio_id]
    );
    const [availableGifts] = await connection.query(`SELECT id, detalle, lote, precio_compra, precio_venta, moneda_id FROM ventas_regalos_disponibles ORDER BY detalle ASC`);
    const [[publicLink]] = await connection.query(`SELECT token FROM ventas_cotizacion_enlaces_publicos WHERE cotizacion_id=? LIMIT 1`, [id]);
    const [specRows] = await connection.query(
      `SELECT g.id AS group_id, g.nombre AS group_name,
              i.id AS item_id, i.clave, i.valor, i.orden AS item_order
       FROM ventas_precio_specs_group g
       LEFT JOIN ventas_precio_specs_item i ON i.group_id=g.id AND i.is_active=1
       WHERE g.precio_id=? AND g.is_active=1
       ORDER BY g.orden ASC, g.id ASC, i.orden ASC, i.id ASC`,
      [quote.precio_id]
    );
    const specGroups = buildSpecGroups(specRows);
    const vehicleDiscount = Number(quote["descuento_veh\u00edculo"] || 0) + (Number(quote.precio_base || 0) * Number(quote["descuento_veh\u00edculo_porcentaje"] || 0) / 100);
    const vehicleFinal = Math.max(Number(quote.precio_base || 0) - vehicleDiscount, 0);
    const accessoriesTotal = accessories.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const giftsTotal = gifts.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const accessoriesGross = accessories.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const giftsGross = gifts.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const accessoriesDiscount = accessories.reduce((sum, item) => sum + Number(item.descuento_monto || 0), 0);
    const giftsDiscount = gifts.reduce((sum, item) => sum + Number(item.descuento_monto || 0), 0);
    const itemDiscounts = accessoriesDiscount + giftsDiscount;
    const vehicleNet = vehicleFinal / 1.18;
    const accessoriesNet = accessoriesTotal / 1.18;
    const giftsNet = giftsTotal / 1.18;
    const subtotalNet = vehicleNet + accessoriesNet + giftsNet;
    const totalTax = vehicleFinal - vehicleNet + accessoriesTotal - accessoriesNet + giftsTotal - giftsNet;
    const grandTotal = vehicleFinal + accessoriesTotal + giftsTotal;
    return (
      <main className="min-h-full bg-slate-50 p-4 text-slate-950">
        <div id="quote-preview-root" className="mx-auto max-w-6xl space-y-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">Resumen de Cotización</h1>
              <p className="text-sm text-slate-600">Q-{String(quote.id).padStart(6, "0")}</p>
            </div>
            <div className="flex gap-2">
              <Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-bold shadow-sm" href={`/oportunidades/${quote.oportunidad_pk}`}><ArrowRight className="size-4" />Ir a Oportunidad</Link>
              <Link className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-bold text-white shadow-sm" href={`/reservas`}><ArrowRight className="size-4" />Llevar a Reserva</Link>
            </div>
          </header>
          <section className="rounded-xl border border-violet-200 bg-violet-50 p-5">
            <h2 className="mb-8 font-bold text-violet-800">Información de la Oportunidad</h2>
            <div className="grid gap-6 md:grid-cols-3">
              <IconInfo icon={UserRound} label="Cliente" value={quote.cliente} sub={quote.email} />
              <IconInfo icon={MapPin} label="Oportunidad" value={quote.oportunidad_id} sub={quote.origen || "-"} />
              <IconInfo icon={Check} label="Etapa" value="Cotización" />
              <IconInfo icon={UserRound} label="Creado por" value={quote.creado || "-"} />
              <IconInfo icon={UserRound} label="Asignado a" value={quote.asignado || "-"} />
              <IconInfo icon={CalendarDays} label="Fecha Agendada" value={formatDate(quote.fecha_agenda)} />
            </div>
          </section>
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-10 font-bold">Información General - Vehí­culo</h2>
            <div className="grid gap-8 md:grid-cols-4">
              <Info label="Marca" value={quote.marca} /><Info label="Modelo" value={quote.modelo} /><Info label="Versión" value={quote.version} /><Info label="Año" value={quote.anio || "-"} />
              <Info label="Color Ext." value={quote.color_externo || "-"} /><Info label="Color Int." value={quote.color_interno || "-"} /><Info label="SKU" value={quote.sku || "N/A"} /><Info label="Estado" value={quote.estado} accent />
            </div>
            <QuoteVehicleColorEditor quoteId={id} colorExterno={quote.color_externo || ""} colorInterno={quote.color_interno || ""} />
          </section>
          <details className="group rounded-xl border border-blue-200 bg-blue-50 p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-blue-900">Especificaciones del Modelo</h2>
                <p className="mt-1 text-xs font-medium text-blue-700">{specGroups.length ? `${specGroups.length} grupos de especificaciones` : "Sin especificaciones registradas"}</p>
              </div>
              <span className="rounded-md border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-800 group-open:hidden">Ver detalle</span>
              <span className="hidden rounded-md border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-800 group-open:inline">Ocultar</span>
            </summary>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {specGroups.map((group) => (
                <SpecGroup key={group.id} group={group} />
              ))}
              {!specGroups.length ? (
                <div className="col-span-full rounded-lg border border-blue-200 bg-white p-8 text-center text-sm font-medium text-slate-500">
                  No hay especificaciones registradas para esta marca, modelo y versión.
                </div>
              ) : null}
            </div>
          </details>
          <section className="rounded-xl border border-orange-200 bg-orange-50 p-5">
            <h2 className="mb-8 font-bold text-orange-900">Precio del Vehí­culo</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <InfoBox label="Modelo/Versión" value={`${quote.modelo} ${quote.version}`} />
              <InfoBox label="Stock" value={quote.en_stock ? "Disponible" : "Bajo pedido"} green={quote.en_stock} />
              <InfoBox label="Entrega (dí­as)" value={quote.tiempo_entrega_dias || 0} />
              <InfoBox label="$ Precio" value={money(quote.precio_base)} orange />
            </div>
            {vehicleDiscount ? <div className="mt-5 rounded-lg border border-orange-300 bg-orange-100 p-3 text-sm font-bold text-orange-900">Descuento aplicado: -{money(vehicleDiscount)} ({Number(quote["descuento_veh\u00edculo_porcentaje"] || 0).toFixed(2)}%)</div> : null}
            <div className="mt-3 rounded-lg border border-blue-300 bg-blue-50 p-3"><p className="text-xs font-bold text-blue-700">Precio final del vehí­culo:</p><p className="text-xl font-bold text-blue-800">{money(vehicleFinal)}</p></div>
            <QuoteVehicleDiscountEditor quoteId={id} discountAmount={Number(quote["descuento_veh\u00edculo"] || 0)} discountPercentage={Number(quote["descuento_veh\u00edculo_porcentaje"] || 0)} />
          </section>
          <QuotePreviewItems
            quoteId={id}
            accessories={accessories.map((item) => ({ ...item }))}
            gifts={gifts.map((item) => ({ ...item }))}
            accessoryOptions={availableAccessories.map((item) => ({
              value: item.id,
              label: `${item.detalle} - ${item.numero_parte}`,
              price: Number(item.precio_venta ?? item.precio ?? 0),
            }))}
            giftOptions={availableGifts.map((item) => ({
              value: item.id,
              label: `${item.detalle}${item.lote ? ` - ${item.lote}` : ""}`,
              price: Number(item.precio_venta ?? item.precio_compra ?? 0),
            }))}
          />
          <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
            <h2 className="mb-6 font-bold text-emerald-900">Resumen General</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryBox label="Precio Vehiculo" sub={`S/IGV: ${money(Number(quote.precio_base || 0) / 1.18)}`} value={money(quote.precio_base)} />
              
              <SummaryBox label="Accesorios (c/IGV)" sub={`c/desc: ${money(accessoriesTotal)}`} value={money(accessoriesGross)} />
              <SummaryBox label="Regalos (c/IGV)" sub={`c/desc: ${money(giftsTotal)}`} value={money(giftsGross)} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <SummaryBox label="Desc. Vehiculo" value={discountMoney(vehicleDiscount)} danger />
              <SummaryBox label="Total Descuentos" value={discountMoney(itemDiscounts)} danger />
            </div>
            <div className="mt-4 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
              <SummaryDetail label="Subtotal S/IGV:" value={money(subtotalNet)} blue />
              <SummaryDetail label="IGV Total (18%):" value={`+${money(totalTax)}`} green />
            </div>
            <div className="mt-4 rounded-xl border border-emerald-500 bg-white p-5">
              <p className="text-xs font-bold text-slate-600">GRAN TOTAL (CON IGV Y DESC.)</p>
              <p className="mt-3 text-5xl font-bold text-emerald-700">{money(grandTotal)}</p>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <p>Incluye vehiculo, accesorios y regalos</p>
                <p>Con todos los descuentos aplicados</p>
                <p>IGV incluido en el total</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="mb-3 text-xs font-bold text-blue-900">Desglose Detallado:</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <SummaryDetail label="Vehí­culo S/IGV:" value={money(vehicleNet)} blue />
                  <SummaryDetail label="Accesorios S/IGV:" value={money(accessoriesNet)} blue />
                  <SummaryDetail label="Regalos S/IGV:" value={money(giftsNet)} blue />
                </div>
                <div className="space-y-2">
                  <SummaryDetail label="Vehí­culo IGV:" value={money(vehicleFinal - vehicleNet)} green />
                  <SummaryDetail label="Accesorios IGV:" value={money(accessoriesTotal - accessoriesNet)} green />
                  <SummaryDetail label="Regalos IGV:" value={money(giftsTotal - giftsNet)} green />
                </div>
              </div>
            </div>
            <QuotePreviewActions
              publicToken={publicLink?.token || ""}
              fileName={`cotizacion-Q-${String(quote.id).padStart(6, "0")}-${quote.cliente || "cliente"}`}
              advisorName={user.fullname || quote.creado || "Asesor"}
              quoteId={quote.id}
              userPermissions={user?.permissions || {}}
            />
          </section>
        </div>
      </main>
    );
  } finally {
    connection.release();
  }
}

function IconInfo({ icon: Icon, label, value, sub }) { return <div className="flex gap-3"><Icon className="mt-1 size-4 text-violet-700" /><div><p className="text-xs text-slate-600">{label}</p><p className="font-bold">{value || "-"}</p>{sub ? <p className="text-xs text-slate-500">{sub}</p> : null}</div></div>; }
function Info({ label, value, accent }) { return <div><p className="text-xs text-slate-600">{label}</p><p className={`font-bold ${accent ? "text-blue-700" : ""}`}>{value}</p></div>; }
function InfoBox({ label, value, green, orange, red }) { return <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-600">{label}</p><p className={`font-bold ${green ? "text-emerald-700" : orange ? "text-orange-700" : red ? "text-red-600" : ""}`}>{value}</p></div>; }
function SummaryBox({ label, sub, value, danger }) { return <div className={`rounded-lg border bg-white p-4 ${danger ? "border-red-200 bg-red-50" : "border-emerald-200"}`}><p className="text-xs text-slate-600">{label}</p>{sub ? <p className="text-xs text-slate-500">{sub}</p> : null}<p className={`mt-1 text-lg font-bold ${danger ? "text-red-600" : "text-slate-950"}`}>{value}</p></div>; }
function SummaryDetail({ label, value, blue, green }) { return <div><p className="text-xs text-slate-600">{label}</p><p className={`text-sm font-bold ${blue ? "text-blue-700" : green ? "text-emerald-700" : "text-slate-950"}`}>{value}</p></div>; }
function discountMoney(value) { return Number(value || 0) > 0 ? `-${money(value)}` : "$0.00"; }
function buildSpecGroups(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.group_id)) {
      groups.set(row.group_id, {
        id: row.group_id,
        name: row.group_name,
        items: [],
      });
    }
    if (row.item_id) {
      const decoded = decodeSpecValue(row.valor);
      groups.get(row.group_id).items.push({
        id: row.item_id,
        key: row.clave,
        value: decoded.valor,
        order: row.item_order,
        ...decoded,
      });
    }
  });
  return Array.from(groups.values());
}
function SpecGroup({ group }) {
  return (
    <div className="min-h-40 rounded-lg border border-blue-200 bg-white p-4">
      <p className="text-xs font-bold text-blue-700">{group.name}</p>
      <div className="mt-3 space-y-3">
        {group.items.map((item) => (
          <SpecItem key={item.id} item={item} />
        ))}
        {!group.items.length ? <p className="text-sm font-medium text-slate-400">Sin detalles</p> : null}
      </div>
    </div>
  );
}
function SpecItem({ item }) {
  const value = String(item.value || "").trim();
  const href = item.valorPath || item.valorUrl || value;
  if (!value && !href) return <p className="text-sm font-bold">{item.key}</p>;
  if (item.valorTipo === "IMAGEN" || isImageValue(href)) {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">{item.key}</p>
        <div
          aria-label={item.key || "Especificacion"}
          className="h-24 w-full rounded bg-slate-100 bg-contain bg-center bg-no-repeat"
          role="img"
          style={{ backgroundImage: `url("${href}")` }}
        />
      </div>
    );
  }
  if (item.valorTipo === "VIDEO") {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">{item.key}</p>
        <video src={href} controls className="h-24 w-full rounded bg-slate-100 object-contain" />
        <a className="mt-1 block text-xs font-bold text-blue-700 underline" href={href} target="_blank" rel="noreferrer">Abrir video</a>
      </div>
    );
  }
  if (isUrlValue(href)) {
    return (
      <div>
        <p className="text-xs font-semibold text-slate-600">{item.key}</p>
        <a className="text-sm font-bold text-blue-700 underline-offset-2 hover:underline" href={href} target="_blank" rel="noreferrer">
          Ver {item.key || "detalle"}
        </a>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600">{item.key}</p>
      <p className="whitespace-pre-wrap text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}
function isImageValue(value) {
  return /^(data:image\/|https?:\/\/|\/).+\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(value);
}
function isUrlValue(value) {
  return /^(https?:\/\/|\/)/i.test(value);
}
function ItemsCard({ title, rows, partKey, tone }) { const total = rows.reduce((sum, item) => sum + Number(item.total || 0), 0); return <section className="rounded-xl border bg-white p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><h2 className="font-bold">{title} ({rows.length})</h2><button className="inline-flex h-8 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-bold text-white"><Plus className="size-4" />Agregar</button></div><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[860px] text-sm"><thead className="bg-slate-100 text-left"><tr><th className="px-3 py-3">DescripciÃ³n</th><th>Referencia</th><th>Cant.</th><th>Unitario</th><th>Total C/IGV</th><th>Desc.</th><th>Total Final</th><th>AcciÃ³n</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id}><td className="px-3 py-3">{row.detalle}</td><td>{row[partKey] || "-"}</td><td>{row.cantidad}</td><td>{money(row.precio_unitario)}</td><td>{money(row.subtotal)}</td><td className="text-red-600">{Number(row.descuento_monto || 0) ? `-${money(row.descuento_monto)}` : "-"}</td><td className="font-bold text-blue-700">{money(row.total)}</td><td><Pencil className="mr-3 inline size-4 text-blue-700" /><Trash2 className="inline size-4 text-red-600" /></td></tr>)}{!rows.length ? <tr><td colSpan={8} className="py-8 text-center text-slate-500">Sin registros</td></tr> : null}</tbody></table></div><div className={`mt-5 rounded-lg border p-4 ${tone === "violet" ? "border-violet-200 bg-violet-50" : "border-blue-200 bg-blue-50"}`}><div className="grid gap-4 md:grid-cols-4"><Info label="Total C/IGV" value={money(total)} /><Info label="Desc. Items" value="$0.00" /><Info label="S/IGV" value={money(total / 1.18)} /><Info label="IGV (18%)" value={money(total - total / 1.18)} /></div><div className="mt-4 rounded border border-blue-400 bg-white p-3 text-right font-bold text-blue-700">Total {title}: {money(total)}</div></div></section>; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString("es-PE") : "-"; }
