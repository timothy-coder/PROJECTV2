"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { usePostventaAgenda } from "@/hooks/postventa/usePostventaAgenda";
import { hasPerm } from "@/lib/permissions";

const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const dayLabels = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

export default function PostventaAgendaPage({ userPermissions }) {
  const data = usePostventaAgenda();
  const canViewAll = Boolean(hasPerm(userPermissions, ["citas", "viewall"]) || hasPerm(userPermissions, ["oportunidadespv", "viewall"]) || hasPerm(userPermissions, ["leadspv", "viewall"]) || data.currentUser?.canViewAll);
  const canView = Boolean(hasPerm(userPermissions, ["citas", "view"]) || hasPerm(userPermissions, ["oportunidadespv", "view"]) || hasPerm(userPermissions, ["leadspv", "view"]) || canViewAll);
  const [nowTime] = useState(() => Date.now());
  const [baseDate, setBaseDate] = useState(new Date());
  const [mode, setMode] = useState("week");
  const [filters, setFilters] = useState({ kind: "all", centerId: "" });
  const centerId = filters.centerId || (data.centers[0]?.id ? String(data.centers[0].id) : "");
  const schedule = data.schedules.find((item) => String(item.centroId) === String(centerId)) || data.schedules[0] || { slotMinutes: 30, week: {} };
  const days = useMemo(
    () => filterActiveDays(mode === "month" ? monthDays(baseDate) : weekDays(baseDate), schedule.week),
    [baseDate, mode, schedule.week]
  );
  const slots = timeSlots(schedule.week, schedule.slotMinutes || 30);
  const filteredItems = useMemo(() => data.items.filter((item) => filters.kind === "all" || item.kind === filters.kind), [data.items, filters.kind]);
  const centerOptions = data.centers.map((item) => ({ value: item.id, label: item.nombre }));
  if (!canView) return <div className="rounded-lg bg-white p-4 text-sm text-slate-700">No tienes permiso para ver la agenda.</div>;
  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-violet-700 text-white"><Calendar className="size-5" /></div>
          <div><h1 className="text-2xl font-bold">Agenda</h1><p className="text-xs text-slate-500">PostVenta - {canViewAll ? "Vista completa" : "Mi vista"} - {dateRangeLabel(days)}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setBaseDate(addDays(baseDate, mode === "month" ? -30 : -7))}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setBaseDate(addDays(baseDate, mode === "month" ? 30 : 7))}><ChevronRight className="size-4" /></Button>
          <Button variant="outline" onClick={() => setBaseDate(new Date())}>Hoy</Button>
          <SearchableSelect value={mode} options={[{ value: "week", label: "Semana" }, { value: "month", label: "Mes" }]} onChange={setMode} />
          <div className="w-48"><SearchableSelect value={centerId} options={centerOptions} placeholder="Centro" onChange={(value) => setFilters((current) => ({ ...current, centerId: value }))} /></div>
          <Button variant="outline" size="icon" onClick={data.reload}><RefreshCw className="size-4" /></Button>
        </div>
      </header>
      <section className="mb-3 flex flex-wrap items-end gap-2">
        <div className="flex rounded-lg border bg-white p-1">
          {[["all", "Todos"], ["opportunity", "OPPV"], ["lead", "LDPV"]].map(([value, label]) => <button key={value} className={`h-8 rounded-md px-4 text-xs font-bold ${filters.kind === value ? "bg-slate-950 text-white" : "text-slate-700"}`} onClick={() => setFilters((current) => ({ ...current, kind: value }))}>{label}</button>)}
        </div>
      </section>
      {mode === "month" ? (
        <MonthCalendar days={monthCalendarDays(baseDate)} week={schedule.week} items={filteredItems} nowTime={nowTime} />
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
          <div className="grid min-w-[1180px]" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(160px, 1fr))` }}>
            <div className="border-b border-r bg-slate-50" />
            {days.map((day) => <div key={day.date} className="border-b border-r bg-slate-50 py-2 text-center text-xs font-bold">{day.label}<p className="font-normal">{day.day}</p></div>)}
            {slots.map((slot, index) => <SlotRow key={slot} slot={slot} nextSlot={slots[index + 1]} slotMinutes={schedule.slotMinutes || 30} days={days} items={filteredItems} nowTime={nowTime} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function SlotRow({ slot, nextSlot, slotMinutes, days, items, nowTime }) {
  return (
    <>
      <div className="border-b border-r bg-slate-50 px-2 py-3 text-xs">{slot}</div>
      {days.map((day) => {
        const past = new Date(`${day.date}T${slot}`).getTime() < nowTime;
        const cellItems = items.filter((item) => item.agendaDate === day.date && isInsideSlot(item.agendaTime, slot, nextSlot, slotMinutes));
        return (
          <div
            key={`${day.date}-${slot}`}
            className={`relative min-h-16 border-b border-r p-1 text-left align-top ${past ? "bg-slate-100 text-slate-500" : "bg-white"}`}
            title={past ? "Horario bloqueado por fecha u hora pasada" : undefined}
          >
            {past ? <span className="pointer-events-none absolute right-1 top-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Bloqueado</span> : null}
            <div className="relative z-10 space-y-1">
              {cellItems.map((item) => <AgendaCard key={item.id} item={item} />)}
            </div>
          </div>
        );
      })}
    </>
  );
}

function AgendaCard({ item }) {
  const href = item.kind === "lead" ? `/leadspv/${item.id}` : `/oportunidadespv/${item.id}`;
  return (
    <div
      className="relative z-10 mb-1 cursor-pointer rounded border bg-white p-1.5 text-left text-[11px] leading-tight shadow-sm"
      style={{ borderLeft: `4px solid ${item.etapaColor}`, backgroundColor: `${item.etapaColor}18` }}
      onClick={(event) => { event.stopPropagation(); window.location.href = href; }}
    >
      <div className="flex items-start justify-between gap-1"><b className="text-slate-950">{item.code}</b><span className="rounded bg-white/80 px-1 text-[10px] font-bold text-slate-900">{item.kind === "lead" ? "LD" : "OP"}</span></div>
      <p className="mt-0.5 truncate font-semibold text-slate-900">{item.clienteNombre}</p>
      <p className="mt-1 truncate text-[10px] font-bold text-blue-700">{item.asignadoNombre}</p>
      {item.detail ? <p className="mt-1 line-clamp-2 italic text-red-700">{item.detail}</p> : null}
    </div>
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

function MonthCalendar({ days, week, items, nowTime }) {
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
              className={`relative min-h-32 border-b border-r p-2 text-left last:border-r-0 ${day.outside || inactive ? "bg-slate-50 text-slate-400" : past ? "bg-slate-100 text-slate-500" : "bg-white"}`}
              title={past ? "Horario bloqueado por fecha u hora pasada" : undefined}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${day.today ? "bg-violet-700 text-white" : ""}`}>{day.day}</span>
                <span className="text-[10px] font-bold uppercase text-slate-400">{day.label}</span>
              </div>
              <div className="relative z-10 space-y-1">
                {dayItems.map((item) => <AgendaCard key={item.id} item={item} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
