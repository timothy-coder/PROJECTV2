"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Eye, Pencil, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSalesAgenda } from "@/hooks/salesagenda/useSalesAgenda";
import { hasPerm } from "@/lib/permissions";

export default function SalesPanelPage({ userPermissions }) {
  const data = useSalesAgenda();
  const [taskPeriod, setTaskPeriod] = useState("day");
  const [opportunityPeriod, setOpportunityPeriod] = useState("day");
  const [leadPeriod, setLeadPeriod] = useState("day");
  const [fordLeadPeriod, setFordLeadPeriod] = useState("day");
  const canViewAll = Boolean(hasPerm(userPermissions, ["agenda", "viewall"]) || data.currentUser?.canViewAll);

  const allOpportunities = useMemo(() => data.items.filter((item) => item.kind === "opportunity"), [data.items]);
  const allLeads = useMemo(() => data.items.filter((item) => item.kind === "lead"), [data.items]);
  const allFordLeads = useMemo(() => data.items.filter((item) => item.kind === "fordLead"), [data.items]);
  const opportunities = useMemo(
    () => allOpportunities.filter((item) => matchesPeriod(item.agendaDate || new Date(), opportunityPeriod)),
    [allOpportunities, opportunityPeriod]
  );
  const leads = useMemo(
    () => allLeads.filter((item) => matchesPeriod(item.agendaDate || new Date(), leadPeriod)),
    [allLeads, leadPeriod]
  );
  const fordLeads = useMemo(
    () => allFordLeads.filter((item) => matchesPeriod(item.agendaDate || new Date(), fordLeadPeriod)),
    [allFordLeads, fordLeadPeriod]
  );
  const tasks = useMemo(() => {
    return data.items.filter((item) => {
      const stage = normalizeStage(item.etapaNombre);
      return matchesPeriod(item.agendaDate || new Date(), taskPeriod) && ["nuevo", "en atencion"].includes(stage);
    });
  }, [data.items, taskPeriod]);
  const stages = data.options?.stages || [];

  return (
    <div className="min-w-0 bg-slate-50 p-4 text-slate-950">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold leading-tight text-violet-700">Panel de Ventas</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">{canViewAll ? "Vista completa" : "Mi vista"}</p>
        </div>
        <Button variant="outline" size="icon" onClick={data.reload}>
          <RefreshCw className="size-4" />
        </Button>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-1.5 sm:gap-3">
        {allOpportunities.length ? <Stat label="OPO Totales" value={allOpportunities.length} accent="violet" /> : null}
        {allLeads.length ? <Stat label="Leads Totales" value={allLeads.length} accent="red" /> : null}
        {allFordLeads.length ? <Stat label="Leads Ford Totales" value={allFordLeads.length} accent="amber" /> : null}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-1.5 sm:gap-3 lg:grid-cols-5">
        {stages.map((stage) => {
          const op = allOpportunities.filter((item) => Number(item.etapaId) === Number(stage.id)).length;
          const ld = allLeads.filter((item) => Number(item.etapaId) === Number(stage.id)).length;
          const lf = allFordLeads.filter((item) => Number(item.etapaId) === Number(stage.id)).length;
          const total = op + ld + lf;
          if (!total) return null;
          const sub = [["OPO", op], ["LD", ld], ["LF", lf]].filter(([, count]) => count > 0).map(([label, count]) => `${label}: ${count}`).join(" | ");
          return <Stat key={stage.id} label={stage.nombre} value={total} sub={sub} accent="cyan" />;
        })}
      </div>

      <section className="mb-1 rounded-lg border bg-white p-2 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-violet-700">Tareas - {tasks.length} registros</h2>
          <PeriodFilter value={taskPeriod} onChange={setTaskPeriod} />
        </div>
        <div className="space-y-2">
          {tasks.map((item) => <TaskRow key={item.id} item={item} />)}
          {!tasks.length ? <p className="py-8 text-center text-sm text-slate-500">No hay items en agenda para este periodo</p> : null}
        </div>
      </section>

      {allOpportunities.length ? <Table title={`Oportunidades - ${opportunities.length} registros`} rows={opportunities} period={opportunityPeriod} onPeriodChange={setOpportunityPeriod} /> : null}
      {allLeads.length ? <Table title={`Leads - ${leads.length} registros`} rows={leads} period={leadPeriod} onPeriodChange={setLeadPeriod} /> : null}
      {allFordLeads.length ? <Table title={`Leads Ford - ${fordLeads.length} registros`} rows={fordLeads} period={fordLeadPeriod} onPeriodChange={setFordLeadPeriod} /> : null}
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  const colors = { violet: "border-violet-300 text-violet-700", red: "border-red-200 text-red-500", amber: "border-amber-200 text-amber-600", cyan: "border-cyan-300 text-cyan-600" };
  return (
    <div className={`rounded-lg border bg-white p-2 shadow-sm sm:p-4 ${colors[accent] || ""}`}>
      <p className="truncate text-[10px] leading-4 text-slate-600 sm:text-xs">{label}</p>
      <p className="mt-1 text-lg font-bold leading-5 sm:mt-2 sm:text-2xl">{value}</p>
      {sub ? <p className="mt-1 line-clamp-2 text-[10px] leading-3 text-slate-500 sm:text-xs sm:leading-4">{sub}</p> : null}
    </div>
  );
}

function PeriodFilter({ value, onChange }) {
  return (
    <div className="flex rounded-lg border bg-white p-1">
      {[["day", "Hoy"], ["week", "Esta semana"], ["month", "Este mes"]].map(([v, l]) => (
        <button key={v} className={`rounded-md px-3 py-1 text-xs font-bold ${value === v ? "bg-slate-950 text-white" : "text-slate-700"}`} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function TaskRow({ item }) {
  const [open, setOpen] = useState(false);
  const detailPath = detailPathForItem(item);
  const goDetail = () => {
    window.location.assign(detailPath);
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-3" style={item.timeState?.color ? { backgroundColor: `${item.timeState.color}22`, borderLeft: `4px solid ${item.timeState.color}` } : undefined}>
      <div className="min-w-0 pr-2">
        <p className="truncate text-xs font-medium text-slate-800 sm:text-sm"><span className="font-bold">{item.code}</span> - {item.clienteNombre}</p>
        <p className="hidden text-xs text-slate-500 sm:block">{item.agendaDate} {item.agendaTime} - {item.timeState?.nombre || ""}</p>
        <div className="mt-1 space-y-0.5 text-xs text-slate-500 sm:hidden">
          <p>Asignado: {item.asignadoNombre || "-"}</p>
          <p>Etapa: {item.etapaNombre || "-"}</p>
          <p>Agenda: {[item.agendaDate, item.agendaTime].filter(Boolean).join(" ") || "-"}</p>
        </div>
      </div>
      <div className="relative shrink-0 sm:hidden">
        <Button size="sm" variant="outline" className="h-8 gap-1 px-2" onClick={() => setOpen((current) => !current)}>
          Acciones
          <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
        </Button>
        {open ? (
          <div className="absolute right-0 top-10 z-20 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50" onClick={goDetail}>
              <Eye className="size-4" />
              Abrir
            </button>
          </div>
        ) : null}
      </div>
      <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={goDetail}>Abrir</Button>
    </div>
  );
}

function Table({ title, rows, period, onPeriodChange }) {
  return (
    <section className="mb-4 overflow-hidden rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-violet-700">{title}</h2>
        <PeriodFilter value={period} onChange={onPeriodChange} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm sm:min-w-[760px]">
          <thead>
            <tr className="border-b">
              <th className="py-3">Codigo / Cliente</th>
              <th className="hidden sm:table-cell">Cliente</th>
              <th className="hidden sm:table-cell">Asignado</th>
              <th className="hidden sm:table-cell">Etapa</th>
              <th className="hidden sm:table-cell">Fecha Agenda</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((item) => <PanelTableRow key={`${item.kind}-${item.id}`} item={item} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PanelTableRow({ item }) {
  const [open, setOpen] = useState(false);
  const detailPath = detailPathForItem(item);
  const goDetail = () => {
    window.location.assign(detailPath);
  };

  return (
    <tr>
      <td className="py-3 pr-3 align-top">
        <p className="font-bold text-slate-950">{item.code}</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-700 sm:hidden">{item.clienteNombre}</p>
        <div className="mt-1 space-y-0.5 text-xs text-slate-500 sm:hidden">
          <p>Asignado: {item.asignadoNombre || "-"}</p>
          <p>Etapa: {item.etapaNombre || "-"}</p>
          <p>Agenda: {item.agendaDate || "-"}</p>
        </div>
      </td>
      <td className="hidden sm:table-cell">{item.clienteNombre}</td>
      <td className="hidden sm:table-cell">{item.asignadoNombre}</td>
      <td className="hidden sm:table-cell"><span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">{item.etapaNombre}</span></td>
      <td className="hidden sm:table-cell">{item.agendaDate || "-"}</td>
      <td className="relative py-3 text-right align-top">
        <Button size="sm" variant="outline" className="ml-auto flex h-8 gap-1 px-2 sm:hidden" onClick={() => setOpen((current) => !current)}>
          Acciones
          <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
        </Button>
        {open ? (
          <div className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg sm:hidden">
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50" onClick={goDetail}>
              <Eye className="size-4" />
              Ver
            </button>
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50" onClick={goDetail}>
              <Pencil className="size-4" />
              Editar
            </button>
          </div>
        ) : null}
        <div className="hidden justify-end gap-1 sm:flex">
          <Button size="icon" variant="ghost" onClick={goDetail}><Eye className="size-4" /></Button>
          <Button size="icon" variant="ghost" onClick={goDetail}><Pencil className="size-4" /></Button>
        </div>
      </td>
    </tr>
  );
}

function detailPathForItem(item) {
  return item.kind === "lead" ? `/leads/${item.id}` : `/oportunidades/${item.id}`;
}

function normalizeStage(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchesPeriod(value, period) {
  const date = new Date(value);
  const now = new Date();
  if (Number.isNaN(date.getTime())) return false;
  if (period === "day") return date.toDateString() === now.toDateString();
  if (period === "week") return Math.abs(date - now) <= 7 * 24 * 60 * 60 * 1000;
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}
