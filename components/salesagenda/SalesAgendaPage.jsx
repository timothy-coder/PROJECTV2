"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSalesAgenda } from "@/hooks/salesagenda/useSalesAgenda";
import { hasPerm } from "@/lib/permissions";

const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const dayLabels = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

export default function SalesAgendaPage({ userPermissions }) {
  const data = useSalesAgenda();
  const canViewAll = Boolean(hasPerm(userPermissions, ["agenda", "viewall"]) || hasPerm(userPermissions, ["oportunidades", "viewall"]) || data.currentUser?.canViewAll);
  const canCreate = hasPerm(userPermissions, ["oportunidades", "create"]);
  const [nowTime] = useState(() => Date.now());
  const [baseDate, setBaseDate] = useState(new Date());
  const [mode, setMode] = useState("week");
  const [filters, setFilters] = useState({ createdBy: "", assignedTo: "", client: "", kind: "all", centerId: "" });
  const [dialog, setDialog] = useState(null);
  const centerId = filters.centerId || (data.centers[0]?.id ? String(data.centers[0].id) : "");
  const schedule = data.schedules.find((item) => String(item.centroId) === String(centerId)) || data.schedules[0] || { slotMinutes: 30, week: {} };
  const days = useMemo(
    () => filterActiveDays(mode === "month" ? monthDays(baseDate) : weekDays(baseDate), schedule.week),
    [baseDate, mode, schedule.week]
  );
  const slots = timeSlots(schedule.week, schedule.slotMinutes || 30);
  const filteredItems = useMemo(() => data.items.filter((item) => {
    const matchKind = filters.kind === "all" || item.kind === filters.kind;
    const matchCreated = !filters.createdBy || Number(item.createdBy) === Number(filters.createdBy);
    const matchAssigned = !filters.assignedTo || Number(item.asignadoA) === Number(filters.assignedTo);
    const matchClient = !filters.client || item.clienteNombre.toLowerCase().includes(filters.client.toLowerCase()) || item.code.toLowerCase().includes(filters.client.toLowerCase());
    return matchKind && matchCreated && matchAssigned && matchClient;
  }), [data.items, filters]);
  const userOptions = [{ value: "", label: "Todos" }, ...data.options.users.map((item) => ({ value: item.id, label: item.fullname }))];
  const centerOptions = data.centers.map((item) => ({ value: item.id, label: item.nombre }));
  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-violet-700 text-white"><Calendar className="size-5" /></div>
          <div><h1 className="text-2xl font-bold">Agenda</h1><p className="text-xs text-slate-500">{dateRangeLabel(days)}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setBaseDate(addDays(baseDate, mode === "month" ? -30 : -7))}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setBaseDate(addDays(baseDate, mode === "month" ? 30 : 7))}><ChevronRight className="size-4" /></Button>
          <Button variant="outline" onClick={() => setBaseDate(new Date())}>Hoy</Button>
          <SearchableSelect value={mode} options={[{ value: "week", label: "Semana" }, { value: "month", label: "Mes" }]} onChange={setMode} />
          <div className="w-48"><SearchableSelect value={centerId} options={centerOptions} placeholder="Centro" onChange={(value) => setFilters((current) => ({ ...current, centerId: value }))} /></div>
          {canCreate ? <Button onClick={() => setDialog({ date: formatDate(new Date()), time: "" })} className="bg-violet-700 text-white hover:bg-violet-800"><Plus className="size-4" />Nueva</Button> : null}
          <Button variant="outline" size="icon" onClick={data.reload}><RefreshCw className="size-4" /></Button>
        </div>
      </header>
      <section className="mb-3 flex flex-wrap items-end gap-2">
        {canViewAll ? <Field label="Creado por"><SearchableSelect value={filters.createdBy} options={userOptions} onChange={(value) => setFilters((current) => ({ ...current, createdBy: value }))} /></Field> : null}
        {canViewAll ? <Field label="Asignado a"><SearchableSelect value={filters.assignedTo} options={userOptions} onChange={(value) => setFilters((current) => ({ ...current, assignedTo: value }))} /></Field> : null}
        <Field label="Cliente"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-500" /><Input className="pl-9" placeholder="Cliente" value={filters.client} onChange={(event) => setFilters((current) => ({ ...current, client: event.target.value }))} /></div></Field>
        <div className="flex rounded-lg border bg-white p-1">
          {[["all", "Todos"], ["opportunity", "OP"], ["lead", "LD"]].map(([value, label]) => <button key={value} className={`h-8 rounded-md px-4 text-xs font-bold ${filters.kind === value ? "bg-slate-950 text-white" : "text-slate-700"}`} onClick={() => setFilters((current) => ({ ...current, kind: value }))}>{label}</button>)}
        </div>
      </section>
      {mode === "month" ? (
        <MonthCalendar days={monthCalendarDays(baseDate)} week={schedule.week} items={filteredItems} canCreate={canCreate} nowTime={nowTime} onCell={(day) => setDialog({ date: day.date, time: "" })} />
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
          <div className="grid min-w-[1180px]" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(160px, 1fr))` }}>
            <div className="border-b border-r bg-slate-50" />
            {days.map((day) => <div key={day.date} className="border-b border-r bg-slate-50 py-2 text-center text-xs font-bold">{day.label}<p className="font-normal">{day.day}</p></div>)}
            {slots.map((slot) => (
              <SlotRow key={slot} slot={slot} days={days} items={filteredItems} canCreate={canCreate} nowTime={nowTime} onCell={(day) => setDialog({ date: day.date, time: slot })} />
            ))}
          </div>
        </div>
      )}
      {dialog ? <NewOpportunityDialog state={dialog} data={data} canViewAll={canViewAll} onClose={() => setDialog(null)} onSubmit={async (payload) => { await data.createOpportunity(payload); toast.success("Oportunidad creada en agenda"); setDialog(null); }} /> : null}
    </div>
  );
}

function SlotRow({ slot, days, items, canCreate, nowTime, onCell }) {
  return (
    <>
      <div className="border-b border-r bg-slate-50 px-2 py-3 text-xs">{slot}</div>
      {days.map((day) => {
        const past = new Date(`${day.date}T${slot}`).getTime() < nowTime;
        const cellItems = items.filter((item) => item.agendaDate === day.date && String(item.agendaTime || "").slice(0, 5) === slot);
        return (
          <div key={`${day.date}-${slot}`} className={`group relative min-h-16 border-b border-r p-1 text-left align-top ${past ? "bg-slate-100 text-slate-500" : "bg-white hover:bg-blue-50"} ${!past && !cellItems.length && canCreate ? "cursor-pointer" : ""}`} onClick={() => !past && !cellItems.length && canCreate && onCell(day)}>
            <div className="relative z-10 space-y-1">
              {cellItems.map((item) => <AgendaCard key={item.id} item={item} />)}
            </div>
            {!cellItems.length && !past && canCreate ? <span className="hidden rounded bg-white px-3 py-2 text-xs font-bold shadow group-hover:block">Nueva Oportunidad</span> : null}
          </div>
        );
      })}
    </>
  );
}

function AgendaCard({ item }) {
  const href = item.kind === "lead" ? `/leads/${item.id}` : `/oportunidades/${item.id}`;
  return (
    <div
      className="relative z-10 mb-1 rounded border bg-white p-1.5 text-left text-[11px] leading-tight shadow-sm"
      style={{ borderLeft: `4px solid ${item.etapaColor}`, backgroundColor: `${item.etapaColor}18` }}
      onClick={(event) => { event.stopPropagation(); window.location.href = href; }}
    >
      <div className="flex items-start justify-between gap-1">
        <b className="text-slate-950">{item.code}</b>
        <span className="rounded bg-white/80 px-1 text-[10px] font-bold text-slate-900">{item.kind === "lead" ? "LD" : "OP"}</span>
      </div>
      <p className="mt-0.5 truncate font-semibold text-slate-900">{item.clienteNombre}</p>
      <p className="mt-1 truncate text-[10px] font-bold text-blue-700">{item.asignadoNombre}</p>
      {item.detail ? <p className="mt-1 line-clamp-2 italic text-red-700">{item.detail}</p> : null}
    </div>
  );
}

function MonthCalendar({ days, week, items, canCreate, nowTime, onCell }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-700">
        {dayLabels.map((label) => (
          <div key={label} className="border-r border-slate-200 py-2 last:border-r-0">{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayItems = items.filter((item) => item.agendaDate === day.date);
          const past = new Date(`${day.date}T23:59:59`).getTime() < nowTime;
          const inactive = hasActiveConfig(week) && !week?.[day.key]?.active;
          return (
            <div
              key={day.date}
              className={`group relative min-h-32 border-b border-r p-2 text-left last:border-r-0 ${day.outside || inactive ? "bg-slate-50 text-slate-400" : past ? "bg-slate-100 text-slate-500" : "bg-white hover:bg-blue-50"} ${!inactive && !past && !dayItems.length && canCreate ? "cursor-pointer" : ""}`}
              onClick={() => !inactive && !past && !dayItems.length && canCreate && onCell(day)}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${day.today ? "bg-violet-700 text-white" : ""}`}>{day.day}</span>
                <span className="text-[10px] font-bold uppercase text-slate-400">{day.label}</span>
              </div>
              <div className="relative z-10 space-y-1">
                {dayItems.map((item) => <AgendaCard key={item.id} item={item} />)}
              </div>
              {!dayItems.length && !inactive && !past && canCreate ? <span className="hidden rounded bg-white px-3 py-2 text-xs font-bold shadow group-hover:inline-block">Nueva Oportunidad</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewOpportunityDialog({ state, data, canViewAll, onClose, onSubmit }) {
  const [form, setForm] = useState({ clienteId: "", origenId: "", suborigenId: "", asignadoA: canViewAll ? "" : String(data.currentUser?.id || ""), detalle: "", fechaAgenda: state.date, horaAgenda: state.time });
  const [activities, setActivities] = useState([]);
  const [agendas, setAgendas] = useState(state.date && state.time ? [{ fechaAgenda: state.date, horaAgenda: state.time }] : []);
  const clientOptions = data.options.clients.map((item) => ({ value: item.id, label: item.nombre }));
  const originOptions = data.options.origins.map((item) => ({ value: item.id, label: item.name }));
  const suboriginOptions = data.options.suborigins.filter((item) => !form.origenId || Number(item.origenId) === Number(form.origenId)).map((item) => ({ value: item.id, label: item.name }));
  const userOptions = [{ value: "", label: "Sin asignar" }, ...data.options.users.map((item) => ({ value: item.id, label: item.fullname }))];
  const canSubmit = Boolean(form.clienteId && form.origenId && activities.length && agendas.length);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] w-[min(96vw,1100px)] max-w-[calc(100vw-1rem)] overflow-x-hidden overflow-y-auto bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-slate-200 p-5">
          <DialogTitle className="text-2xl font-bold text-violet-700">Nueva oportunidad</DialogTitle>
          <p className="text-sm text-slate-500">Completa los datos, actividades y agenda de la oportunidad.</p>
        </DialogHeader>
        <div className="grid min-w-0 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(340px,380px)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
              <h3 className="mb-3 text-sm font-bold text-violet-700">Informacion general</h3>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <Field label="Cliente *"><SearchableSelect value={form.clienteId} options={clientOptions} placeholder="Buscar cliente" onChange={(value) => setForm((current) => ({ ...current, clienteId: value }))} /></Field>
                <Field label="Creado por"><Input disabled value={data.currentUser?.fullname || "Usuario"} /></Field>
                <Field label="Origen *"><SearchableSelect value={form.origenId} options={originOptions} placeholder="Buscar origen" onChange={(value) => setForm((current) => ({ ...current, origenId: value, suborigenId: "" }))} /></Field>
                <Field label="Suborigen"><SearchableSelect value={form.suborigenId} options={suboriginOptions} placeholder="Buscar suborigen" onChange={(value) => setForm((current) => ({ ...current, suborigenId: value }))} /></Field>
                <Field label="Etapa actual"><Input disabled value="Nuevo" className="bg-violet-100 font-bold text-violet-700" /></Field>
                <Field label="Asignado a"><SearchableSelect disabled={!canViewAll} value={form.asignadoA} options={userOptions} onChange={(value) => setForm((current) => ({ ...current, asignadoA: value }))} /></Field>
              </div>
            </section>
            <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-blue-800">Nueva actividad</h3>
              <Textarea className="min-h-28 bg-white" value={form.detalle} placeholder="Describe que accion se realizo..." onChange={(e) => setForm((current) => ({ ...current, detalle: e.target.value }))} />
              <Button type="button" className="mt-3 w-full bg-slate-950 text-white hover:bg-slate-800" disabled={!form.detalle.trim()} onClick={() => { setActivities((current) => [...current, { detalle: form.detalle.trim() }]); setForm((current) => ({ ...current, detalle: "" })); }}><Plus className="size-4" />Agregar actividad</Button>
            </section>
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-emerald-800">Nueva agenda</h3>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <Field label="Fecha agenda"><Input type="date" value={form.fechaAgenda} onChange={(e) => setForm((current) => ({ ...current, fechaAgenda: e.target.value }))} /></Field>
                <Field label="Hora agenda"><Input type="time" value={form.horaAgenda} onChange={(e) => setForm((current) => ({ ...current, horaAgenda: e.target.value }))} /></Field>
              </div>
              <Button type="button" className="mt-3 w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={!form.fechaAgenda || !form.horaAgenda} onClick={() => setAgendas((current) => [...current, { fechaAgenda: form.fechaAgenda, horaAgenda: form.horaAgenda }])}><Plus className="size-4" />Agregar agenda</Button>
            </section>
          </div>
          <div className="min-w-0 space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-3 font-bold">Actividades ({activities.length})</h3>
              <div className="space-y-2">{activities.length ? activities.map((item, index) => <div key={index} className="rounded-md border bg-slate-50 p-3 text-sm">{item.detalle}</div>) : <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">No hay actividades registradas</div>}</div>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-3 font-bold">Agendas ({agendas.length})</h3>
              <div className="space-y-2">{agendas.length ? agendas.map((item, index) => <div key={index} className="rounded-md border bg-emerald-50 p-3 text-sm font-medium">{item.fechaAgenda} - {item.horaAgenda}</div>) : <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">No hay agendas registradas</div>}</div>
            </section>
          </div>
        </div>
        <DialogFooter className="sticky bottom-0 border-t bg-white p-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!canSubmit} onClick={() => onSubmit({ clienteId: form.clienteId, origenId: form.origenId, suborigenId: form.suborigenId, asignadoA: form.asignadoA, activities, detail: agendas.at(-1) })}>Crear oportunidad</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) { return <div className="min-w-0 space-y-1"><Label className="text-xs">{label}</Label>{children}</div>; }
function weekDays(date) { const start = addDays(date, -date.getDay() + 1); return Array.from({ length: 7 }, (_, i) => dayObj(addDays(start, i))); }
function monthDays(date) { const start = new Date(date.getFullYear(), date.getMonth(), 1); const end = new Date(date.getFullYear(), date.getMonth() + 1, 0); return Array.from({ length: end.getDate() }, (_, i) => dayObj(addDays(start, i))); }
function monthCalendarDays(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  const today = formatDate(new Date());
  return Array.from({ length: 42 }, (_, index) => {
    const current = addDays(start, index);
    return { ...dayObj(current), outside: current.getMonth() !== date.getMonth(), today: formatDate(current) === today };
  });
}
function dayObj(date) { return { date: formatDate(date), key: dayKeys[date.getDay()], label: dayLabels[date.getDay()], day: String(date.getDate()).padStart(2, "0") }; }
function addDays(date, days) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
function formatDate(date) { return date.toISOString().slice(0, 10); }
function dateRangeLabel(days) { return days.length ? `${days[0].date} - ${days.at(-1).date}` : ""; }
function filterActiveDays(days, week) {
  if (!hasActiveConfig(week)) return days;
  const activeDays = days.filter((day) => week?.[day.key]?.active);
  return activeDays.length ? activeDays : days;
}
function hasActiveConfig(week) { return Object.values(week || {}).some((value) => value?.active); }
function timeSlots(week, step) {
  const active = Object.entries(week || {}).filter(([, value]) => value?.active);
  const start = active.map(([, value]) => value.start || "08:00").sort()[0] || "08:00";
  const end = active.map(([, value]) => value.end || "18:00").sort().at(-1) || "18:00";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const slots = [];
  for (let m = sh * 60 + sm; m <= eh * 60 + em; m += Number(step || 30)) slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return slots;
}
