import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ExternalLink, FileText } from "lucide-react";

import { CatalogPrintButton } from "@/components/catalog/CatalogPrintButton";
import { decodeSpecValue } from "@/app/api/catalog/valueUtils";
import { pool } from "@/lib/db";

export default async function Page({ params }) {
  const { id } = await params;
  const priceId = Number(id);
  const origin = getRequestOrigin(await headers());
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
    acc[item.group_id].push(normalizeCatalogItem({ ...item, ...decodeSpecValue(item.valor) }, origin));
    return acc;
  }, {});
  const previewItems = items
    .map((item) => normalizeCatalogItem({ ...item, ...decodeSpecValue(item.valor), groupName: groups.find((group) => group.id === item.group_id)?.nombre || "" }, origin))
    .filter((item) => Number(item.orden || 0) === 0 && ["IMAGEN", "VIDEO", "LINK"].includes(item.valorTipo));
  const visibleGroups = groups.filter((group) => (itemsByGroup[group.id] || []).length);

  return (
  <main className="min-h-screen bg-slate-100 p-2 sm:p-4 lg:p-6 text-slate-950 print:bg-white">
    {/* ✅ más ancho en PC */}
    <div className="mx-auto w-full max-w-none lg:max-w-6xl 2xl:max-w-7xl overflow-hidden rounded-xl bg-white shadow-sm print:shadow-none">
      <div className="relative p-3 sm:p-5 lg:p-8">
        <header className="mb-4 sm:mb-6 rounded-lg border border-violet-100 bg-violet-50 p-3 sm:p-4 lg:p-5 print:border-slate-200 print:bg-white">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-wide text-violet-700">
            Ficha tecnica vehicular
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl lg:text-4xl font-bold">
            {price.marca} {price.modelo}
          </h1>
          <p className="text-base sm:text-lg text-slate-600">{price.version}</p>
          <p className="mt-2 font-bold text-emerald-700">
            {price.simbolo} {Number(price.precio_base).toFixed(2)}
          </p>
        </header>

        <SpecsPreview items={previewItems} />

        <section className="space-y-4 sm:space-y-5">
          {visibleGroups.map((group) => (
            <div
              key={group.id}
              className="break-inside-avoid rounded-lg border border-slate-200 p-3 sm:p-4"
            >
              <h2 className="mb-3 text-lg sm:text-xl font-bold text-violet-700">
                {group.nombre}
              </h2>

              {/* ✅ responsive: 1 col móvil, 2 tablet, 3-4 PC */}
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {(itemsByGroup[group.id] || []).map((item) => (
                  <div key={item.id} className="rounded-md bg-slate-50 p-3">
                    <dt className="text-xs font-bold uppercase text-slate-500">
                      {item.clave}
                    </dt>
                    <dd className="mt-1 text-sm">
                      <SpecValue item={item} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>

        {/* ✅ corregido: className */}
        <div className="mt-6 flex justify-center">
          <CatalogPrintButton priceId={priceId} />
        </div>
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
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => <PreviewCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}

function PreviewCard({ item }) {
  const href = getItemHref(item);
  const imageLike = item.valorTipo === "IMAGEN" || isImageHref(href);
  const videoLike = item.valorTipo === "VIDEO" || isVideoHref(href);
  const youtubeEmbed = getYoutubeEmbedUrl(href);
  const linkText = getLinkText(item, href);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="mb-2 text-xs font-bold uppercase text-slate-500">{item.groupName ? `${item.groupName} - ` : ""}{item.clave}</p>
      {imageLike ? (
        <div className="space-y-2">
          <a href={href} target="_blank" rel="noreferrer">
            <img src={href} alt={item.clave} className="max-h-72 w-full rounded-md border border-slate-200 bg-white object-contain" />
          </a>
        </div>
      ) : null}
      {!imageLike && videoLike ? (
        <div className="space-y-2">
          {youtubeEmbed ? (
            <iframe src={youtubeEmbed} title={item.clave} className="aspect-video w-full rounded-md border border-slate-200 bg-black" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          ) : (
            <video src={href} controls className="max-h-72 w-full rounded-md border border-slate-200 bg-black object-contain" />
          )}
          
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
  const href = getItemHref(item);
  const imageLike = item.valorTipo === "IMAGEN" || isImageHref(href);
  const videoLike = item.valorTipo === "VIDEO" || isVideoHref(href);
  const youtubeEmbed = getYoutubeEmbedUrl(href);
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
        {youtubeEmbed ? (
          <iframe src={youtubeEmbed} title={item.clave} className="aspect-video w-full max-w-md rounded-md border border-slate-200 bg-black" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        ) : (
          <video src={href} controls className="max-h-56 w-full max-w-md rounded-md border border-slate-200" />
        )}
        <a href={href} className="inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-blue-700 underline" target="_blank" rel="noreferrer"><ExternalLink className="size-3 shrink-0" />{linkText || "Abrir video"}</a>
      </div>
    ) : null;
  }
  return item.valor;
}

function normalizeCatalogItem(item, origin) {
  return {
    ...item,
    valorUrl: absoluteLocalUrl(item.valorUrl, origin),
    valorPath: absoluteLocalUrl(item.valorPath, origin),
  };
}

function getItemHref(item) {
  return item.valorPath || item.valorUrl || item.valor;
}

function absoluteLocalUrl(value, origin) {
  const text = String(value || "").trim();
  if (!text || /^https?:\/\//i.test(text) || !text.startsWith("/")) return text;
  return `${origin}${text}`;
}

function getRequestOrigin(requestHeaders) {
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
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
  const text = String(value || "").trim();
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(text) || isYoutubeHref(text);
}

function isYoutubeHref(value) {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(String(value || "").trim());
}

function getYoutubeEmbedUrl(value) {
  const text = String(value || "").trim();
  try {
    const url = new URL(text);
    if (/youtu\.be$/i.test(url.hostname)) return `https://www.youtube.com/embed/${url.pathname.replace(/^\/+/, "")}`;
    if (/youtube\.com$/i.test(url.hostname) || /www\.youtube\.com$/i.test(url.hostname)) {
      if (url.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${url.pathname.split("/")[2] || ""}`;
      if (url.pathname.startsWith("/embed/")) return text;
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    return "";
  }
  return "";
}
