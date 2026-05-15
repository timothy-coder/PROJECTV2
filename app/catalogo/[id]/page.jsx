import { notFound } from "next/navigation";
import { ExternalLink, FileText } from "lucide-react";

import { CatalogPrintButton } from "@/components/catalog/CatalogPrintButton";
import { decodeSpecValue } from "@/app/api/catalog/valueUtils";
import { pool } from "@/lib/db";

export default async function Page({ params }) {
  const { id } = await params;
  const priceId = Number(id);
  const [rows] = await pool.query(
    `SELECT p.id, p.version, p.precio_base, ma.name AS marca, mo.name AS modelo, mon.simbolo AS simbolo
     FROM ventas_precios p
     INNER JOIN administracion_marcas ma ON ma.id = p.marca_id
     INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id
     INNER JOIN configuracion_monedas mon ON mon.id = p.moneda_id
     WHERE p.id = ? LIMIT 1`,
    [priceId]
  );
  const price = rows[0];
  if (!price) notFound();
  const [groups] = await pool.query(`SELECT id, nombre, orden FROM ventas_precio_specs_group WHERE precio_id=? AND is_active=1 ORDER BY orden ASC, nombre ASC`, [priceId]);
  const [items] = await pool.query(
    `SELECT i.id, i.group_id, i.clave, i.valor, i.orden FROM ventas_precio_specs_item i
     INNER JOIN ventas_precio_specs_group g ON g.id = i.group_id
       WHERE g.precio_id=? AND i.is_active=1 ORDER BY i.orden ASC, i.clave ASC`,
    [priceId]
  );
  const itemsByGroup = items.reduce((acc, item) => {
    if (Number(item.orden || 0) === 0) return acc;
    acc[item.group_id] = acc[item.group_id] || [];
    acc[item.group_id].push({ ...item, ...decodeSpecValue(item.valor) });
    return acc;
  }, {});
  const previewItems = items
    .map((item) => ({ ...item, ...decodeSpecValue(item.valor), groupName: groups.find((group) => group.id === item.group_id)?.nombre || "" }))
    .filter((item) => Number(item.orden || 0) === 0 && ["IMAGEN", "VIDEO", "LINK"].includes(item.valorTipo));
  const visibleGroups = groups.filter((group) => (itemsByGroup[group.id] || []).length);

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 print:bg-white">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-xl bg-white shadow-sm print:shadow-none">
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
          <div className="flex items-center gap-2 text-violet-700"><FileText className="size-5" /><span className="font-bold">Ficha tecnica</span></div>
          <CatalogPrintButton priceId={priceId} />
        </div>
        <div className="relative p-6">
          <header className="mb-6 rounded-lg border border-violet-100 bg-violet-50 p-4 print:border-slate-200 print:bg-white">
            <p className="text-sm font-bold uppercase tracking-wide text-violet-700">Ficha tecnica vehicular</p>
            <h1 className="mt-1 text-3xl font-bold">{price.marca} {price.modelo}</h1>
            <p className="text-lg text-slate-600">{price.version}</p>
            <p className="mt-2 font-bold text-emerald-700">{price.simbolo} {Number(price.precio_base).toFixed(2)}</p>
          </header>
          <SpecsPreview items={previewItems} />
          <section className="space-y-5">
            {visibleGroups.map((group) => (
              <div key={group.id} className="break-inside-avoid rounded-lg border border-slate-200 p-4">
                <h2 className="mb-3 text-xl font-bold text-violet-700">{group.nombre}</h2>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {(itemsByGroup[group.id] || []).map((item) => (
                    <div key={item.id} className="rounded-md bg-slate-50 p-3">
                      <dt className="text-xs font-bold uppercase text-slate-500">{item.clave}</dt>
                      <dd className="mt-1 text-sm"><SpecValue item={item} /></dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}

function SpecsPreview({ items }) {
  if (!items.length) return null;
  return (
    <section className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 print:hidden">
      <h2 className="mb-3 text-sm font-bold uppercase text-blue-800">Vista previa</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => <PreviewCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}

function PreviewCard({ item }) {
  const href = item.valorPath || item.valorUrl || item.valor;
  const imageLike = item.valorTipo === "IMAGEN" || isImageHref(href);
  const videoLike = item.valorTipo === "VIDEO" || isVideoHref(href);
  const linkText = getLinkText(item, href);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="mb-2 text-xs font-bold uppercase text-slate-500">{item.groupName ? `${item.groupName} - ` : ""}{item.clave}</p>
      {imageLike ? (
        <div className="space-y-2">
          <a href={href} target="_blank" rel="noreferrer">
            <img src={href} alt={item.clave} className="max-h-72 w-full rounded-md border border-slate-200 bg-white object-contain" />
          </a>
          <a href={href} className="inline-flex max-w-full items-center gap-1 truncate text-xs font-bold text-blue-700 underline" target="_blank" rel="noreferrer">
            <ExternalLink className="size-3 shrink-0" />{linkText}
          </a>
        </div>
      ) : null}
      {!imageLike && videoLike ? (
        <div className="space-y-2">
          <video src={href} controls className="max-h-72 w-full rounded-md border border-slate-200 bg-black object-contain" />
          <a href={href} className="inline-flex max-w-full items-center gap-1 truncate text-xs font-bold text-blue-700 underline" target="_blank" rel="noreferrer"><ExternalLink className="size-3 shrink-0" />{linkText || "Abrir video"}</a>
        </div>
      ) : null}
      {!imageLike && !videoLike && item.valorTipo === "LINK" ? (
        <a href={href} className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" />{linkText}
        </a>
      ) : null}
    </div>
  );
}

function SpecValue({ item }) {
  const href = item.valorPath || item.valorUrl || item.valor;
  const imageLike = item.valorTipo === "IMAGEN" || isImageHref(href);
  const videoLike = item.valorTipo === "VIDEO" || isVideoHref(href);
  const linkText = getLinkText(item, href);
  if (item.valorTipo === "LINK" && !imageLike && !videoLike) {
    return <a href={href} className="font-semibold text-blue-700 underline" target="_blank" rel="noreferrer">{linkText}</a>;
  }
  if (imageLike) {
    return href ? (
      <div className="space-y-2">
        <a href={href} target="_blank" rel="noreferrer"><img src={href} alt={item.clave} className="max-h-48 rounded-md border border-slate-200 bg-white object-contain" /></a>
        <a href={href} className="inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-blue-700 underline" target="_blank" rel="noreferrer"><ExternalLink className="size-3 shrink-0" />{linkText}</a>
      </div>
    ) : null;
  }
  if (videoLike) {
    return href ? (
      <div className="space-y-2">
        <video src={href} controls className="max-h-56 w-full max-w-md rounded-md border border-slate-200" />
        <a href={href} className="inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-blue-700 underline" target="_blank" rel="noreferrer"><ExternalLink className="size-3 shrink-0" />{linkText || "Abrir video"}</a>
      </div>
    ) : null;
  }
  return item.valor;
}

function getLinkText(item, href) {
  const label = String(item.valor || "").trim();
  const url = String(href || "").trim();
  if (!label || label === url) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith("/")) return url;
  return label;
}

function isImageHref(value) {
  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(String(value || "").trim());
}

function isVideoHref(value) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(value || "").trim());
}
