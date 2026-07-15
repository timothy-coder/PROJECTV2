import Link from "next/link";
import { ArrowRight, UserRound, MapPin, Check, CalendarDays, Plus, Pencil, Trash2 } from "lucide-react";

import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { hasPerm } from "@/lib/permissions";
import { decodeSpecValue } from "@/app/api/catalog/valueUtils";
import { QuotePreviewItems, QuoteVehicleColorEditor, QuoteVehicleDiscountEditor, QuoteVehiclePricingEditor } from "@/components/quotes/QuotePreviewItems";
import { QuotePreviewActions } from "@/components/quotes/QuotePreviewActions";
import { CreateReservationButton } from "@/components/quotes/CreateReservationButton";

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
              p.version, p.precio_base AS catalogo_precio_base, p.en_stock, p.tiempo_entrega_dias, ma.name AS marca, mo.name AS modelo
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
      `SELECT ad.id, ad.detalle, ad.numero_parte, ad.marca_id, ad.modelo_id, ad.precio, ad.precio_venta, ad.moneda_id
       FROM ventas_accesorios_disponibles ad
       INNER JOIN ventas_precios p ON p.id=?
       WHERE (ad.marca_id IS NULL AND ad.modelo_id IS NULL)
          OR (ad.marca_id=p.marca_id AND ad.modelo_id=p.modelo_id)
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
    const quoteBasePrice = Number(quote.precio_base ?? quote.catalogo_precio_base ?? 0);
    const vehicleDiscount = Number(quote["descuento_veh\u00edculo"] || 0) + (quoteBasePrice * Number(quote["descuento_veh\u00edculo_porcentaje"] || 0) / 100);
    const vehicleFinal = Math.max(quoteBasePrice - vehicleDiscount, 0);
    const accessoriesTotal = accessories.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const giftsTotal = gifts.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const accessoriesGross = accessories.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const giftsGross = gifts.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const quoteTramite = Number(quote.precio_tramite || 0);
    const accessoriesDiscount = accessories.reduce((sum, item) => sum + Number(item.descuento_monto || 0), 0);
    const giftsDiscount = gifts.reduce((sum, item) => sum + Number(item.descuento_monto || 0), 0);
    const itemDiscounts = accessoriesDiscount + giftsDiscount;
    const vehicleNet = vehicleFinal / 1.18;
    const accessoriesNet = accessoriesTotal / 1.18;
    const giftsNet = giftsTotal / 1.18;
    const subtotalNet = vehicleNet + accessoriesNet + giftsNet;
    const totalTax = vehicleFinal - vehicleNet + accessoriesTotal - accessoriesNet + giftsTotal - giftsNet;
    const grandTotal = vehicleFinal + accessoriesTotal + giftsTotal + quoteTramite;
    return (
      <main className="min-h-full bg-slate-50 p-2 text-slate-950 sm:p-3 lg:p-4">
        <div id="quote-preview-root" className="mx-auto max-w-6xl space-y-3 lg:space-y-4">
          <header className="rounded-lg border bg-white p-3 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-3">
            <div>
              <h1 className="text-lg font-bold leading-tight sm:text-xl lg:text-2xl">Resumen de Cotización</h1>
              <p className="text-sm text-slate-600">Q-{String(quote.id).padStart(6, "0")}</p>
            </div>
            <div className="mt-3 grid gap-2 sm:mt-0 sm:flex sm:flex-wrap sm:justify-end">
              <Link className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-white px-3 text-xs font-bold shadow-sm hover:bg-slate-50 sm:text-sm" href={`/oportunidades/${quote.oportunidad_pk}`}><ArrowRight className="size-4" />Oportunidad</Link>
              <Link className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-100 sm:text-sm" href={`/reservas`}><ArrowRight className="size-4" />Reservas</Link>
              <CreateReservationButton opportunityId={quote.oportunidad_pk} quoteId={quote.id} className="w-full text-xs sm:w-auto sm:text-sm" />
            </div>
          </header>
          <section className="rounded-lg border border-violet-200 bg-violet-50 p-3 sm:p-4">
            <h2 className="mb-3 text-sm font-bold text-violet-800">Información de la Oportunidad</h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <IconInfo icon={UserRound} label="Cliente" value={quote.cliente} sub={quote.email} />
              <IconInfo icon={MapPin} label="Oportunidad" value={quote.oportunidad_id} sub={quote.origen || "-"} />
              <IconInfo icon={Check} label="Etapa" value="Cotización" />
              <IconInfo icon={UserRound} label="Creado por" value={quote.creado || "-"} />
              <IconInfo icon={UserRound} label="Asignado a" value={quote.asignado || "-"} />
              <IconInfo icon={CalendarDays} label="Fecha Agendada" value={formatDate(quote.fecha_agenda)} />
            </div>
          </section>
          <section className="rounded-lg border bg-white p-3 shadow-sm sm:p-4">
            <h2 className="mb-3 text-sm font-bold">Información General - Vehí­culo</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Info label="Marca" value={quote.marca} /><Info label="Modelo" value={quote.modelo} /><Info label="Versión" value={quote.version} /><Info label="Año" value={quote.anio || "-"} />
              <Info label="Color Ext." value={quote.color_externo || "-"} /><Info label="Color Int." value={quote.color_interno || "-"} /><Info label="Dias de validez de la cotizacion" value={quote.sku || "N/A"} /><Info label="Estado" value={quote.estado} accent />
            </div>
            <QuoteVehicleColorEditor quoteId={id} colorExterno={quote.color_externo || ""} colorInterno={quote.color_interno || ""} />
          </section>
          <details className="group rounded-lg border border-blue-200 bg-blue-50 p-3 sm:p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-blue-900">Especificaciones del Modelo</h2>
                <p className="mt-1 text-xs font-medium text-blue-700">{specGroups.length ? `${specGroups.length} grupos de especificaciones` : "Sin especificaciones registradas"}</p>
              </div>
              <span className="rounded-md border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-800 group-open:hidden">Ver detalle</span>
              <span className="hidden rounded-md border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-800 group-open:inline">Ocultar</span>
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          <section className="rounded-lg border border-orange-200 bg-orange-50 p-3 sm:p-4">
            <h2 className="mb-3 text-sm font-bold text-orange-900">Precio del Vehí­culo</h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
              <InfoBox label="Modelo/Versión" value={`${quote.modelo} ${quote.version}`} />
              <InfoBox label="Stock" value={quote.en_stock ? "Disponible" : "Bajo pedido"} green={quote.en_stock} />
              <InfoBox label="Entrega (dí­as)" value={quote.tiempo_entrega_dias || 0} />
              <InfoBox label="$ Precio editable" value={money(quoteBasePrice)} orange />
              <InfoBox label="T.C. Referencial" value={quote.tc_referencial ? Number(quote.tc_referencial).toFixed(4) : "-"} />
              <InfoBox label="$ Precio tramite" value={money(quoteTramite)} orange />
            </div>
            {vehicleDiscount ? <div className="mt-3 rounded-lg border border-orange-300 bg-orange-100 p-2 text-xs font-bold text-orange-900 sm:text-sm">Descuento aplicado: -{money(vehicleDiscount)} ({Number(quote["descuento_veh\u00edculo_porcentaje"] || 0).toFixed(2)}%)</div> : null}
            <div className="mt-3 rounded-lg border border-blue-300 bg-blue-50 p-3"><p className="text-xs font-bold text-blue-700">Precio final del vehí­culo:</p><p className="text-2xl font-bold text-blue-800 sm:text-xl">{money(vehicleFinal)}</p></div>
            <QuoteVehiclePricingEditor
              quoteId={id}
              precioBase={quoteBasePrice}
              tcReferencial={quote.tc_referencial || ""}
              diasValidez={quote.sku || ""}
              observaciones={quote.observaciones || ""}
              otrosProductos={quote.otros_productos || ""}
              precioTramite={quoteTramite}
            />
            <QuoteVehicleDiscountEditor quoteId={id} discountAmount={Number(quote["descuento_veh\u00edculo"] || 0)} discountPercentage={Number(quote["descuento_veh\u00edculo_porcentaje"] || 0)} />
          </section>
          <QuotePreviewItems
            quoteId={id}
            accessories={accessories.map((item) => ({ ...item }))}
            gifts={gifts.map((item) => ({ ...item }))}
            accessoryOptions={availableAccessories.map((item) => ({
              value: item.id,
              label: `${item.detalle}${item.numero_parte ? ` - ${item.numero_parte}` : ""}${!item.marca_id && !item.modelo_id ? " - Todas las marcas y modelos" : ""}`,
              price: Number(item.precio_venta ?? item.precio ?? 0),
            }))}
            giftOptions={availableGifts.map((item) => ({
              value: item.id,
              label: `${item.detalle}${item.lote ? ` - ${item.lote}` : ""}`,
              price: Number(item.precio_venta ?? item.precio_compra ?? 0),
            }))}
          />
          <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 sm:p-4">
            <h2 className="mb-3 text-sm font-bold text-emerald-900">Resumen General</h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <SummaryBox label="Precio Vehiculo" sub={`S/IGV: ${money(quoteBasePrice / 1.18)}`} value={money(quoteBasePrice)} />
              
              <SummaryBox label="Accesorios (c/IGV)" sub={`c/desc: ${money(accessoriesTotal)}`} value={money(accessoriesGross)} />
              <SummaryBox label="Regalos (c/IGV)" sub={`c/desc: ${money(giftsTotal)}`} value={money(giftsGross)} />
              <SummaryBox label="Tramite" value={money(quoteTramite)} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              <SummaryBox label="Desc. Vehiculo" value={discountMoney(vehicleDiscount)} danger />
              <SummaryBox label="Total Descuentos" value={discountMoney(itemDiscounts)} danger />
            </div>
            <div className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-2">
              <SummaryDetail label="Subtotal S/IGV:" value={money(subtotalNet)} blue />
              <SummaryDetail label="IGV Total (18%):" value={`+${money(totalTax)}`} green />
            </div>
            <div className="mt-3 rounded-lg border border-emerald-500 bg-white p-3 sm:p-4">
              <p className="text-xs font-bold text-slate-600">GRAN TOTAL (CON IGV Y DESC.)</p>
              <p className="mt-1 text-3xl font-bold text-emerald-700 sm:text-4xl">{money(grandTotal)}</p>
              <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-3">
                <p>Incluye vehiculo, accesorios y regalos</p>
                <p>Con todos los descuentos aplicados</p>
                <p>IGV incluido en el total</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
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

function IconInfo({ icon: Icon, label, value, sub }) { return <div className="flex min-w-0 gap-2"><Icon className="mt-1 size-4 shrink-0 text-violet-700" /><div className="min-w-0"><p className="text-[11px] text-slate-600">{label}</p><p className="truncate text-sm font-bold">{value || "-"}</p>{sub ? <p className="truncate text-[11px] text-slate-500">{sub}</p> : null}</div></div>; }
function Info({ label, value, accent }) { return <div className="min-w-0 rounded-md bg-slate-50 p-2"><p className="text-[11px] text-slate-600">{label}</p><p className={`truncate text-sm font-bold ${accent ? "text-blue-700" : ""}`}>{value}</p></div>; }
function InfoBox({ label, value, green, orange, red }) { return <div className="min-w-0 rounded-lg border bg-white p-3"><p className="text-[11px] text-slate-600">{label}</p><p className={`truncate text-sm font-bold ${green ? "text-emerald-700" : orange ? "text-orange-700" : red ? "text-red-600" : ""}`}>{value}</p></div>; }
function SummaryBox({ label, sub, value, danger }) { return <div className={`min-w-0 rounded-lg border bg-white p-3 ${danger ? "border-red-200 bg-red-50" : "border-emerald-200"}`}><p className="text-[11px] text-slate-600">{label}</p>{sub ? <p className="truncate text-[11px] text-slate-500">{sub}</p> : null}<p className={`mt-1 truncate text-sm font-bold sm:text-base ${danger ? "text-red-600" : "text-slate-950"}`}>{value}</p></div>; }
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
