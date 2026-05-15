"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Copy, Eye, FileDown, Link2, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { postventaQuotesApi } from "@/app/api/postventa-quotes.api";
import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePostventaQuotes } from "@/hooks/postventaquotes/usePostventaQuotes";
import { hasPerm } from "@/lib/permissions";

const money = (value, code = "S/") => `${code} ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PostventaQuotesPage({ tipo = "taller", userPermissions }) {
  const data = usePostventaQuotes(tipo);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("list");
  const [editing, setEditing] = useState(null);
  const canView = hasPerm(userPermissions, ["cotizacion", "view"]);
  const canCreate = hasPerm(userPermissions, ["cotizacion", "create"]);
  const canEdit = hasPerm(userPermissions, ["cotizacion", "edit"]);
  const canDelete = hasPerm(userPermissions, ["cotizacion", "delete"]);
  const canStatus = hasPerm(userPermissions, ["cotizacion", "status"]);
  const [detail, setDetail] = useState({ open: false, loading: false, quote: null });

  const rows = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return clean ? data.quotes.filter((row) => `${row.id} ${row.cliente} ${row.descripcion}`.toLowerCase().includes(clean)) : data.quotes;
  }, [data.quotes, query]);

  if (!canView) return <div className="p-4 text-sm font-bold text-slate-700">No tienes permiso para ver cotizaciones.</div>;

  async function openDetail(row) {
    setDetail({ open: true, loading: true, quote: null });
    try {
      const result = await postventaQuotesApi.detail(row.id);
      setDetail({ open: true, loading: false, quote: result.quote });
    } catch (error) {
      setDetail({ open: false, loading: false, quote: null });
      toast.error(error?.message || "No se pudo cargar el detalle.");
    }
  }

  async function copyPublicLink(id) {
    const result = await postventaQuotesApi.update(id, { action: "public-token" });
    const url = `${window.location.origin}/cotizacion-posventa/${result.token}`;
    await navigator.clipboard?.writeText(url);
    toast.success("Enlace publico copiado");
    setDetail((old) => old.quote?.id === id ? { ...old, quote: { ...old.quote, publicToken: result.token } } : old);
  }

  async function updateQuoteStatus(id, estado) {
    await postventaQuotesApi.update(id, { action: "status", estado });
    toast.success("Estado actualizado");
    setDetail((old) => old.quote?.id === id ? { ...old, quote: { ...old.quote, estado } } : old);
    await data.reload();
  }

  if (mode === "form") {
    return (
      <QuoteForm
        tipo={tipo}
        options={data.options}
        currentUser={data.currentUser}
        initial={editing}
        onCancel={() => { setMode("list"); setEditing(null); }}
        onSubmit={async (payload) => {
          if (editing?.id) {
            await data.updateQuote(editing.id, payload);
            toast.success("Cotizacion actualizada");
          } else {
            await data.createQuote(payload);
            toast.success("Cotizacion creada");
          }
          setMode("list");
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 text-slate-950">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cotizaciones - Vista general</h1>
          <p className="text-sm text-slate-500">{tipo === "pyp" ? "Planchado y pintura" : "Taller"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={data.reload}><RefreshCw className="size-4" /></Button>
          {canCreate ? <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => { setEditing(null); setMode("form"); }}><Plus className="size-4" />Nueva Cotización</Button> : null}
        </div>
      </div>
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cotización..." className="pl-9" />
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3">#</th>
                <th>Cliente</th>
                <th>Descripción</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Creado por</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.loading ? <tr><td colSpan={9} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr> : null}
              {!data.loading && rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 font-bold">{String(row.id).padStart(3, "0")}-2026</td>
                  <td>{row.cliente}</td>
                  <td className="max-w-[260px] truncate">{row.descripcion || "-"}</td>
                  <td className="font-bold">{money(row.total, row.monedaCodigo || "S/")}</td>
                  <td><Status estado={row.estado} /></td>
                  <td>{row.creadoPor}</td>
                  <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString("es-PE") : "-"}</td>
                  <td><span className="rounded-full border px-2 py-1 text-xs font-bold capitalize">{row.tipo}</span></td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(row)}><Eye className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={async () => { await downloadPdf(row.id); }}><FileDown className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={async () => shareLink(row.id)}><Link2 className="size-4" /></Button>
                      {canEdit ? <Button variant="ghost" size="icon" onClick={async () => { const result = await postventaQuotesApi.detail(row.id); setEditing(result.quote); setMode("form"); }}><Pencil className="size-4" /></Button> : null}
                      {canDelete ? <Button variant="ghost" size="icon" className="text-red-600" onClick={async () => { await data.deleteQuote(row.id); toast.success("Cotizacion eliminada"); }}><Trash2 className="size-4" /></Button> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!data.loading && !rows.length ? <tr><td colSpan={9} className="py-10 text-center text-slate-500">No hay cotizaciones.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <QuoteDetailDialog
        open={detail.open}
        loading={detail.loading}
        quote={detail.quote}
        onOpenChange={(open) => setDetail((old) => ({ ...old, open }))}
        onCopyLink={copyPublicLink}
        onStatusChange={updateQuoteStatus}
        canStatus={canStatus}
      />
    </div>
  );
}

function QuoteDetailDialog({ open, loading, quote, onOpenChange, onCopyLink, onStatusChange, canStatus }) {
  const [tab, setTab] = useState("summary");
  const currency = quote?.monedaCodigo || quote?.monedaSimbolo || "S/";
  const totals = useMemo(() => quote ? calculateQuoteDisplayTotals(quote) : null, [quote]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] w-[min(96vw,820px)] max-w-none overflow-y-auto p-0 text-sm">
        <DialogHeader className="border-b px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <DialogTitle className="text-lg font-bold text-slate-950">
              Detalle de Cotizacion {quote?.id ? `#${quote.id}` : ""}
            </DialogTitle>
            {quote ? (
              <Button variant="outline" className="w-fit gap-2" onClick={() => onCopyLink(quote.id)}>
                <Copy className="size-4" />
                Copiar enlace publico
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <div className="px-5 pb-5">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center text-slate-500">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Cargando detalle...
            </div>
          ) : null}

          {!loading && quote ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-bold">
                <button
                  type="button"
                  className={`rounded-md px-3 py-2 ${tab === "summary" ? "bg-white shadow-sm" : "text-slate-500"}`}
                  onClick={() => setTab("summary")}
                >
                  Resumen Cotizacion
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-2 ${tab === "views" ? "bg-white shadow-sm" : "text-slate-500"}`}
                  onClick={() => setTab("views")}
                >
                  <Eye className="mr-2 inline size-4" />
                  Metricas de Vistas
                </button>
              </div>

              {tab === "summary" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 text-sm sm:grid-cols-2">
                    <DetailItem label="Tipo" value={<span className="rounded-full border px-2 py-1 text-xs font-bold capitalize">{quote.tipo}</span>} />
                    <DetailItem
                      label="Estado"
                      value={<QuoteStatusSelect quote={quote} canStatus={canStatus} onStatusChange={onStatusChange} />}
                    />
                    <DetailItem label="Cliente" value={<b>{quote.cliente}</b>} />
                    <DetailItem label="Creado por" value={<b>{quote.creadoPor}</b>} />
                    <DetailItem label="Fecha" value={formatDateTime(quote.createdAt)} />
                    <DetailItem label="Total" value={<b>{money(quote.total, currency)}</b>} />
                  </div>

                  <DetailSection title="Productos">
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[620px] text-sm">
                        <thead className="bg-slate-50 text-left">
                          <tr>
                            <th className="px-3 py-2">Nro. Parte</th>
                            <th>Producto</th>
                            <th>Cant.</th>
                            <th>P. Unit.</th>
                            <th>Desc.</th>
                            <th>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {quote.products.map((item) => {
                            const subtotal = Number(item.precioUnitario || 0) * Number(item.cantidad || 0);
                            const discount = subtotal * Number(item.descuentoPorcentaje || 0) / 100;
                            return (
                              <tr key={item.id}>
                                <td className="px-3 py-2 font-bold">{item.numeroParte || "-"}</td>
                                <td>{item.descripcion || "-"}</td>
                                <td>{item.cantidad}</td>
                                <td>{money(item.precioUnitario, currency)}</td>
                                <td className={discount ? "text-red-600" : "text-slate-500"}>{discount ? `-${money(discount, currency)}` : "-"}</td>
                                <td className="font-bold">{money(Math.max(subtotal - discount, 0), currency)}</td>
                              </tr>
                            );
                          })}
                          {!quote.products.length ? <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Sin productos.</td></tr> : null}
                        </tbody>
                      </table>
                    </div>
                  </DetailSection>

                  <DetailSection title="Mano de obra">
                    <div className="rounded-lg bg-slate-50 p-4">
                      <SummaryLine label="Tarifa" value={`${quote.tarifaNombre || "Mano de obra"} - ${money(quote.tarifaHora, currency)}/hr`} />
                      <SummaryLine label="Horas" value={Number(quote.horasTrabajo || 0).toFixed(2)} />
                      <SummaryLine label="Subtotal" value={money(quote.subtotalManoObra, currency)} strong />
                    </div>
                  </DetailSection>

                  <DetailSection title="Adicionales">
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[420px] text-sm">
                        <thead className="bg-slate-50 text-left"><tr><th className="px-3 py-2">Descripcion</th><th>Precio</th><th>Desc.</th><th>Total</th></tr></thead>
                        <tbody className="divide-y">
                          {quote.extras.map((item) => {
                            const discount = item.descuentoTipo === "monto" ? Number(item.descuentoValor || 0) : Number(item.monto || 0) * Number(item.descuentoValor || 0) / 100;
                            return (
                              <tr key={item.id}>
                                <td className="px-3 py-2">{item.descripcion}</td>
                                <td>{money(item.monto, currency)}</td>
                                <td className={discount ? "text-red-600" : "text-slate-500"}>{discount ? `-${money(discount, currency)}` : "-"}</td>
                                <td className="font-bold">{money(Math.max(Number(item.monto || 0) - discount, 0), currency)}</td>
                              </tr>
                            );
                          })}
                          {!quote.extras.length ? <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">Sin adicionales.</td></tr> : null}
                        </tbody>
                      </table>
                    </div>
                  </DetailSection>

                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <SummaryLine label="Subtotal productos" value={money(quote.subtotalProductos, currency)} />
                      <SummaryLine label="Subtotal mano de obra" value={money(quote.subtotalManoObra, currency)} />
                      <SummaryLine label="Subtotal adicionales" value={money(quote.subtotalExtras, currency)} />
                      <SummaryLine label="Desc. productos" value={`-${money(totals.productDiscount, currency)}`} />
                      <SummaryLine label="Desc. adicionales" value={`-${money(totals.extraDiscount, currency)}`} />
                      <SummaryLine label="Descuento total aplicado" value={`-${money(totals.generalDiscount, currency)}`} />
                      <SummaryLine label="IGV" value={quote.incluirIgv ? money(totals.tax, currency) : "-"} />
                      <SummaryLine label="TOTAL" value={money(quote.total, currency)} strong />
                    </div>
                  </div>
                </div>
              ) : (
                <QuoteViewsPanel quote={quote} />
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuoteViewsPanel({ quote }) {
  const views = quote.views || [];
  const lastView = views[0];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-bold text-blue-700">Total de Aperturas</p>
          <p className="mt-2 text-2xl font-black text-blue-900">{views.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-bold text-emerald-700">Ultima Apertura</p>
          <p className="mt-2 font-black text-emerald-900">{lastView ? formatDateTime(lastView.viewedAt) : "-"}</p>
        </div>
      </div>
      <h3 className="font-bold">Detalles de aperturas:</h3>
      <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
        {views.map((view, index) => (
          <div key={view.id} className={`rounded-lg border p-3 ${index % 2 === 0 ? "border-purple-200 bg-purple-50" : "border-slate-200 bg-white"}`}>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500"><CalendarClock className="mr-1 inline size-4" />Fecha y Hora</p>
                <p className="font-bold">{formatDateTime(view.viewedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Dispositivo</p>
                <p className="font-bold">{describeDevice(view.userAgent)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">IP</p>
                <p>{view.ipAddress || "-"}</p>
              </div>
            </div>
          </div>
        ))}
        {!views.length ? <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">Todavia no hay aperturas registradas.</div> : null}
      </div>
    </div>
  );
}

function QuoteStatusSelect({ quote, canStatus, onStatusChange }) {
  if (!canStatus) {
    return <span className="rounded-md border bg-white px-3 py-2 font-medium capitalize">{quote.estado}</span>;
  }
  return (
    <select
      value={quote.estado || "pendiente"}
      onChange={(event) => onStatusChange(quote.id, event.target.value)}
      className="h-10 min-w-40 rounded-md border bg-white px-3 text-sm font-medium text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    >
      <option value="pendiente">Pendiente</option>
      <option value="aprobada">Aprobada</option>
      <option value="rechazada">Rechazada</option>
    </select>
  );
}

function calculateQuoteDisplayTotals(quote) {
  const productDiscount = quote.products.reduce((sum, item) => sum + (Number(item.precioUnitario || 0) * Number(item.cantidad || 0) * Number(item.descuentoPorcentaje || 0) / 100), 0);
  const extraDiscount = quote.extras.reduce((sum, item) => {
    const amount = Number(item.monto || 0);
    return sum + (item.descuentoTipo === "monto" ? Number(item.descuentoValor || 0) : amount * Number(item.descuentoValor || 0) / 100);
  }, 0);
  const base = Number(quote.subtotalProductos || 0) + Number(quote.subtotalManoObra || 0) + Number(quote.subtotalExtras || 0);
  const generalDiscount = Number(quote.descuentoMonto || 0) + base * Number(quote.descuentoPorcentaje || 0) / 100;
  const taxable = Math.max(base - generalDiscount, 0);
  const tax = quote.incluirIgv ? taxable * Number(quote.impuestoPorcentaje || 0) / 100 : 0;
  return { productDiscount, extraDiscount, generalDiscount, tax };
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
}

function describeDevice(userAgent) {
  const agent = String(userAgent || "");
  const browser = agent.includes("Chrome") ? "Chrome" : agent.includes("Firefox") ? "Firefox" : agent.includes("Safari") ? "Safari" : "Navegador";
  const device = /Mobile|Android|iPhone/i.test(agent) ? "Movil" : "Escritorio";
  return `${device} - ${browser}`;
}

function DetailSection({ title, children }) {
  return <section className="space-y-3"><h3 className="font-bold text-slate-950">{title}</h3>{children}</section>;
}

function DetailItem({ label, value }) {
  return <div><p className="text-xs text-slate-500">{label}</p><div className="mt-1">{value}</div></div>;
}

export function QuoteForm({ tipo, options = {}, currentUser, initial, onCancel, onSubmit }) {
  const [form, setForm] = useState(() => ({
    clienteId: initial?.clienteId ? String(initial.clienteId) : "",
    centroId: initial?.centroId ? String(initial.centroId) : "",
    locationType: initial?.tallerId ? "taller" : "mostrador",
    tallerId: initial?.tallerId ? String(initial.tallerId) : "",
    mostradorId: initial?.mostradorId ? String(initial.mostradorId) : "",
    descripcion: initial?.descripcion || "",
    monedaId: initial?.monedaId ? String(initial.monedaId) : String(options.currencies?.[0]?.id || ""),
    impuestoId: initial?.impuestoId ? String(initial.impuestoId) : String(options.taxes?.[0]?.id || ""),
    incluirIgv: initial?.incluirIgv || false,
    impuestoPorcentaje: initial?.impuestoPorcentaje || Number(options.taxes?.[0]?.porcentaje || 0),
    tarifaId: initial?.tarifaId ? String(initial.tarifaId) : "",
    tarifaHora: initial?.tarifaHora || 0,
    horasTrabajo: initial?.horasTrabajo || 0,
    descuentoPorcentaje: initial?.descuentoPorcentaje || 0,
    descuentoMonto: initial?.descuentoMonto || 0,
    products: initial?.products?.map((item) => ({ ...item, productoId: String(item.productoId) })) || [],
    extras: initial?.extras || [],
    estado: initial?.estado || "pendiente",
  }));
  const [productSearch, setProductSearch] = useState("");
  const [extraDraft, setExtraDraft] = useState({ descripcion: "", monto: "" });
  const currency = options.currencies?.find((item) => String(item.id) === String(form.monedaId));
  const tax = options.taxes?.find((item) => String(item.id) === String(form.impuestoId));
  const workshopOptions = (options.workshops || []).filter((item) => !form.centroId || Number(item.centroId) === Number(form.centroId));
  const counterOptions = (options.counters || []).filter((item) => !form.centroId || Number(item.centroId) === Number(form.centroId));
  const totals = calculateTotals(form);
  const filteredProducts = (options.products || []).filter((item) => `${item.numeroParte} ${item.descripcion}`.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 8);

  function addProduct(product) {
    if (form.products.some((item) => Number(item.productoId) === Number(product.id))) return;
    setForm((old) => ({ ...old, products: [...old.products, { productoId: String(product.id), numeroParte: product.numeroParte, descripcion: product.descripcion, stock: product.stock, cantidad: 1, precioUnitario: product.precioVenta, descuentoPorcentaje: 0 }] }));
  }

  function submit() {
    if (!form.clienteId) return toast.error("Selecciona un cliente.");
    onSubmit({ ...form, tipo, tarifaId: form.tarifaId || null, monedaId: form.monedaId || null, impuestoId: form.impuestoId || null, impuestoPorcentaje: form.impuestoPorcentaje || 0 });
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 text-slate-950">
      <div className="mb-5 flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft className="size-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{initial ? "Editar" : "Nueva"} Cotización</h1>
          <p className="text-sm text-slate-500">Complete la información de la cotización ({tipo === "pyp" ? "PYP" : "Taller"})</p>
          <span className="mt-2 inline-flex rounded-md border bg-white px-3 py-1 text-sm font-medium capitalize">{tipo}</span>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card title="PASO 1 - Cliente y Ubicación">
            <Field label="Cliente">
              <SearchableSelect value={form.clienteId} options={(options.clients || []).map((item) => ({ value: item.id, label: item.nombre }))} placeholder="Buscar cliente" onChange={(value) => setForm((old) => ({ ...old, clienteId: value }))} />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Centro"><SearchableSelect value={form.centroId} options={(options.centers || []).map((item) => ({ value: item.id, label: item.nombre }))} placeholder="Centro" onChange={(value) => setForm((old) => ({ ...old, centroId: value, tallerId: "", mostradorId: "" }))} /></Field>
              <Field label="Tipo de ubicación"><SearchableSelect value={form.locationType} options={[{ value: "taller", label: "Taller" }, { value: "mostrador", label: "Mostrador" }]} onChange={(value) => setForm((old) => ({ ...old, locationType: value, tallerId: "", mostradorId: "" }))} /></Field>
              {form.locationType === "taller" ? <Field label="Taller"><SearchableSelect value={form.tallerId} options={workshopOptions.map((item) => ({ value: item.id, label: item.nombre }))} placeholder="Seleccionar taller" onChange={(value) => setForm((old) => ({ ...old, tallerId: value, mostradorId: "" }))} /></Field> : <Field label="Mostrador"><SearchableSelect value={form.mostradorId} options={counterOptions.map((item) => ({ value: item.id, label: item.nombre }))} placeholder="Seleccionar mostrador" onChange={(value) => setForm((old) => ({ ...old, mostradorId: value, tallerId: "" }))} /></Field>}
            </div>
            <Field label="Descripción"><Textarea value={form.descripcion} placeholder="Notas o descripción de la cotización..." onChange={(event) => setForm((old) => ({ ...old, descripcion: event.target.value }))} /></Field>
          </Card>
          <Card title="PASO 2 - Productos">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar producto por número de parte o descripción..." className="pl-9" />
            </div>
            <div className="space-y-2">
              {filteredProducts.map((product) => <button key={product.id} type="button" onClick={() => addProduct(product)} className="flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"><span><b>{product.numeroParte}</b> {product.descripcion}</span><span>Stock: {product.stock} - {money(product.precioVenta, currency?.codigo || "S/")}</span></button>)}
            </div>
            <ItemsEditor form={form} setForm={setForm} currency={currency} />
          </Card>
          <Card title="PASO 3 - Mano de obra y Adicionales">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Mano de obra"><SearchableSelect value={form.tarifaId} options={(options.tariffs || []).map((item) => ({ value: item.id, label: `${item.nombre} - ${item.monedaCodigo || ""} ${item.precioHora}/hr` }))} placeholder="Seleccionar tarifa" onChange={(value) => { const tariff = options.tariffs?.find((item) => String(item.id) === String(value)); setForm((old) => ({ ...old, tarifaId: value, tarifaHora: tariff?.precioHora || 0, monedaId: tariff?.monedaId ? String(tariff.monedaId) : old.monedaId })); }} /></Field>
              <Field label="Horas de trabajo"><Input type="number" value={form.horasTrabajo} onChange={(event) => setForm((old) => ({ ...old, horasTrabajo: event.target.value }))} /></Field>
            </div>
            <div className="rounded-md bg-slate-50 p-3 text-right text-sm font-bold">Subtotal mano de obra: {money(totals.labor, currency?.codigo || "S/")}</div>
            <div className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
              <Input value={extraDraft.descripcion} placeholder="Descripción del adicional..." onChange={(event) => setExtraDraft((old) => ({ ...old, descripcion: event.target.value }))} />
              <Input value={extraDraft.monto} type="number" placeholder="Monto" onChange={(event) => setExtraDraft((old) => ({ ...old, monto: event.target.value }))} />
              <Button type="button" variant="outline" onClick={() => { if (!extraDraft.descripcion || !extraDraft.monto) return; setForm((old) => ({ ...old, extras: [...old.extras, { ...extraDraft, descuentoTipo: "porcentaje", descuentoValor: 0 }] })); setExtraDraft({ descripcion: "", monto: "" }); }}><Plus className="size-4" /></Button>
            </div>
            <ExtrasEditor form={form} setForm={setForm} currency={currency} />
          </Card>
        </div>
        <aside className="h-fit rounded-xl border bg-white p-4 shadow-sm xl:sticky xl:top-4">
          <h2 className="text-lg font-bold">Resumen</h2>
          <p className="text-xs text-slate-500">Vista rápida de la cotización</p>
          <div className="mt-4 space-y-3 text-sm">
            <p>Creado por<br /><b>{currentUser?.name || "-"}</b></p>
            <p>Tipo<br /><span className="rounded-full border px-2 py-1 text-xs font-bold capitalize">{tipo}</span></p>
            <Panel title="Moneda e Impuesto">
              <Field label="Moneda"><SearchableSelect value={form.monedaId} options={(options.currencies || []).map((item) => ({ value: item.id, label: `${item.codigo} - ${item.nombre} (${item.simbolo})` }))} onChange={(value) => setForm((old) => ({ ...old, monedaId: value }))} /></Field>
              <Field label="Impuesto"><SearchableSelect value={form.impuestoId} options={(options.taxes || []).map((item) => ({ value: item.id, label: `${item.nombre} (${item.porcentaje}%)` }))} onChange={(value) => { const next = options.taxes?.find((item) => String(item.id) === String(value)); setForm((old) => ({ ...old, impuestoId: value, impuestoPorcentaje: next?.porcentaje || 0 })); }} /></Field>
              <label className="flex items-center justify-between text-sm font-bold">Aplicar IGV <Switch checked={form.incluirIgv} onCheckedChange={(checked) => setForm((old) => ({ ...old, incluirIgv: checked }))} /></label>
            </Panel>
            <Panel title="Descuento General">
              <div className="grid grid-cols-2 gap-2"><Field label="%"><Input type="number" value={form.descuentoPorcentaje} onChange={(event) => setForm((old) => ({ ...old, descuentoPorcentaje: event.target.value }))} /></Field><Field label="Monto"><Input type="number" value={form.descuentoMonto} onChange={(event) => setForm((old) => ({ ...old, descuentoMonto: event.target.value }))} /></Field></div>
            </Panel>
            <hr />
            <SummaryLine label="Subtotal productos" value={money(totals.products, currency?.codigo || "S/")} />
            <SummaryLine label="Subtotal mano de obra" value={money(totals.labor, currency?.codigo || "S/")} />
            <SummaryLine label="Subtotal adicionales" value={money(totals.extras, currency?.codigo || "S/")} />
            <SummaryLine label="TOTAL" value={money(totals.total, currency?.codigo || "S/")} strong />
          </div>
        </aside>
      </div>
      <div className="mt-6 flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={submit}>Guardar cotización</Button>
      </div>
    </div>
  );
}

function calculateTotals(form) {
  const products = form.products.reduce((sum, item) => {
    const subtotal = Number(item.precioUnitario || 0) * Number(item.cantidad || 1);
    return sum + Math.max(subtotal - subtotal * Number(item.descuentoPorcentaje || 0) / 100, 0);
  }, 0);
  const labor = Number(form.tarifaHora || 0) * Number(form.horasTrabajo || 0);
  const extras = form.extras.reduce((sum, item) => {
    const monto = Number(item.monto || 0);
    const discount = item.descuentoTipo === "monto" ? Number(item.descuentoValor || 0) : monto * Number(item.descuentoValor || 0) / 100;
    return sum + Math.max(monto - discount, 0);
  }, 0);
  const base = products + labor + extras;
  const discount = Number(form.descuentoMonto || 0) + base * Number(form.descuentoPorcentaje || 0) / 100;
  const taxable = Math.max(base - discount, 0);
  const tax = form.incluirIgv ? taxable * Number(form.impuestoPorcentaje || 0) / 100 : 0;
  return { products, labor, extras, total: taxable + tax };
}

function ItemsEditor({ form, setForm, currency }) {
  return <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="px-3 py-3">Nro. Parte</th><th>Producto</th><th>Stock</th><th>Cant.</th><th>P. Unit.</th><th>Desc. %</th><th>Subtotal</th><th /></tr></thead><tbody className="divide-y">{form.products.map((item, index) => { const subtotal = Number(item.precioUnitario || 0) * Number(item.cantidad || 1); const total = subtotal - subtotal * Number(item.descuentoPorcentaje || 0) / 100; return <tr key={`${item.productoId}-${index}`}><td className="px-3 py-3">{item.numeroParte}</td><td>{item.descripcion}</td><td>{item.stock}</td><td><Input className="w-20" type="number" value={item.cantidad} onChange={(event) => setForm((old) => ({ ...old, products: old.products.map((row, rowIndex) => rowIndex === index ? { ...row, cantidad: event.target.value } : row) }))} /></td><td>{money(item.precioUnitario, currency?.codigo || "S/")}</td><td><Input className="w-20" type="number" value={item.descuentoPorcentaje || 0} onChange={(event) => setForm((old) => ({ ...old, products: old.products.map((row, rowIndex) => rowIndex === index ? { ...row, descuentoPorcentaje: event.target.value } : row) }))} /></td><td className="font-bold">{money(total, currency?.codigo || "S/")}</td><td><Button variant="ghost" size="icon" onClick={() => setForm((old) => ({ ...old, products: old.products.filter((_, rowIndex) => rowIndex !== index) }))}><X className="size-4 text-red-600" /></Button></td></tr>; })}{!form.products.length ? <tr><td colSpan={8} className="py-8 text-center text-slate-500">Sin productos.</td></tr> : null}</tbody></table></div>;
}

function ExtrasEditor({ form, setForm, currency }) {
  return <div className="space-y-2">{form.extras.map((item, index) => <div key={`${item.descripcion}-${index}`} className="grid gap-2 rounded-md border bg-white p-2 md:grid-cols-[1fr_120px_140px_120px_auto]"><Input value={item.descripcion} onChange={(event) => setForm((old) => ({ ...old, extras: old.extras.map((row, rowIndex) => rowIndex === index ? { ...row, descripcion: event.target.value } : row) }))} /><Input type="number" value={item.monto} onChange={(event) => setForm((old) => ({ ...old, extras: old.extras.map((row, rowIndex) => rowIndex === index ? { ...row, monto: event.target.value } : row) }))} /><SearchableSelect value={item.descuentoTipo || "porcentaje"} options={[{ value: "porcentaje", label: "Porcentaje" }, { value: "monto", label: "Monto" }]} onChange={(value) => setForm((old) => ({ ...old, extras: old.extras.map((row, rowIndex) => rowIndex === index ? { ...row, descuentoTipo: value } : row) }))} /><Input type="number" value={item.descuentoValor || 0} onChange={(event) => setForm((old) => ({ ...old, extras: old.extras.map((row, rowIndex) => rowIndex === index ? { ...row, descuentoValor: event.target.value } : row) }))} /><Button variant="ghost" size="icon" onClick={() => setForm((old) => ({ ...old, extras: old.extras.filter((_, rowIndex) => rowIndex !== index) }))}><Trash2 className="size-4 text-red-600" /></Button><p className="text-xs font-bold text-slate-500 md:col-span-5">Subtotal: {money(item.monto, currency?.codigo || "S/")}</p></div>)}</div>;
}

async function shareLink(id) {
  const result = await postventaQuotesApi.update(id, { action: "public-token" });
  const url = `${window.location.origin}/cotizacion-posventa/${result.token}`;
  await navigator.clipboard?.writeText(url);
  toast.success("Enlace publico copiado");
}

async function downloadPdf(id) {
  const { quote } = await postventaQuotesApi.detail(id);
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF("p", "mm", "a4");
  let y = 16;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(18); pdf.text("Cotizacion PosVenta", 14, y); y += 8;
  pdf.setFontSize(10); pdf.text(`Cliente: ${quote.cliente}`, 14, y); y += 6; pdf.text(`Creado por: ${quote.creadoPor}`, 14, y); y += 8;
  pdf.setFont("helvetica", "bold"); pdf.text("Productos", 14, y); y += 6; pdf.setFont("helvetica", "normal");
  quote.products.forEach((item) => { pdf.text(`${item.numeroParte} ${item.descripcion} x${item.cantidad} - ${money(item.subtotal, quote.monedaCodigo || "S/")}`, 14, y); y += 6; });
  y += 4; pdf.setFont("helvetica", "bold"); pdf.text("Adicionales", 14, y); y += 6; pdf.setFont("helvetica", "normal");
  quote.extras.forEach((item) => { pdf.text(`${item.descripcion} - ${money(item.monto, quote.monedaCodigo || "S/")}`, 14, y); y += 6; });
  y += 6; pdf.setFont("helvetica", "bold"); pdf.text(`TOTAL: ${money(quote.total, quote.monedaCodigo || "S/")}`, 14, y);
  pdf.save(`cotizacion-posventa-${quote.id}.pdf`);
}

function Card({ title, children }) { return <section className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="mb-5 font-bold">{title}</h2><div className="space-y-4">{children}</div></section>; }
function Panel({ title, children }) { return <div className="rounded-lg border p-3"><h3 className="mb-3 font-bold">{title}</h3><div className="space-y-3">{children}</div></div>; }
function Field({ label, children }) { return <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-950">{label}</Label>{children}</div>; }
function SummaryLine({ label, value, strong }) { return <div className={`flex justify-between ${strong ? "text-lg font-bold" : ""}`}><span>{label}</span><span className={strong ? "text-emerald-700" : ""}>{value}</span></div>; }
function Status({ estado }) { return <span className="rounded-full border border-yellow-300 bg-yellow-50 px-2 py-1 text-xs font-bold capitalize text-yellow-700">{estado}</span>; }
