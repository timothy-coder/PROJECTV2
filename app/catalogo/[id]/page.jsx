import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { CatalogPrintButton } from "@/components/catalog/CatalogPrintButton";
import { decodeSpecValue } from "@/app/api/catalog/valueUtils";
import { pool } from "@/lib/db";

export default async function Page({ params }) {
  const { id } = await params;
  const priceId = Number(id);
  const template = await getActiveTechnicalSheetTemplate();
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
    `SELECT i.group_id, i.clave, i.valor, i.orden FROM ventas_precio_specs_item i
     INNER JOIN ventas_precio_specs_group g ON g.id = i.group_id
       WHERE g.precio_id=? AND i.is_active=1 ORDER BY i.orden ASC, i.clave ASC`,
    [priceId]
  );
  const itemsByGroup = items.reduce((acc, item) => {
    acc[item.group_id] = acc[item.group_id] || [];
    acc[item.group_id].push({ ...item, ...decodeSpecValue(item.valor) });
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 print:bg-white">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-xl bg-white shadow-sm print:shadow-none">
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
          <div className="flex items-center gap-2 text-violet-700"><FileText className="size-5" /><span className="font-bold">Ficha tecnica</span></div>
          <CatalogPrintButton priceId={priceId} />
        </div>
        <div className="relative">
          {template?.marcaAgua ? <Watermark watermark={template.marcaAgua} /> : null}
          {template ? <TemplateSection section={template.header} /> : null}
          <div className="relative p-6">
            <header contentEditable suppressContentEditableWarning className="mb-6 rounded-lg border border-dashed border-violet-200 p-4 print:border-0">
              <p className="text-sm font-bold uppercase tracking-wide text-violet-700">Ficha tecnica vehicular</p>
              <h1 className="mt-1 text-3xl font-bold">{price.marca} {price.modelo}</h1>
              <p className="text-lg text-slate-600">{price.version}</p>
              <p className="mt-2 font-bold text-emerald-700">{price.simbolo} {Number(price.precio_base).toFixed(2)}</p>
            </header>
            <section className="space-y-5">
              {groups.map((group) => (
                <div key={group.id} className="break-inside-avoid rounded-lg border border-slate-200 p-4">
                  <h2 contentEditable suppressContentEditableWarning className="mb-3 text-xl font-bold text-violet-700">{group.nombre}</h2>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {(itemsByGroup[group.id] || []).map((item) => (
                      <div key={`${group.id}-${item.clave}`} className="rounded-md bg-slate-50 p-3">
                        <dt className="text-xs font-bold uppercase text-slate-500">{item.clave}</dt>
                        <dd className="mt-1 text-sm"><SpecValue item={item} /></dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </section>
          </div>
          {template ? <TemplateSection section={template.footer} /> : null}
        </div>
      </div>
    </main>
  );
}

async function getActiveTechnicalSheetTemplate() {
  const [templates] = await pool.query(
    `SELECT id
     FROM configuracion_ventas_documento_plantillas
     WHERE tipo_documento='FICHA_TECNICA' AND is_active=1
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`
  );
  const template = templates[0];
  if (!template) return null;

  const [sections] = await pool.query(
    `SELECT id, tipo, nombre, orden
     FROM configuracion_ventas_documento_plantilla_secciones
     WHERE plantilla_id=? AND is_active=1
     ORDER BY orden ASC, id ASC`,
    [template.id]
  );
  const sectionIds = sections.map((section) => section.id);
  const [elements] = sectionIds.length
    ? await pool.query(
        `SELECT id, seccion_id, tipo, texto, url, imagen_path, orden, align, width_px, height_px
         FROM configuracion_ventas_documento_plantilla_elementos
         WHERE seccion_id IN (?) AND is_active=1
         ORDER BY orden ASC, id ASC`,
        [sectionIds]
      )
    : [[]];
  const [watermarks] = await pool.query(
    `SELECT imagen_path, opacity, rotate_deg, scale
     FROM configuracion_ventas_documento_plantilla_marca_agua
     WHERE plantilla_id=?
     LIMIT 1`,
    [template.id]
  );

  const elementsBySection = elements.reduce((acc, element) => {
    acc[element.seccion_id] = acc[element.seccion_id] || [];
    acc[element.seccion_id].push({
      id: element.id,
      tipo: element.tipo,
      texto: element.texto || "",
      url: element.url || "",
      imagenPath: element.imagen_path || "",
      orden: element.orden ?? 0,
      align: element.align || "LEFT",
      widthPx: element.width_px,
      heightPx: element.height_px,
    });
    return acc;
  }, {});

  const mappedSections = sections.map((section) => ({
    id: section.id,
    tipo: section.tipo,
    nombre: section.nombre || "",
    orden: section.orden ?? 0,
    elementos: elementsBySection[section.id] || [],
  }));

  return {
    header: mappedSections.find((section) => section.tipo === "ENCABEZADO"),
    footer: mappedSections.find((section) => section.tipo === "PIE"),
    marcaAgua: watermarks[0]
      ? {
          imagenPath: watermarks[0].imagen_path,
          opacity: Number(watermarks[0].opacity ?? 0.15),
          rotateDeg: watermarks[0].rotate_deg ?? 0,
          scale: Number(watermarks[0].scale ?? 1),
        }
      : null,
  };
}

function TemplateSection({ section }) {
  if (!section) return null;
  const rows = groupElementsByOrder(section.elementos);
  return (
    <section className="relative w-full px-6 py-4 print:px-0">
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="grid items-start gap-3" style={{ gridTemplateColumns: `repeat(${row.items.length}, minmax(0, 1fr))` }}>
            {row.items.map((item) => <TemplateElement key={item.id} item={item} />)}
          </div>
        ))}
      </div>
    </section>
  );
}

function TemplateElement({ item }) {
  const textAlign = item.align?.toLowerCase() || "left";
  const mediaStyle = {
    width: item.widthPx ? `${item.widthPx}px` : undefined,
    height: item.heightPx ? `${item.heightPx}px` : undefined,
  };
  if (item.tipo === "IMAGEN") {
    return (
      <div style={{ textAlign }}>
        {item.imagenPath ? <img src={item.imagenPath} alt="" className="inline-block max-w-full object-contain" style={mediaStyle} /> : null}
      </div>
    );
  }
  if (item.tipo === "LINK") {
    return (
      <p style={{ textAlign }} className="text-sm font-semibold text-blue-700 underline">
        {item.url ? <a href={item.url}>{item.texto || item.url}</a> : item.texto}
      </p>
    );
  }
  return <p style={{ textAlign }} className="whitespace-pre-wrap text-sm text-slate-800">{item.texto}</p>;
}

function SpecValue({ item }) {
  const href = item.valorPath || item.valorUrl || item.valor;
  if (item.valorTipo === "LINK") {
    return <a href={href} className="font-semibold text-blue-700 underline" target="_blank" rel="noreferrer">{item.valor || href}</a>;
  }
  if (item.valorTipo === "IMAGEN") {
    return href ? <a href={href} target="_blank" rel="noreferrer"><img src={href} alt={item.clave} className="max-h-48 rounded-md border border-slate-200 object-contain" /></a> : null;
  }
  if (item.valorTipo === "VIDEO") {
    return href ? (
      <div className="space-y-2">
        <video src={href} controls className="max-h-56 w-full max-w-md rounded-md border border-slate-200" />
        <a href={href} className="text-xs font-semibold text-blue-700 underline" target="_blank" rel="noreferrer">Abrir video</a>
      </div>
    ) : null;
  }
  return item.valor;
}

function Watermark({ watermark }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
      <img
        src={watermark.imagenPath}
        alt=""
        className="max-h-[55%] max-w-[65%] object-contain"
        style={{ opacity: watermark.opacity, transform: `rotate(${watermark.rotateDeg}deg) scale(${watermark.scale})` }}
      />
    </div>
  );
}

function groupElementsByOrder(elements) {
  const grouped = new Map();
  elements
    .slice()
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0) || Number(a.id || 0) - Number(b.id || 0))
    .forEach((element) => {
      const key = Number(element.orden || 0);
      const list = grouped.get(key) || [];
      list.push(element);
      grouped.set(key, list);
    });
  return Array.from(grouped.entries()).map(([key, items]) => ({ key, items }));
}
