"use client";

import { useMemo, useState } from "react";
import { Eye, Pencil, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSalesAgenda } from "@/hooks/salesagenda/useSalesAgenda";
import { hasPerm } from "@/lib/permissions";

export default function SalesPanelPage({ userPermissions }) {
  const data = useSalesAgenda();
  const [taskPeriod, setTaskPeriod] = useState("day");
  const [opportunityPeriod, setOpportunityPeriod] = useState("day");
  const [leadPeriod, setLeadPeriod] = useState("day");
  const canViewAll = Boolean(hasPerm(userPermissions, ["agenda", "viewall"]) || data.currentUser?.canViewAll);

  const allOpportunities = useMemo(() => data.items.filter((item) => item.kind === "opportunity"), [data.items]);
  const allLeads = useMemo(() => data.items.filter((item) => item.kind === "lead"), [data.items]);
  const opportunities = useMemo(
    () => allOpportunities.filter((item) => matchesPeriod(item.agendaDate || new Date(), opportunityPeriod)),
    [allOpportunities, opportunityPeriod]
  );
  const leads = useMemo(
    () => allLeads.filter((item) => matchesPeriod(item.agendaDate || new Date(), leadPeriod)),
    [allLeads, leadPeriod]
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
          <h1 className="text-3xl font-bold text-violet-700">Panel de Ventas</h1>
          <p className="text-sm text-slate-500">{canViewAll ? "Vista completa" : "Mi vista"}</p>
        </div>
        <Button variant="outline" size="icon" onClick={data.reload}>
          <RefreshCw className="size-4" />
        </Button>
      </header>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <Stat label="OPO Totales" value={allOpportunities.length} accent="violet" />
        <Stat label="Leads Totales" value={allLeads.length} accent="red" />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stages.map((stage) => {
          const op = allOpportunities.filter((item) => Number(item.etapaId) === Number(stage.id)).length;
          const ld = allLeads.filter((item) => Number(item.etapaId) === Number(stage.id)).length;
          return <Stat key={stage.id} label={stage.nombre} value={op + ld} sub={`OPO: ${op} | LD: ${ld}`} accent="cyan" />;
        })}
      </div>

      <section className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-violet-700">Tareas - {tasks.length} registros</h2>
          <PeriodFilter value={taskPeriod} onChange={setTaskPeriod} />
        </div>
        <div className="space-y-2">
          {tasks.map((item) => <TaskRow key={item.id} item={item} />)}
          {!tasks.length ? <p className="py-8 text-center text-sm text-slate-500">No hay items en agenda para este periodo</p> : null}
        </div>
      </section>

      <Table title={`Oportunidades - ${opportunities.length} registros`} rows={opportunities} period={opportunityPeriod} onPeriodChange={setOpportunityPeriod} />
      <Table title={`Leads - ${leads.length} registros`} rows={leads} period={leadPeriod} onPeriodChange={setLeadPeriod} />
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  const colors = { violet: "border-violet-300 text-violet-700", red: "border-red-200 text-red-500", cyan: "border-cyan-300 text-cyan-600" };
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${colors[accent] || ""}`}>
      <p className="text-xs text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
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
  const detailPath = item.kind === "lead" ? `/leads/${item.id}` : `/oportunidades/${item.id}`;
  return (
    <div className="flex items-center justify-between rounded-lg border p-3" style={item.timeState?.color ? { backgroundColor: `${item.timeState.color}22`, borderLeft: `4px solid ${item.timeState.color}` } : undefined}>
      <div>
        <p className="font-bold">{item.code} - {item.clienteNombre}</p>
        <p className="text-xs text-slate-500">{item.agendaDate} {item.agendaTime} - {item.timeState?.nombre || ""}</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => { window.location.href = detailPath; }}>Abrir</Button>
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
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-3">Codigo</th>
              <th>Cliente</th>
              <th>Asignado</th>
              <th>Etapa</th>
              <th>Fecha Agenda</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((item) => {
              const detailPath = item.kind === "lead" ? `/leads/${item.id}` : `/oportunidades/${item.id}`;
              return (
                <tr key={item.id}>
                  <td className="py-3 font-bold">{item.code}</td>
                  <td>{item.clienteNombre}</td>
                  <td>{item.asignadoNombre}</td>
                  <td><span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">{item.etapaNombre}</span></td>
                  <td>{item.agendaDate || "-"}</td>
                  <td className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { window.location.href = detailPath; }}><Eye className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { window.location.href = detailPath; }}><Pencil className="size-4" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
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
