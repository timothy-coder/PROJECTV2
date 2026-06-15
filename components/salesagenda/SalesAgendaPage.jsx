"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Plus, RefreshCw, Search } from "lucide-react";
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
  const canViewAll = Boolean(hasPerm(userPermissions, ["agenda", "viewall"]) || hasPerm(userPermissions, ["oportunidades", "viewall"]) || hasPerm(userPermissions, ["leads", "viewall"]) || data.currentUser?.canViewAll);
  const canCreate = hasPerm(userPermissions, ["oportunidades", "create"]);
  const [nowTime] = useState(() => Date.now());
  const [baseDate, setBaseDate] = useState(new Date());
  const [mode, setMode] = useState("week");
  const [filters, setFilters] = useState({ createdBy: "", assignedTo: "", client: "", kind: "all", centerId: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [dialog, setDialog] = useState(null);
  const centerId = filters.centerId || (data.centers[0]?.id ? String(data.centers[0].id) : "");
  const schedule = data.schedules.find((item) => String(item.centroId) === String(centerId)) || data.schedules[0] || { slotMinutes: 30, week: {} };
  const days = useMemo(
    () => filterActiveDays(mode === "month" ? monthDays(baseDate) : weekDays(baseDate), schedule.week),
    [baseDate, mode, schedule.week]
  );
  const slots = timeSlots(schedule.week, schedule.slotMinutes || 30);
  const kindOptions = useMemo(() => {
    const availableKinds = new Set(data.items.map((item) => item.kind));
    const options = data.items.length ? [["all", "Todos"]] : [];
    if (availableKinds.has("opportunity")) options.push(["opportunity", "OP"]);
    if (availableKinds.has("lead")) options.push(["lead", "LD"]);
    if (availableKinds.has("fordLead")) options.push(["fordLead", "LF"]);
    return options;
  }, [data.items]);
  const activeKind = filters.kind === "all" || kindOptions.some(([value]) => value === filters.kind) ? filters.kind : "all";
  const filteredItems = useMemo(() => data.items.filter((item) => {
    const matchKind = activeKind === "all" || item.kind === activeKind;
    const matchCreated = !filters.createdBy || Number(item.createdBy) === Number(filters.createdBy);
    const matchAssigned = !filters.assignedTo || Number(item.asignadoA) === Number(filters.assignedTo);
    const matchClient = !filters.client || item.clienteNombre.toLowerCase().includes(filters.client.toLowerCase()) || item.code.toLowerCase().includes(filters.client.toLowerCase());
    return matchKind && matchCreated && matchAssigned && matchClient;
  }), [data.items, filters, activeKind]);
  const userOptions = [{ value: "", label: "Todos" }, ...data.options.users.map((item) => ({ value: item.id, label: item.fullname }))];
  const centerOptions = data.centers.map((item) => ({ value: item.id, label: item.nombre }));
  const mobileDays = mode === "month" ? monthDays(baseDate) : days;
  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:flex sm:h-[calc(100svh-1rem)] sm:flex-col sm:overflow-hidden sm:p-4">
      <header className="mb-3 flex flex-col gap-3 border-b border-slate-200 pb-3 sm:mb-4 sm:shrink-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
            <Calendar className="size-5" />
            </div>
          <div><h1 className="text-base font-bold leading-tight text-violet-700">Agenda</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">{dateRangeLabel(days)}</p></div>
        </div>
        <div className="grid grid-cols-[auto_auto_1fr_auto] gap-2 sm:hidden">
          <Button variant="outline" size="icon" onClick={() => { const nextDate = addDays(baseDate, mode === "month" ? -30 : -7); setBaseDate(nextDate); setSelectedDate(formatDate(nextDate)); }}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => { const nextDate = addDays(baseDate, mode === "month" ? 30 : 7); setBaseDate(nextDate); setSelectedDate(formatDate(nextDate)); }}><ChevronRight className="size-4" /></Button>
          <Button variant="outline" onClick={() => { const today = new Date(); setBaseDate(today); setSelectedDate(formatDate(today)); }}>Hoy</Button>
          <SearchableSelect value={mode} options={[{ value: "week", label: "Semana" }, { value: "month", label: "Mes" }]} onChange={setMode} />
          <div className="hidden w-48 sm:block"><SearchableSelect value={centerId} options={centerOptions} placeholder="Centro" onChange={(value) => setFilters((current) => ({ ...current, centerId: value }))} /></div>
          {canCreate ? <Button onClick={() => setDialog({ date: selectedDate || formatDate(new Date()), time: "" })} className="col-span-2 bg-violet-700 text-white hover:bg-violet-800 sm:col-span-1"><Plus className="size-4" />Nueva</Button> : null}
          <Button variant="outline" size="icon" onClick={data.reload}><RefreshCw className="size-4" /></Button>
        </div>
      </header>
      <section className="mb-3 rounded-lg border border-slate-200 bg-white p-2 sm:shrink-0 sm:flex sm:flex-wrap sm:items-end sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0">
        <button type="button" className="flex h-9 w-full items-center justify-between rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 sm:hidden" onClick={() => setFiltersOpen((current) => !current)}>
          Filtros
          <ChevronDown className={`size-4 transition ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
        <div className={`${filtersOpen ? "grid" : "hidden"} mt-2 gap-2 sm:mt-0 sm:contents`}>
          <div className="hidden items-end gap-2 sm:flex">
            <Button variant="outline" size="icon" onClick={() => { const nextDate = addDays(baseDate, mode === "month" ? -30 : -7); setBaseDate(nextDate); setSelectedDate(formatDate(nextDate)); }}><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => { const nextDate = addDays(baseDate, mode === "month" ? 30 : 7); setBaseDate(nextDate); setSelectedDate(formatDate(nextDate)); }}><ChevronRight className="size-4" /></Button>
            <Button variant="outline" onClick={() => { const today = new Date(); setBaseDate(today); setSelectedDate(formatDate(today)); }}>Hoy</Button>
          </div>
          <div className="hidden w-36 sm:block"><Field label="Vista"><SearchableSelect value={mode} options={[{ value: "week", label: "Semana" }, { value: "month", label: "Mes" }]} onChange={setMode} /></Field></div>
          <div className="hidden w-48 sm:block"><Field label="Centro"><SearchableSelect value={centerId} options={centerOptions} placeholder="Centro" onChange={(value) => setFilters((current) => ({ ...current, centerId: value }))} /></Field></div>
          {canCreate ? <Button onClick={() => setDialog({ date: selectedDate || formatDate(new Date()), time: "" })} className="hidden bg-violet-700 text-white hover:bg-violet-800 sm:inline-flex"><Plus className="size-4" />Nueva</Button> : null}
          <Button variant="outline" size="icon" onClick={data.reload} className="hidden sm:inline-flex"><RefreshCw className="size-4" /></Button>
          <div className="sm:hidden"><Field label="Centro"><SearchableSelect value={centerId} options={centerOptions} placeholder="Centro" onChange={(value) => setFilters((current) => ({ ...current, centerId: value }))} /></Field></div>
          {canViewAll ? <Field label="Creado por"><SearchableSelect value={filters.createdBy} options={userOptions} onChange={(value) => setFilters((current) => ({ ...current, createdBy: value }))} /></Field> : null}
          {canViewAll ? <Field label="Asignado a"><SearchableSelect value={filters.assignedTo} options={userOptions} onChange={(value) => setFilters((current) => ({ ...current, assignedTo: value }))} /></Field> : null}
          <Field label="Cliente"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-500" /><Input className="pl-9" placeholder="Cliente" value={filters.client} onChange={(event) => setFilters((current) => ({ ...current, client: event.target.value }))} /></div></Field>
          {kindOptions.length > 1 ? (
            <div className="flex rounded-lg border bg-white p-1">
              {kindOptions.map(([value, label]) => <button key={value} className={`h-8 rounded-md px-4 text-xs font-bold ${activeKind === value ? "bg-slate-950 text-white" : "text-slate-700"}`} onClick={() => setFilters((current) => ({ ...current, kind: value }))}>{label}</button>)}
            </div>
          ) : null}
        </div>
      </section>
      <div className="sm:hidden">
        <MobileAgenda days={mobileDays} selectedDate={selectedDate} setSelectedDate={setSelectedDate} items={filteredItems} canCreate={canCreate} onNew={(date) => setDialog({ date, time: "" })} />
      </div>
      {mode === "month" ? (
        <div className="hidden min-h-0 overflow-auto sm:block sm:flex-1">
          <MonthCalendar days={monthCalendarDays(baseDate)} week={schedule.week} items={filteredItems} canCreate={canCreate} nowTime={nowTime} onCell={(day) => setDialog({ date: day.date, time: "" })} />
        </div>
      ) : (
        <div className="hidden min-h-0 overflow-auto rounded-lg border border-slate-200 bg-white sm:block sm:flex-1">
          <div className="grid min-w-[1180px]" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(160px, 1fr))` }}>
            <div className="border-b border-r bg-slate-50" />
            {days.map((day) => <div key={day.date} className="border-b border-r bg-slate-50 py-2 text-center text-xs font-bold">{day.label}<p className="font-normal">{day.day}</p></div>)}
            {slots.map((slot, index) => (
              <SlotRow key={slot} slot={slot} nextSlot={slots[index + 1]} slotMinutes={schedule.slotMinutes || 30} days={days} items={filteredItems} canCreate={canCreate} nowTime={nowTime} onCell={(day) => setDialog({ date: day.date, time: slot })} />
            ))}
          </div>
        </div>
      )}
      {dialog ? <NewOpportunityDialog state={dialog} data={data} canViewAll={canViewAll} onClose={() => setDialog(null)} onSubmit={async (payload) => { await data.createOpportunity(payload); toast.success("Oportunidad creada en agenda"); setDialog(null); }} /> : null}
    </div>
  );
}

function SlotRow({ slot, nextSlot, slotMinutes, days, items, canCreate, nowTime, onCell }) {
  return (
    <>
      <div className="border-b border-r bg-slate-50 px-2 py-3 text-xs">{slot}</div>
      {days.map((day) => {
        const past = new Date(`${day.date}T${slot}`).getTime() < nowTime;
        const cellItems = items.filter((item) => item.agendaDate === day.date && isInsideSlot(item.agendaTime, slot, nextSlot, slotMinutes));
        return (
          <div key={`${day.date}-${slot}`} className={`group relative h-24 overflow-hidden border-b border-r p-1 text-left align-top ${past ? "bg-slate-100 text-slate-500" : "bg-white hover:bg-blue-50"} ${!past && !cellItems.length && canCreate ? "cursor-pointer" : ""}`} onClick={() => !past && !cellItems.length && canCreate && onCell(day)}>
            <div className="relative z-10 h-full space-y-1 overflow-y-auto pr-1">
              {cellItems.map((item) => <AgendaCard key={item.id} item={item} />)}
            </div>
            {!cellItems.length && !past && canCreate ? <span className="hidden rounded bg-white px-3 py-2 text-xs font-bold shadow group-hover:block">Nueva Oportunidad</span> : null}
          </div>
        );
      })}
    </>
  );
}

function isInsideSlot(value, slot, nextSlot, slotMinutes) {
  const itemMinutes = timeToMinutes(value);
  const startMinutes = timeToMinutes(slot);
  if (itemMinutes === null || startMinutes === null) return false;
  const endMinutes = timeToMinutes(nextSlot) ?? startMinutes + Number(slotMinutes || 30);
  return itemMinutes >= startMinutes && itemMinutes < endMinutes;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "").slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function AgendaCard({ item }) {
  const href = agendaDetailPath(item);
  return (
    <div
      className="relative z-10 mb-1 rounded border bg-white p-1.5 text-left text-[11px] leading-tight shadow-sm"
      style={{ borderLeft: `4px solid ${item.etapaColor}`, backgroundColor: `${item.etapaColor}18` }}
      onClick={(event) => { event.stopPropagation(); window.location.href = href; }}
    >
      <div className="flex items-start justify-between gap-1">
        <b className="text-slate-950">{item.code}</b>
        <span className="rounded bg-white/80 px-1 text-[10px] font-bold text-slate-900">{agendaKindLabel(item.kind)}</span>
      </div>
      <p className="mt-0.5 truncate font-semibold text-slate-900">{item.clienteNombre}</p>
      <p className="mt-1 truncate text-[10px] font-bold text-blue-700">{item.asignadoNombre}</p>
      {item.detail ? <p className="mt-1 line-clamp-2 italic text-red-700">{item.detail}</p> : null}
    </div>
  );
}

function agendaKindLabel(kind) {
  if (kind === "lead") return "LD";
  if (kind === "fordLead") return "LF";
  return "OP";
}

function agendaDetailPath(item) {
  return item.kind === "lead" ? `/leads/${item.id}` : `/oportunidades/${item.id}`;
}

function MobileAgenda({ days, selectedDate, setSelectedDate, items, canCreate, onNew }) {
  const selected = days.find((day) => day.date === selectedDate) || days[0] || dayObj(new Date());
  const dayItems = items
    .filter((item) => item.agendaDate === selected.date)
    .sort((a, b) => String(a.agendaTime || "").localeCompare(String(b.agendaTime || "")));

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-white px-3 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => {
            const active = day.date === selected.date;
            const count = items.filter((item) => item.agendaDate === day.date).length;
            return (
              <button
                key={day.date}
                type="button"
                className={`min-w-14 rounded-xl px-2.5 py-2 text-center transition ${active ? "bg-blue-600 text-white shadow" : "bg-slate-50 text-slate-700"}`}
                onClick={() => setSelectedDate(day.date)}
              >
                <span className="block text-[10px] font-bold uppercase">{day.label}</span>
                <span className={`mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-sm font-bold ${active ? "bg-white text-blue-700" : day.today ? "bg-violet-700 text-white" : "bg-white text-slate-950"}`}>
                  {day.day}
                </span>
                <span className={`mt-1 block text-[10px] font-bold ${active ? "text-blue-50" : "text-slate-400"}`}>{count || "-"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-slate-500">{selected.label}</p>
          <h2 className="truncate text-base font-bold text-slate-950">{selected.date}</h2>
        </div>
        {canCreate ? (
          <Button size="sm" className="shrink-0 bg-violet-700 text-white hover:bg-violet-800" onClick={() => onNew(selected.date)}>
            <Plus className="size-4" />Nueva
          </Button>
        ) : null}
      </div>

      <div className="max-h-[calc(100svh-17rem)] min-h-80 overflow-y-auto bg-slate-50 px-3 py-3">
        {dayItems.length ? (
          <div className="space-y-2">
            {dayItems.map((item) => <MobileAgendaCard key={`${item.kind}-${item.id}`} item={item} />)}
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 text-center text-sm text-slate-500">
            <Calendar className="mb-2 size-8 text-slate-300" />
            No hay oportunidades agendadas para este dia.
          </div>
        )}
      </div>
    </section>
  );
}

function MobileAgendaCard({ item }) {
  const href = agendaDetailPath(item);
  return (
    <button
      type="button"
      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm"
      style={{ borderLeft: `4px solid ${item.etapaColor}` }}
      onClick={() => window.location.assign(href)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-950">{item.code}</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-700">{item.clienteNombre}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">{agendaKindLabel(item.kind)}</span>
      </div>
      <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs text-slate-600">
        <span className="font-bold text-slate-500">Hora</span>
        <span className="font-semibold text-slate-950">{String(item.agendaTime || "").slice(0, 5) || "-"}</span>
        <span className="font-bold text-slate-500">Asesor</span>
        <span className="truncate">{item.asignadoNombre || "-"}</span>
      </div>
      {item.detail ? <p className="mt-2 line-clamp-2 rounded-lg bg-red-50 px-2 py-1 text-xs italic text-red-700">{item.detail}</p> : null}
    </button>
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
              className={`group relative h-36 overflow-hidden border-b border-r p-2 text-left last:border-r-0 ${day.outside || inactive ? "bg-slate-50 text-slate-400" : past ? "bg-slate-100 text-slate-500" : "bg-white hover:bg-blue-50"} ${!inactive && !past && !dayItems.length && canCreate ? "cursor-pointer" : ""}`}
              onClick={() => !inactive && !past && !dayItems.length && canCreate && onCell(day)}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${day.today ? "bg-violet-700 text-white" : ""}`}>{day.day}</span>
                <span className="text-[10px] font-bold uppercase text-slate-400">{day.label}</span>
              </div>
              <div className="relative z-10 h-[calc(100%-2.25rem)] space-y-1 overflow-y-auto pr-1">
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
        <div className="grid min-w-0 gap-4 p-4 sm:p-5 ">
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
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-3 font-bold">Actividades ({activities.length})</h3>
              <div className="space-y-2">{activities.length ? activities.map((item, index) => <div key={index} className="rounded-md border bg-slate-50 p-3 text-sm">{item.detalle}</div>) : <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">No hay actividades registradas</div>}</div>
            </section>
            </section>
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-emerald-800">Nueva agenda</h3>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <Field label="Fecha agenda"><Input type="date" value={form.fechaAgenda} onChange={(e) => setForm((current) => ({ ...current, fechaAgenda: e.target.value }))} /></Field>
                <Field label="Hora agenda"><Input type="time" value={form.horaAgenda} onChange={(e) => setForm((current) => ({ ...current, horaAgenda: e.target.value }))} /></Field>
              </div>
              <Button type="button" className="mt-3 w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={!form.fechaAgenda || !form.horaAgenda} onClick={() => setAgendas((current) => [...current, { fechaAgenda: form.fechaAgenda, horaAgenda: form.horaAgenda }])}><Plus className="size-4" />Agregar agenda</Button>
             <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-3 font-bold">Agendas ({agendas.length})</h3>
              <div className="space-y-2">{agendas.length ? agendas.map((item, index) => <div key={index} className="rounded-md border bg-emerald-50 p-3 text-sm font-medium">{item.fechaAgenda} - {item.horaAgenda}</div>) : <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">No hay agendas registradas</div>}</div>
            </section>
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
