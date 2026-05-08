import { notFound } from "next/navigation";
import { FileText, Printer } from "lucide-react";

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
    `SELECT i.group_id, i.clave, i.valor, i.orden FROM ventas_precio_specs_item i
     INNER JOIN ventas_precio_specs_group g ON g.id = i.group_id
     WHERE g.precio_id=? AND i.is_active=1 ORDER BY i.orden ASC, i.clave ASC`,
    [priceId]
  );
  const itemsByGroup = items.reduce((acc, item) => {
    acc[item.group_id] = acc[item.group_id] || [];
    acc[item.group_id].push(item);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 print:bg-white">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow-sm print:shadow-none">
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
          <div className="flex items-center gap-2 text-violet-700"><FileText className="size-5" /><span className="font-bold">Ficha tecnica</span></div>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-3 py-2 text-sm font-bold text-white"><Printer className="size-4" />Descargar PDF</button>
        </div>
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
                    <dd className="mt-1 text-sm">{item.valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
