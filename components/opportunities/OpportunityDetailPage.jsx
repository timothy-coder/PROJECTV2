"use client";

import { useState } from "react";
import { Calendar, Copy, Eye, FileText, Gift, Link, MessageSquare, MoreVertical, Package, Pencil, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useOpportunityDetail } from "@/hooks/opportunities/useOpportunityDetail";
import { hasPerm } from "@/lib/permissions";

export default function OpportunityDetailPage({ id }) {
  const { data, loading, save } = useOpportunityDetail(id);
  const [dialog, setDialog] = useState({ type: "", item: null });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [activity, setActivity] = useState("");
  const [agenda, setAgenda] = useState({ fechaAgenda: "", horaAgenda: "" });
  if (loading || !data) return <div className="p-4">Cargando...</div>;
  const { opportunity, stages, details, activities, interest, quotes, testDrives, closures, reservations, options, currentUser } = data;
  const currentIndex = stages.findIndex((stage) => stage.id === opportunity.etapaId);
  const temperature = stages.slice(0, currentIndex + 1).reduce((sum, stage) => sum + Number(stage.temp || 0), 0);
  const newStage = stages.find((stage) => stage.nombre.toLowerCase() === "nuevo");
  return (
    <TooltipProvider>
      <div className="min-h-full bg-slate-50 p-3 text-slate-950 sm:p-4">
        <header className="sticky top-0 z-40 mb-3 border-b border-slate-200 bg-white p-3 shadow-sm sm:mb-4 sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-sm font-bold leading-tight sm:text-base">{opportunity.clienteNombre}</h1>
                <span className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-700">Temp. {temperature}%</span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{opportunity.code}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {currentUser.canViewAll && newStage ? (
                <Button variant="outline" size="sm" className="hidden border-orange-300 text-xs text-orange-600 sm:inline-flex" onClick={() => save({ action: "stage", etapaId: newStage.id, skipAutoAttention: true })}>
                  <RotateCcw className="size-3.5" />Inicio
                </Button>
              ) : null}
              <Button variant="ghost" size="icon" onClick={() => history.back()}>x</Button>
            </div>
          </div>
          {currentUser.canViewAll && newStage ? (
            <Button variant="outline" size="sm" className="mb-3 w-full border-orange-300 text-xs text-orange-600 sm:hidden" onClick={() => save({ action: "stage", etapaId: newStage.id, skipAutoAttention: true })}>
              <RotateCcw className="size-3.5" />Devolver al inicio
            </Button>
          ) : null}
          <div className="-mx-1 flex min-w-0 overflow-x-auto px-1 pb-1 sm:overflow-visible">
            {stages.map((stage, index) => (
              <div key={stage.id} className="flex shrink-0 items-center sm:flex-1 sm:shrink">
                <span className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-bold sm:w-full sm:text-center ${index <= currentIndex ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {stage.nombre}
                </span>
                {index < stages.length - 1 ? <span className={`h-0.5 w-5 shrink-0 sm:w-6 ${index < currentIndex ? "bg-emerald-400" : "bg-slate-300"}`} /> : null}
              </div>
            ))}
          </div>
        </header>
        <InfoSection opportunity={opportunity} />
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <ActivitySection activity={activity} setActivity={setActivity} activities={activities} onSubmit={async () => { if (activity.trim()) { await save({ action: "activity", detalle: activity.trim() }); setActivity(""); } }} />
          <AgendaSection details={details} agenda={agenda} setAgenda={setAgenda} onSubmit={async () => { if (agenda.fechaAgenda && agenda.horaAgenda) { await save({ action: "agenda", ...agenda }); setAgenda({ fechaAgenda: "", horaAgenda: "" }); } }} />
        </div>
        <InterestSection items={interest} onOpen={(item) => setDialog({ type: "interest", item })} onQuote={(item) => setDialog({ type: "quote", item })} onDelete={(item) => setConfirmDelete({ title: "Eliminar vehiculo de interes", description: `${item.marca || ""} ${item.modelo || ""}`.trim() || "Este vehiculo de interes", onConfirm: () => save({ action: "interest", deleteId: item.id }) })} />
        <QuotesSection items={quotes} options={options} userPermissions={currentUser.permissions || {}} onOpen={() => setDialog({ type: "quote", item: null })} onEdit={(item) => setDialog({ type: "quote", item })} onAction={save} onConfirmDelete={setConfirmDelete} />
        <ReservationsSection items={reservations || []} onDelete={(item) => setConfirmDelete({ title: "Eliminar reserva", description: `Reserva ID ${item.id}`, onConfirm: () => save({ action: "reservation-delete", reservaId: item.id }) })} />
        <TestDriveSection items={testDrives} onOpen={(item = null) => setDialog({ type: "testdrive", item })} onAction={(payload) => save({ action: "testdrive", ...payload })} />
        <ClosureSection items={closures} onOpen={() => setDialog({ type: "closure", item: null })} />
        {confirmDelete ? <ConfirmDeleteDialog state={confirmDelete} onClose={() => setConfirmDelete(null)} /> : null}
        {dialog.type === "interest" ? <InterestDialog state={dialog} clientId={opportunity.clienteId} options={options} onClose={() => setDialog({ type: "", item: null })} onSubmit={(payload) => save({ action: "interest", ...payload })} /> : null}
        {dialog.type === "quote" ? <EditableQuoteDialog state={dialog} options={options} onClose={() => setDialog({ type: "", item: null })} onSubmit={(payload) => save({ action: "quote", ...payload })} /> : null}
        {dialog.type === "testdrive" ? <TestDriveDialog state={dialog} options={options} onClose={() => setDialog({ type: "", item: null })} onSubmit={(payload) => save({ action: "testdrive", ...payload })} /> : null}
        {dialog.type === "closure" ? <ClosureDialog options={options} onClose={() => setDialog({ type: "", item: null })} onSubmit={(payload) => save({ action: "closure", ...payload })} /> : null}
      </div>
    </TooltipProvider>
  );
}

function InfoSection({ opportunity }) {
  const rows = [["CLIENTE", opportunity.clienteNombre], ["CODIGO", opportunity.code], ["ORIGEN", opportunity.origenNombre], ["SUBORIGEN", opportunity.suborigenNombre || "-"], ["ASIGNADO A", opportunity.asignadoNombre], ["CORREO", opportunity.email || "-"], ["CELULAR", opportunity.celular || "-"], ["DNI", opportunity.dni || "-"]];
  return <section className="mb-3 rounded-lg bg-white p-3 shadow-sm sm:p-4"><h2 className="mb-3 text-sm font-bold sm:text-base">Informacion General</h2><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">{rows.map(([k, v]) => <div key={k} className="min-w-0 rounded-md bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold text-slate-500">{k}</p><p className="truncate text-xs font-semibold text-slate-900 sm:text-sm">{v}</p></div>)}</div></section>;
}
function ActivitySection({ activity, setActivity, activities, onSubmit }) {
  const rows = [...activities].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50 p-3 sm:p-4">
      <h2 className="mb-2 flex gap-2 text-sm font-bold text-blue-900 sm:text-base"><MessageSquare className="size-4" />Registrar nueva actividad</h2>
      <Textarea className="min-h-24 bg-white text-sm" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Describe que accion se realizo..." />
      <Button className="mt-2 w-full" disabled={!activity.trim()} onClick={onSubmit}>Guardar actividad</Button>
      <div className="mt-3 border-t border-blue-200 pt-3">
        <h3 className="mb-2 text-xs font-bold text-blue-900">Historial de actividades ({rows.length})</h3>
        <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
          {rows.length ? rows.map((a) => <Tooltip key={a.id}><TooltipTrigger className="w-full"><div className="w-full rounded border bg-white p-3 text-left text-sm">{a.detalle}</div></TooltipTrigger><TooltipContent>{a.userName} - {formatDateTimeEs(a.createdAt)}</TooltipContent></Tooltip>) : <div className="w-full rounded border border-dashed bg-white p-5 text-center text-sm text-slate-500">No hay actividades</div>}
        </div>
      </div>
    </section>
  );
}
function AgendaSection({ details, agenda, setAgenda, onSubmit }) {
  const rows = [...details].sort((a, b) => new Date(b.createdAt || b.fechaAgenda || 0) - new Date(a.createdAt || a.fechaAgenda || 0));
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
      <h2 className="mb-2 flex gap-2 text-sm font-bold text-emerald-900 sm:text-base"><Calendar className="size-4" />Registrar nueva agenda</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Fecha de agenda"><Input type="date" value={agenda.fechaAgenda} onChange={(event) => setAgenda((current) => ({ ...current, fechaAgenda: event.target.value }))} /></Field>
        <Field label="Hora de agenda"><Input type="time" value={agenda.horaAgenda} onChange={(event) => setAgenda((current) => ({ ...current, horaAgenda: event.target.value }))} /></Field>
      </div>
      <Button className="mt-2 w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={!agenda.fechaAgenda || !agenda.horaAgenda} onClick={onSubmit}>Guardar agenda</Button>
      <div className="mt-3 border-t border-emerald-200 pt-3">
        <h3 className="mb-2 text-xs font-bold text-emerald-900">Historial de agenda ({rows.length})</h3>
        <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
          {rows.map((d) => <div key={d.id} className="rounded-lg border border-emerald-200 bg-white p-3 text-sm"><p className="font-bold">{formatDateEs(d.fechaAgenda)} - {formatTimeEs(d.horaAgenda)}</p></div>)}
          {!rows.length ? <div className="rounded border border-dashed bg-white p-5 text-center text-sm text-slate-500">No hay agendas registradas</div> : null}
        </div>
      </div>
    </section>
  );
}
function History({ activities }) { return <section className="rounded-lg bg-white p-3 shadow-sm sm:p-4"><h2 className="mb-2 text-sm font-bold sm:text-base">Historial de actividades ({activities.length})</h2><div className="max-h-72 space-y-2 overflow-y-auto pr-1">{activities.length ? activities.map((a) => <Tooltip key={a.id}><TooltipTrigger className="w-full"><div className="w-full rounded border bg-white p-3 text-left text-sm">{a.detalle}</div></TooltipTrigger><TooltipContent>{a.userName} - {formatDateTimeEs(a.createdAt)}</TooltipContent></Tooltip>) : <div className="w-full rounded border border-dashed p-5 text-center text-sm text-slate-500">No hay actividades</div>}</div></section>; }
function formatDateEs(value) {
  if (!value) return "-";
  const rawValue = String(value);
  const weekdays = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const raw = rawValue.match(/\d{4}-\d{2}-\d{2}/)?.[0] || rawValue.slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const english = rawValue.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s+(\d{4}))?/i);
    if (english) {
      const weekdayMap = { Sun: "domingo", Mon: "lunes", Tue: "martes", Wed: "miercoles", Thu: "jueves", Fri: "viernes", Sat: "sabado" };
      const monthMap = { Jan: "enero", Feb: "febrero", Mar: "marzo", Apr: "abril", May: "mayo", Jun: "junio", Jul: "julio", Aug: "agosto", Sep: "septiembre", Oct: "octubre", Nov: "noviembre", Dec: "diciembre" };
      const weekday = weekdayMap[english[1].slice(0, 3)] || english[1];
      const month = monthMap[english[2].slice(0, 3)] || english[2];
      return `${weekday}, ${String(Number(english[3])).padStart(2, "0")} de ${month}${english[4] ? ` de ${english[4]}` : ""}`;
    }
    return raw || "-";
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return raw;
  return `${weekdays[date.getDay()]}, ${String(date.getDate()).padStart(2, "0")} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}
function formatTimeEs(value) {
  if (!value) return "-";
  return String(value).slice(0, 5);
}
function formatDateTimeEs(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function InterestSection({ items, onOpen, onQuote, onDelete }) {
  const [openMenu, setOpenMenu] = useState(null);
  const runMobile = (action) => {
    action();
    setOpenMenu(null);
  };
  return (
    <section className="mb-4 rounded-lg bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold sm:text-lg">Vehiculos de Interes</h2>
        <Button onClick={() => onOpen(null)}><Plus className="size-4" />Agregar</Button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="relative flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="truncate font-bold">{item.marca} {item.modelo}</p>
              <p className="text-sm text-slate-500">{item.anio_interes || "-"}</p>
            </div>
            <div className="hidden gap-2 sm:flex">
              <Button variant="outline" onClick={() => onQuote(item)}>Cotizar</Button>
              <Button variant="outline" onClick={() => onOpen(item)}>Editar</Button>
              <Button variant="destructive" onClick={() => onDelete(item)}><Trash2 className="size-4" /></Button>
            </div>
            <div className="sm:hidden">
              <Button size="icon" variant="outline" onClick={() => setOpenMenu((current) => current === item.id ? null : item.id)}><MoreVertical className="size-4" /></Button>
              {openMenu === item.id ? (
                <div className="absolute right-3 top-12 z-30 w-40 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-xl">
                  <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-medium hover:bg-slate-100" onClick={() => runMobile(() => onQuote(item))}>Cotizar</button>
                  <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-medium hover:bg-slate-100" onClick={() => runMobile(() => onOpen(item))}>Editar</button>
                  <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-medium text-red-600 hover:bg-red-50" onClick={() => runMobile(() => onDelete(item))}>Eliminar</button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {!items.length ? <div className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">No hay vehiculos de interes.</div> : null}
      </div>
    </section>
  );
}

function ReservationsSection({ items, onDelete }) {
  const [openMenu, setOpenMenu] = useState(null);
  const runMobile = (action) => {
    action();
    setOpenMenu(null);
  };
  return (
    <section className="mb-4 rounded-lg bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><FileText className="size-5" />Reservas</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="relative flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="min-w-0">
              <p className="font-bold text-emerald-800">Reserva creada el {new Date(item.createdAt).toLocaleDateString("es-PE")}</p>
              <p className="text-xs font-medium text-emerald-700">N°: {item.id} - {item.estado}</p>
            </div>
            <div className="hidden gap-2 sm:flex">
              <Button size="icon" variant="outline" className="border-emerald-300 text-emerald-700" onClick={() => window.open(`/reservas/${item.id}`, "_blank")}><Eye className="size-4" /></Button>
              <Button size="icon" variant="destructive" onClick={() => onDelete(item)}><Trash2 className="size-4" /></Button>
            </div>
            <div className="sm:hidden">
              <Button size="icon" variant="outline" onClick={() => setOpenMenu((current) => current === item.id ? null : item.id)}><MoreVertical className="size-4" /></Button>
              {openMenu === item.id ? (
                <div className="absolute right-3 top-12 z-30 w-40 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-xl">
                  <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-medium hover:bg-slate-100" onClick={() => runMobile(() => window.open(`/reservas/${item.id}`, "_blank"))}>Ver reserva</button>
                  <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-medium text-red-600 hover:bg-red-50" onClick={() => runMobile(() => onDelete(item))}>Eliminar</button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {!items.length ? <div className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">No hay reservas creadas.</div> : null}
      </div>
    </section>
  );
}

function ConfirmDeleteDialog({ state, onClose }) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">Esta accion no se puede deshacer.</p>
          <p className="mt-1">{state.description}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>Cancelar</Button>
          <Button
            type="button"
            variant="destructive"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              await state.onConfirm();
              setSubmitting(false);
              onClose();
            }}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuotesSection({ items, options, userPermissions, onOpen, onEdit, onAction, onConfirmDelete }) {
  const [actionMenu, setActionMenu] = useState(null);
  const [itemsDialog, setItemsDialog] = useState(null);
  const [viewsDialog, setViewsDialog] = useState(null);
  const [tcDialog, setTcDialog] = useState(null);
  const [tcValue, setTcValue] = useState("");
  const canFord = hasPerm(userPermissions, ["cotizacion_ford", "view"]);
  const canOther = hasPerm(userPermissions, ["cotizacion_otros", "view"]);
  function downloadQuotePdf(quote, full = false, format = "ford", tc = "") {
    const link = document.createElement("a");
    const params = new URLSearchParams();
    if (full) params.set("full", "1");
    if (format === "otros") params.set("format", "otros");
    if (format === "otros" && tc) params.set("tc", tc);
    link.href = `/api/cotizacion-preview/${quote.id}/ford-pdf${params.toString() ? `?${params.toString()}` : ""}`;
    link.download = `${format === "otros" ? "cotizacion-otros" : "cotizacion"}${full ? "-completa" : ""}-${quote.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  function requestOtherPdf(quote, full = false) {
    setTcValue("");
    setTcDialog({ quote, full });
  }
  function confirmOtherPdf() {
    if (!tcValue.trim()) return;
    downloadQuotePdf(tcDialog.quote, tcDialog.full, "otros", tcValue.trim());
    setTcDialog(null);
  }
  async function publicLink(quote) {
    if (!quote.publicUrl) await onAction({ action: "quote-public-link", cotizacionId: quote.id });
    else window.open(quote.publicUrl, "_blank", "noopener,noreferrer");
  }
  async function copyLink(quote) {
    if (quote.publicUrl) await navigator.clipboard.writeText(`${window.location.origin}${quote.publicUrl}`);
  }
  return (
    <section className="mb-4 rounded-lg bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex gap-2 text-lg font-bold"><FileText className="size-5" />Cotizaciones</h2>
        <Button onClick={onOpen}><Plus className="size-4" />Agregar</Button>
      </div>
      <div className="overflow-visible rounded-lg border border-slate-200 sm:hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-600">
            <tr>
              <th className="px-2 py-2">Numero</th>
              <th>Marca Modelo y Version</th>
              <th className="px-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((q) => (
              <tr key={q.id} className={q.estado === "enviada" ? "bg-emerald-50" : "bg-white"}>
                <td className="px-2 py-2 text-[11px] font-bold text-blue-700">{q.number || `Q-${String(q.id).padStart(6, "0")}`}</td>
                <td className="py-2 pr-2 text-[11px] font-semibold leading-tight">{q.marca} {q.modelo} {q.version}</td>
                <td className="px-2 py-2 text-right">
                  <Button size="icon" variant="outline" onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setActionMenu({ quote: q, top: Math.min(rect.bottom + 6, window.innerHeight - 360), left: Math.max(rect.right - 230, 8) });
                  }}><MoreVertical className="size-4" /></Button>
                </td>
              </tr>
            ))}
            {!items.length ? <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={3}>No hay cotizaciones.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 sm:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-600">
            <tr>
              <th className="px-3 py-3">Numero</th>
              <th>Marca Modelo y Version</th>
              <th>Estado</th>
              <th>Fecha de creacion</th>
              <th>Vistas</th>
              <th>Previsualizacion</th>
              <th>Enlace Publico</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((q) => (
              <tr key={q.id} className={q.estado === "enviada" ? "bg-emerald-50" : "bg-white"}>
                <td className="px-3 py-3 font-bold text-blue-700">{q.number || `Q-${String(q.id).padStart(6, "0")}`}</td>
                <td>{q.marca} {q.modelo} {q.version}</td>
                <td><span className="rounded-full border bg-slate-50 px-2 py-1 text-xs font-bold">{q.estado}</span></td>
                <td>{new Date(q.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td><Button size="sm" variant="ghost" onClick={() => setViewsDialog(q)}><Eye className="size-4" />{q.totalViews || 0} vistas</Button></td>
                <td><Button size="icon" variant="ghost" onClick={() => window.open(`/cotizacion-preview/${q.id}`, "_blank")}><Eye className="size-4 text-violet-700" /></Button></td>
                <td>{q.publicUrl ? <Button size="sm" variant="ghost" onClick={() => publicLink(q)}><Link className="size-4 text-emerald-700" />Abrir</Button> : <Button size="sm" variant="outline" onClick={() => publicLink(q)}>Generar enlace</Button>}</td>
                <td className="px-3 py-3 text-right">
                  <Button size="icon" variant="outline" onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setActionMenu({ quote: q, top: Math.min(rect.bottom + 6, window.innerHeight - 360), left: Math.max(rect.right - 230, 8) });
                  }}><MoreVertical className="size-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {actionMenu ? (
        <QuoteActionsMenu
          state={actionMenu}
          onClose={() => setActionMenu(null)}
          onEdit={() => onEdit(actionMenu.quote)}
          onAccessory={() => setItemsDialog({ type: "accessory", quote: actionMenu.quote })}
          onGift={() => setItemsDialog({ type: "gift", quote: actionMenu.quote })}
          onReserve={() => onAction({ action: "quote-reserve", cotizacionId: actionMenu.quote.id })}
          onDuplicate={() => onAction({ action: "quote-duplicate", cotizacionId: actionMenu.quote.id })}
          onPreview={() => window.open(`/cotizacion-preview/${actionMenu.quote.id}`, "_blank")}
          canFord={canFord}
          canOther={canOther}
          onPdf={() => downloadQuotePdf(actionMenu.quote)}
          onFullPdf={() => downloadQuotePdf(actionMenu.quote, true)}
          onOtherPdf={() => requestOtherPdf(actionMenu.quote, false)}
          onOtherFullPdf={() => requestOtherPdf(actionMenu.quote, true)}
          onLink={() => actionMenu.quote.publicUrl ? copyLink(actionMenu.quote) : publicLink(actionMenu.quote)}
          onCancel={() => {
            const quote = actionMenu.quote;
            setActionMenu(null);
            onConfirmDelete({ title: "Cancelar cotizacion", description: quote.number || `Cotizacion ${quote.id}`, onConfirm: () => onAction({ action: "quote-cancel", cotizacionId: quote.id }) });
          }}
        />
      ) : null}
      {itemsDialog ? (
        <QuoteItemsDialog
          state={itemsDialog}
          options={options}
          onClose={() => setItemsDialog(null)}
          onSubmit={(payload) => onAction(payload)}
        />
      ) : null}
      {viewsDialog ? <QuoteViewsDialog quote={viewsDialog} onClose={() => setViewsDialog(null)} /> : null}
      <Dialog open={Boolean(tcDialog)} onOpenChange={(open) => !open && setTcDialog(null)}>
        <DialogContent className="max-w-sm bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Tipo de cambio</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="opportunity-quote-tc">TC para cotizacion otros</Label>
            <Input id="opportunity-quote-tc" value={tcValue} onChange={(event) => setTcValue(event.target.value)} placeholder="3.55" autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTcDialog(null)}>Cancelar</Button>
            <Button type="button" disabled={!tcValue.trim()} onClick={confirmOtherPdf}>Descargar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function QuoteViewsDialog({ quote, onClose }) {
  const views = quote.viewHistory || [];
  const lastView = views[0];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Historial de Aperturas</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-bold text-blue-700">Total de Aperturas</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-3xl font-bold text-blue-900">{views.length}</p>
              <Eye className="size-10 text-blue-200" />
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold text-emerald-700">Ultima Apertura</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-emerald-900">{lastView ? formatDateTime(lastView.fechaHora) : "-"}</p>
              <Calendar className="size-10 text-emerald-200" />
            </div>
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-bold">Detalles de aperturas:</h3>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {views.map((view, index) => (
              <div key={`${view.fechaHora}-${index}`} className={`rounded-lg border bg-white p-3 ${index % 2 === 0 ? "border-violet-200 bg-violet-50" : "border-slate-200"}`}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold text-slate-500">Fecha y Hora</p>
                    <p className="text-sm font-medium">{formatDateTime(view.fechaHora)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">Dispositivo</p>
                    <p className="text-sm font-medium">{deviceLabel(view.userAgent)}</p>
                    {view.ipAddress ? <p className="text-xs text-slate-500">IP: {view.ipAddress}</p> : null}
                  </div>
                </div>
              </div>
            ))}
            {!views.length ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">Sin aperturas registradas.</div> : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deviceLabel(userAgent = "") {
  const ua = String(userAgent);
  const browser = ua.includes("Edg/") ? "Edge" : ua.includes("Firefox/") ? "Firefox" : ua.includes("Chrome/") ? "Chrome" : ua.includes("Safari/") ? "Safari" : "Navegador";
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "Movil" : "Escritorio";
  return `${device} - ${browser}`;
}

function QuoteActionsMenu({ state, onClose, onEdit, onAccessory, onGift, onReserve, onDuplicate, onPreview, canFord, canOther, onPdf, onFullPdf, onOtherPdf, onOtherFullPdf, onLink, onCancel }) {
  const quote = state.quote;
  function run(action) {
    action();
    onClose();
  }
  return (
    <>
      <button type="button" aria-label="Cerrar menu" className="fixed inset-0 z-[90] cursor-default" onClick={onClose} />
      <div className="fixed z-[100] max-h-[min(340px,calc(100svh-1rem))] w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white text-slate-950 shadow-xl" style={{ top: state.top, left: state.left }}>
        <ActionButton icon={Pencil} label="Modificar" onClick={() => run(onEdit)} />
        <ActionButton icon={Package} label="Agregar Accesorios" onClick={() => run(onAccessory)} />
        <ActionButton icon={Gift} label="Agregar Regalos" onClick={() => run(onGift)} />
        <ActionButton icon={Send} label="Enviar Nota de Pedido" onClick={() => run(onReserve)} />
        <ActionButton icon={Copy} label="Duplicar" onClick={() => run(onDuplicate)} />
        <ActionButton icon={Eye} label="Ver cotizacion" onClick={() => run(onPreview)} />
        {canFord ? <ActionButton icon={FileText} label="Descargar PDF" onClick={() => run(onPdf)} /> : null}
        {canFord ? <ActionButton icon={FileText} label="Cotizacion + ficha tecnica" onClick={() => run(onFullPdf)} /> : null}
        {canOther ? <ActionButton icon={FileText} label="Descargar PDF" onClick={() => run(onOtherPdf)} /> : null}
        {canOther ? <ActionButton icon={FileText} label="Cotizacion + ficha tecnica" onClick={() => run(onOtherFullPdf)} /> : null}
        <ActionButton icon={Link} label={quote.publicUrl ? "Compartir enlace" : "Generar enlace publico"} onClick={() => run(onLink)} />
        <ActionButton icon={Trash2} label="Cancelar" danger onClick={() => run(onCancel)} />
      </div>
    </>
  );
}

function ActionButton({ icon: Icon, label, danger, onClick }) {
  return <button type="button" className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-100 ${danger ? "text-red-600" : "text-slate-700"}`} onClick={onClick}><Icon className="size-4" />{label}</button>;
}

function QuotePreview({ quote, onClose }) {
  const quoteBasePrice = Number(quote.precio_base ?? quote.catalogo_precio_base ?? 0);
  const vehicleDiscount = Number(quote.descuento_vehículo || 0) + (quoteBasePrice * Number(quote.descuento_vehículo_porcentaje || 0) / 100);
  const finalVehicle = quoteBasePrice - vehicleDiscount;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-5xl overflow-y-auto bg-white text-slate-950">
        <DialogHeader><DialogTitle>Resumen de Cotizacion</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <section className="rounded-lg border border-violet-200 bg-violet-50 p-4">
            <h3 className="mb-3 font-bold text-violet-700">Informacion General - Vehiculo</h3>
            <div className="grid gap-4 md:grid-cols-4"><Info label="Marca" value={quote.marca} /><Info label="Modelo" value={quote.modelo} /><Info label="Version" value={quote.version} /><Info label="Anio" value={quote.anio || "-"} /><Info label="Color Ext." value={quote.color_externo || "-"} /><Info label="Color Int." value={quote.color_interno || "-"} /><Info label="Dias de validez de la cotizacion" value={quote.sku || "N/A"} /><Info label="Estado" value={quote.estado} /></div>
          </section>
          <section className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <h3 className="mb-3 font-bold text-orange-800">Precio del Vehiculo</h3>
            <div className="grid gap-3 md:grid-cols-3"><Info label="Modelo/Version" value={`${quote.modelo} ${quote.version}`} /><Info label="Precio" value={`$${quoteBasePrice.toFixed(2)}`} /><Info label="Precio final" value={`$${finalVehicle.toFixed(2)}`} /></div>
          </section>
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="mb-3 font-bold text-emerald-800">Resumen General</h3>
            <p className="text-4xl font-bold text-emerald-700">${finalVehicle.toFixed(2)}</p>
          </section>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cerrar</Button><Button onClick={() => window.print()}>Descargar PDF</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }) {
  return <div><p className="text-xs font-bold text-slate-500">{label}</p><p className="font-bold">{value}</p></div>;
}

function EditableQuoteDialog({ options, onClose, onSubmit, state }) {
  const item = state?.item;
  const isQuote = Boolean(item?.precio_id || item?.precio_base);
  const initialPrice = item?.precio_base ?? item?.catalogo_precio_base ?? options.prices.find((p) => Number(p.id) === Number(item?.precio_id))?.precio_base ?? "";
  const [form, setForm] = useState({
    id: isQuote ? item.id : undefined,
    marcaId: item?.marca_id ? String(item.marca_id) : "",
    modeloId: item?.modelo_id ? String(item.modelo_id) : "",
    precioId: item?.precio_id ? String(item.precio_id) : "",
    anio: item?.anio_interes || item?.anio || "",
    sku: item?.sku || "",
    colorExterno: item?.color_externo || "",
    colorInterno: item?.color_interno || "",
    precioBase: initialPrice,
    tcReferencial: item?.tc_referencial ?? "",
    discountMode: Number(item?.["descuento_veh\u00edculo"] || 0) > 0 ? "amount" : "percentage",
    descuentoVehiculo: item?.["descuento_veh\u00edculo"] || 0,
    descuentoVehiculoPorcentaje: item?.["descuento_veh\u00edculo_porcentaje"] || 0,
  });
  const brandOptions = [...new Map(options.prices.map((p) => [p.marca_id, { value: p.marca_id, label: p.marca }])).values()];
  const modelOptions = [...new Map(options.prices.filter((p) => !form.marcaId || p.marca_id === Number(form.marcaId)).map((p) => [p.modelo_id, { value: p.modelo_id, label: p.modelo }])).values()];
  const versionRows = options.prices.filter((p) => (!form.marcaId || p.marca_id === Number(form.marcaId)) && (!form.modeloId || p.modelo_id === Number(form.modeloId)));
  const versionOptions = versionRows.map((p) => ({ value: p.id, label: p.version }));
  const selectedVersion = options.prices.find((p) => Number(p.id) === Number(form.precioId));
  const priceValue = Number(form.precioBase || 0);
  const discountAmount = form.discountMode === "amount" ? Number(form.descuentoVehiculo || 0) : priceValue * Number(form.descuentoVehiculoPorcentaje || 0) / 100;
  const finalPrice = Math.max(priceValue - discountAmount, 0);
  const payload = {
    ...form,
    precioBase: form.precioBase,
    tcReferencial: form.tcReferencial,
    descuentoVehiculo: form.discountMode === "amount" ? form.descuentoVehiculo : 0,
    descuentoVehiculoPorcentaje: form.discountMode === "percentage" ? form.descuentoVehiculoPorcentaje : 0,
  };
  const selectVersion = (value) => {
    const price = options.prices.find((p) => Number(p.id) === Number(value));
    setForm((f) => ({ ...f, precioId: value, precioBase: price?.precio_base ?? "" }));
  };
  return (
    <BaseDialog title={isQuote ? "Modificar cotización" : "Nueva cotizacion"} wide onClose={onClose} onSubmit={() => onSubmit(payload)}>
      <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_190px]">
          <div className="space-y-3">
            <h3 className="font-bold">Selecciona un vehiculo</h3>
            <Field label="Marca">
              <SearchableSelect value={form.marcaId} options={brandOptions} onChange={(v) => setForm((f) => ({ ...f, marcaId: v, modeloId: "", precioId: "", precioBase: "" }))} />
            </Field>
            <Field label="Modelo">
              <SearchableSelect value={form.modeloId} options={modelOptions} onChange={(v) => setForm((f) => ({ ...f, modeloId: v, precioId: "", precioBase: "" }))} />
            </Field>
            <Field label="Año">
              <Input value={form.anio} onChange={(e) => setForm((f) => ({ ...f, anio: e.target.value }))} />
            </Field>
            <Field label="Version">
              <SearchableSelect value={form.precioId} options={versionOptions} onChange={selectVersion} />
            </Field>
          </div>
          <div className="space-y-3">
            <h3 className="font-bold">Detalles editables</h3>
            <Field label="Precio base cotizacion ($)">
              <Input type="number" min="0" step="0.01" value={form.precioBase} onChange={(e) => setForm((f) => ({ ...f, precioBase: e.target.value }))} />
            </Field>
            <Field label="T.C. referencial">
              <Input type="number" min="0" step="0.0001" value={form.tcReferencial} onChange={(e) => setForm((f) => ({ ...f, tcReferencial: e.target.value }))} />
            </Field>
            <Field label="Dias de validez de la cotizacion">
              <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </Field>
            <Field label="Color externo">
              <Input value={form.colorExterno} onChange={(e) => setForm((f) => ({ ...f, colorExterno: e.target.value }))} />
            </Field>
            <Field label="Color interno">
              <Input value={form.colorInterno} onChange={(e) => setForm((f) => ({ ...f, colorInterno: e.target.value }))} />
            </Field>
          </div>
          <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
            <p className="text-xs font-bold text-slate-500">Precio catalogo</p>
            <p className="text-lg font-bold text-slate-800">${Number(selectedVersion?.precio_base || 0).toFixed(2)}</p>
            <p className="mt-4 text-xs font-bold text-slate-500">Precio cotizacion</p>
            <p className="text-lg font-bold text-blue-700">${priceValue.toFixed(2)}</p>
            <p className="mt-4 text-xs font-bold text-slate-500">Precio final</p>
            <p className="text-lg font-bold text-emerald-700">${finalPrice.toFixed(2)}</p>
            <p className="mt-4 text-xs text-slate-500">El precio editado se guarda solo en la cotizacion.</p>
          </div>
        </div>
      </div>
      <div className="mt-5 border-t pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Descuento del vehiculo</h3>
          <label className="flex items-center gap-2 text-sm">
            <span>%</span>
            <Switch checked={form.discountMode === "amount"} onCheckedChange={(checked) => setForm((f) => ({ ...f, discountMode: checked ? "amount" : "percentage" }))} />
            <span>{form.discountMode === "amount" ? "Monto ($)" : "Porcentaje (%)"}</span>
          </label>
        </div>
        {form.discountMode === "amount" ? (
          <Field label="Descuento en monto ($)">
            <Input type="number" min="0" step="0.01" value={form.descuentoVehiculo} onChange={(e) => setForm((f) => ({ ...f, descuentoVehiculo: e.target.value }))} />
          </Field>
        ) : (
          <Field label="Descuento en porcentaje (%)">
            <Input type="number" min="0" step="0.01" value={form.descuentoVehiculoPorcentaje} onChange={(e) => setForm((f) => ({ ...f, descuentoVehiculoPorcentaje: e.target.value }))} />
          </Field>
        )}
      </div>
    </BaseDialog>
  );
}

function QuoteItemsDialog({ state, options, onClose, onSubmit }) {
  const isAccessory = state.type === "accessory";
  const quote = state.quote;
  const rows = isAccessory
    ? (options.accessories || []).filter((item) => Number(item.marca_id) === Number(quote.marca_id) && Number(item.modelo_id) === Number(quote.modelo_id))
    : (options.gifts || []);
  const [selected, setSelected] = useState({});
  const totalSelected = Object.values(selected).filter((row) => row.checked).length;
  const title = isAccessory ? "Gestionar Accesorios" : "Gestionar Regalos";
  async function submit() {
    const rowsToSave = Object.values(selected).filter((row) => row.checked);
    for (const row of rowsToSave) {
      await onSubmit({
        action: isAccessory ? "quote-add-accessory" : "quote-add-gift",
        cotizacionId: quote.id,
        [isAccessory ? "accesorioId" : "regaloId"]: row.id,
        cantidad: row.cantidad || 1,
        descuentoMonto: row.descuentoMonto || 0,
      });
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-5xl overflow-y-auto bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>{title} - Cotizacion {quote.number}</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-bold text-slate-600">Vehiculo</p>
          <p className="font-bold">{quote.marca} {quote.modelo} {quote.version}</p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-3">Sel.</th>
                <th>Detalle</th>
                <th>{isAccessory ? "N Parte" : "Lote"}</th>
                <th>Precio Unit.</th>
                <th>Cant.</th>
                <th>Descuento</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const current = selected[row.id] || {};
                const unit = Number((isAccessory ? row.precio_venta ?? row.precio : row.precio_venta ?? row.precio_compra) || 0);
                const qty = Number(current.cantidad || 1);
                const discount = Number(current.descuentoMonto || 0);
                const total = Math.max(unit * qty - discount, 0);
                return (
                  <tr key={row.id}>
                    <td className="px-3 py-3"><Input className="size-4" type="checkbox" checked={Boolean(current.checked)} onChange={(e) => setSelected((old) => ({ ...old, [row.id]: { ...current, id: row.id, checked: e.target.checked } }))} /></td>
                    <td className="font-bold">{row.detalle}</td>
                    <td>{isAccessory ? row.numero_parte : row.lote || "-"}</td>
                    <td>${unit.toFixed(2)}</td>
                    <td><Input className="w-20" type="number" min="1" value={current.cantidad || 1} onChange={(e) => setSelected((old) => ({ ...old, [row.id]: { ...current, id: row.id, cantidad: e.target.value, checked: current.checked ?? true } }))} /></td>
                    <td><Input className="w-24" type="number" min="0" value={current.descuentoMonto || 0} onChange={(e) => setSelected((old) => ({ ...old, [row.id]: { ...current, id: row.id, descuentoMonto: e.target.value, checked: current.checked ?? true } }))} /></td>
                    <td className="font-bold text-blue-700">${total.toFixed(2)}</td>
                  </tr>
                );
              })}
              {!rows.length ? <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={7}>No hay registros disponibles.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
          <Button disabled={!totalSelected} onClick={async () => { await submit(); onClose(); }}>Agregar {totalSelected} {isAccessory ? "Accesorio(s)" : "Regalo(s)"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestDriveSection({ items, onOpen, onAction }) {
  const [openMenu, setOpenMenu] = useState(null);
  const setStatus = (item, estado) => onAction({
    id: item.id,
    fechaTestdrive: item.fechaTestdrive,
    horaInicio: item.horaInicio,
    horaFin: item.horaFin,
    modeloId: item.modelo_id ? String(item.modelo_id) : "",
    vin: item.vin || "",
    placa: item.placa || "",
    descripcion: item.descripcion || "",
    estado,
  });
  const runMobile = (action) => {
    action();
    setOpenMenu(null);
  };
  return (
    <section className="mb-4 rounded-lg bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold sm:text-lg">Test Drive</h2>
        <Button onClick={() => onOpen(null)}><Plus className="size-4" />Programar</Button>
      </div>
      <div className="space-y-2">
        {items.map((t) => (
          <div key={t.id} className="relative flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="font-bold">{formatDateEs(t.fechaTestdrive || t.fecha_testdrive)} - {formatTimeEs(t.horaInicio || t.hora_inicio)}{t.horaFin ? ` a ${formatTimeEs(t.horaFin)}` : ""}</p>
              <p className="mt-1 truncate text-sm text-slate-600">{t.modelo || "Sin modelo"}</p>
              <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{testDriveStatusLabel(t.estado)}</p>
            </div>
            <div className="hidden flex-wrap justify-end gap-2 sm:flex">
              <Button size="sm" variant="outline" onClick={() => onOpen(t)}><Pencil className="size-4" />Editar</Button>
              <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700" onClick={() => setStatus(t, "realizado")}>Realizado</Button>
              <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => setStatus(t, "cancelado")}>Cancelado</Button>
            </div>
            <div className="sm:hidden">
              <Button size="icon" variant="outline" onClick={() => setOpenMenu((current) => current === t.id ? null : t.id)}><MoreVertical className="size-4" /></Button>
              {openMenu === t.id ? (
                <div className="absolute right-3 top-12 z-30 w-44 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-xl">
                  <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-medium hover:bg-slate-100" onClick={() => runMobile(() => onOpen(t))}>Editar</button>
                  <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-medium text-emerald-700 hover:bg-emerald-50" onClick={() => runMobile(() => setStatus(t, "realizado"))}>Marcar realizado</button>
                  <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-medium text-red-600 hover:bg-red-50" onClick={() => runMobile(() => setStatus(t, "cancelado"))}>Marcar cancelado</button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {!items.length ? <div className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">No hay test drive programados.</div> : null}
      </div>
    </section>
  );
}
function testDriveStatusLabel(value) {
  const status = String(value || "programado").toLowerCase();
  if (status === "realizado") return "Realizado";
  if (status === "cancelado") return "Cancelado";
  return "Programado";
}
function ClosureSection({ items, onOpen }) { return <section className="mb-4 rounded-lg bg-white p-5 shadow-sm"><div className="mb-4 flex justify-between"><h2 className="text-lg font-bold">Cierres</h2><Button variant="destructive" onClick={onOpen}><Plus className="size-4" />Registrar cierre</Button></div>{items.map((c) => <div key={c.id} className="rounded border p-3">{c.detalle}</div>)}</section>; }

function InterestDialog({ state, clientId, options, onClose, onSubmit }) { const [form, setForm] = useState({ id: state.item?.id, clientId, marcaId: state.item?.marca_id || "", modeloId: state.item?.modelo_id || "", anioInteres: state.item?.anio_interes || "" }); const brands = options.brands.map((b) => ({ value: b.id, label: b.name })); const models = options.models.filter((m) => !form.marcaId || m.marca_id === Number(form.marcaId)).map((m) => ({ value: m.id, label: m.name })); return <BaseDialog title="Vehiculo de interes" onClose={onClose} onSubmit={() => onSubmit(form)}><Field label="Marca"><SearchableSelect value={form.marcaId} options={brands} onChange={(v) => setForm((f) => ({ ...f, marcaId: v, modeloId: "" }))} /></Field><Field label="Modelo"><SearchableSelect value={form.modeloId} options={models} onChange={(v) => setForm((f) => ({ ...f, modeloId: v }))} /></Field><Field label="Año"><Input value={form.anioInteres} onChange={(e) => setForm((f) => ({ ...f, anioInteres: e.target.value }))} /></Field></BaseDialog>; }
function QuoteDialog({ options, onClose, onSubmit, state }) { const item = state?.item; const isQuote = Boolean(item?.precio_id || item?.precio_base); const [form, setForm] = useState({ id: isQuote ? item.id : undefined, marcaId: item?.marca_id ? String(item.marca_id) : "", modeloId: item?.modelo_id ? String(item.modelo_id) : "", precioId: item?.precio_id ? String(item.precio_id) : "", anio: item?.anio_interes || item?.anio || "", sku: item?.sku || "", colorExterno: item?.color_externo || "", colorInterno: item?.color_interno || "", discountMode: Number(item?.["descuento_veh\u00edculo"] || 0) > 0 ? "amount" : "percentage", descuentoVehiculo: item?.["descuento_veh\u00edculo"] || 0, descuentoVehiculoPorcentaje: item?.descuento_vehículo_porcentaje || 0 }); const brandOptions = [...new Map(options.prices.map((p) => [p.marca_id, { value: p.marca_id, label: p.marca }])).values()]; const modelOptions = [...new Map(options.prices.filter((p) => !form.marcaId || p.marca_id === Number(form.marcaId)).map((p) => [p.modelo_id, { value: p.modelo_id, label: p.modelo }])).values()]; const versionOptions = options.prices.filter((p) => (!form.marcaId || p.marca_id === Number(form.marcaId)) && (!form.modeloId || p.modelo_id === Number(form.modeloId))).map((p) => ({ value: p.id, label: p.version })); const payload = { ...form, descuentoVehiculo: form.discountMode === "amount" ? form.descuentoVehiculo : 0, descuentoVehiculoPorcentaje: form.discountMode === "percentage" ? form.descuentoVehiculoPorcentaje : 0 }; return <BaseDialog title={isQuote ? "Modificar cotizacion" : "Nueva cotizacion"} wide onClose={onClose} onSubmit={() => onSubmit(payload)}><div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4"><div className="grid gap-4 md:grid-cols-[1fr_1fr_180px]"><div className="space-y-3"><h3 className="font-bold">Selecciona un vehiculo</h3><Field label="Marca"><SearchableSelect value={form.marcaId} options={brandOptions} onChange={(v) => setForm((f) => ({ ...f, marcaId: v, modeloId: "", precioId: "" }))} /></Field><Field label="Modelo"><SearchableSelect value={form.modeloId} options={modelOptions} onChange={(v) => setForm((f) => ({ ...f, modeloId: v, precioId: "" }))} /></Field><Field label="Año"><Input value={form.anio} onChange={(e) => setForm((f) => ({ ...f, anio: e.target.value }))} /></Field><Field label="Version"><SearchableSelect value={form.precioId} options={versionOptions} onChange={(v) => setForm((f) => ({ ...f, precioId: v }))} /></Field></div><div className="space-y-3"><h3 className="font-bold">Detalles</h3><Field label="Dias de validez de la cotizacion"><Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} /></Field><Field label="Color externo"><Input value={form.colorExterno} onChange={(e) => setForm((f) => ({ ...f, colorExterno: e.target.value }))} /></Field><Field label="Color interno"><Input value={form.colorInterno} onChange={(e) => setForm((f) => ({ ...f, colorInterno: e.target.value }))} /></Field></div><div className="flex min-h-56 items-center justify-center rounded-xl bg-slate-100 p-5 text-center font-bold text-slate-700">Vista<br />previa</div></div></div><div className="mt-5 border-t pt-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Descuento del vehiculo</h3><label className="flex items-center gap-2 text-sm"><span>%</span><Switch checked={form.discountMode === "amount"} onCheckedChange={(checked) => setForm((f) => ({ ...f, discountMode: checked ? "amount" : "percentage" }))} /><span>{form.discountMode === "amount" ? "Monto ($)" : "Porcentaje (%)"}</span></label></div>{form.discountMode === "amount" ? <Field label="Descuento en monto ($)"><Input type="number" value={form.descuentoVehiculo} onChange={(e) => setForm((f) => ({ ...f, descuentoVehiculo: e.target.value }))} /></Field> : <Field label="Descuento en porcentaje (%)"><Input type="number" value={form.descuentoVehiculoPorcentaje} onChange={(e) => setForm((f) => ({ ...f, descuentoVehiculoPorcentaje: e.target.value }))} /></Field>}</div></BaseDialog>; }
function TestDriveDialog({ state, options, onClose, onSubmit }) {
  const item = state.item;
  const [form, setForm] = useState({
    id: item?.id,
    fechaTestdrive: item?.fechaTestdrive || dateInputValue(item?.fecha_testdrive) || "",
    horaInicio: item?.horaInicio || timeInputValue(item?.hora_inicio),
    horaFin: item?.horaFin || timeInputValue(item?.hora_fin),
    modeloId: item?.modelo_id ? String(item.modelo_id) : "",
    vin: item?.vin || "",
    placa: item?.placa || "",
    descripcion: item?.descripcion || "",
    estado: item?.estado || "programado",
  });
  const models = options.models.map((m) => ({ value: m.id, label: m.name }));
  const submit = (estado = form.estado) => onSubmit({ ...form, estado });
  return (
    <BaseDialog title={item ? "Editar Test Drive" : "Programar Test Drive"} onClose={onClose} onSubmit={() => submit()}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fecha"><Input type="date" value={form.fechaTestdrive} onChange={(e) => setForm((f) => ({ ...f, fechaTestdrive: e.target.value }))} /></Field>
        <Field label="Hora inicio"><Input type="time" value={form.horaInicio} onChange={(e) => setForm((f) => ({ ...f, horaInicio: e.target.value }))} /></Field>
        <Field label="Hora fin"><Input type="time" value={form.horaFin} onChange={(e) => setForm((f) => ({ ...f, horaFin: e.target.value }))} /></Field>
        <Field label="Estado">
          <SearchableSelect value={form.estado} options={[{ value: "programado", label: "Programado" }, { value: "realizado", label: "Realizado" }, { value: "cancelado", label: "Cancelado" }]} onChange={(v) => setForm((f) => ({ ...f, estado: v }))} />
        </Field>
      </div>
      <Field label="Modelo"><SearchableSelect value={form.modeloId} options={models} onChange={(v) => setForm((f) => ({ ...f, modeloId: v }))} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Placa"><Input value={form.placa} onChange={(e) => setForm((f) => ({ ...f, placa: e.target.value }))} /></Field>
        <Field label="VIN"><Input value={form.vin} onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))} /></Field>
      </div>
      <Field label="Descripcion"><Textarea value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></Field>
      {item ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" className="border-emerald-300 text-emerald-700" onClick={() => { submit("realizado"); onClose(); }}>Marcar realizado</Button>
          <Button type="button" variant="outline" className="border-red-300 text-red-700" onClick={() => { submit("cancelado"); onClose(); }}>Marcar cancelado</Button>
        </div>
      ) : null}
    </BaseDialog>
  );
}
function dateInputValue(value) {
  if (!value) return "";
  return String(value).match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
}
function timeInputValue(value) {
  if (!value) return "";
  return String(value).match(/\d{2}:\d{2}/)?.[0] || "";
}
function ClosureDialog({ options, onClose, onSubmit }) { const [form, setForm] = useState({ detalle: "", cierreDetalleId: "" }); const opts = [{ value: "", label: "Sin clasificacion" }, ...options.closeOptions.map((o) => ({ value: o.id, label: o.detalle }))]; return <BaseDialog title="Registrar Cierre" onClose={onClose} onSubmit={() => onSubmit(form)}><Field label="Detalle del cierre"><Textarea value={form.detalle} onChange={(e) => setForm((f) => ({ ...f, detalle: e.target.value }))} /></Field><Field label="Clasificacion"><SearchableSelect value={form.cierreDetalleId} options={opts} onChange={(v) => setForm((f) => ({ ...f, cierreDetalleId: v }))} /></Field></BaseDialog>; }
function BaseDialog({ title, children, onClose, onSubmit, wide }) { return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className={`${wide ? "sm:max-w-[min(1180px,calc(100vw-3rem))] lg:max-w-[1180px]" : "sm:max-w-lg"} max-h-[92svh] overflow-y-auto bg-white text-slate-950`}><form onSubmit={(e) => { e.preventDefault(); onSubmit(); onClose(); }} className="space-y-3"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>{children}<DialogFooter className="sticky bottom-0 border-t bg-white pt-3"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Guardar</Button></DialogFooter></form></DialogContent></Dialog>; }
function Field({ label, children }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }
