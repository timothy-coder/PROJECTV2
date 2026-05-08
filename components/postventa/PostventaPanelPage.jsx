"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePostventaOpportunities } from "@/hooks/postventa/usePostventaOpportunities";
import { hasPerm } from "@/lib/permissions";

export default function PostventaPanelPage({ userPermissions }) {
  const opportunitiesData = usePostventaOpportunities("opportunity");
  const leadsData = usePostventaOpportunities("lead");
  const [period, setPeriod] = useState("month");
  const canViewOpportunities = Boolean(hasPerm(userPermissions, ["oportunidadespv", "view"]) || hasPerm(userPermissions, ["oportunidadespv", "viewall"]));
  const canViewLeads = Boolean(hasPerm(userPermissions, ["leadspv", "view"]) || hasPerm(userPermissions, ["leadspv", "viewall"]));
  const canViewAll = Boolean(
    hasPerm(userPermissions, ["oportunidadespv", "viewall"]) ||
    hasPerm(userPermissions, ["leadspv", "viewall"]) ||
    opportunitiesData.currentUser?.canViewAll ||
    leadsData.currentUser?.canViewAll
  );
  const canView = canViewOpportunities || canViewLeads;
  const opportunities = useMemo(() => opportunitiesData.opportunities.filter((item) => matchesPeriod(item.agendaDate || item.createdAt, period)), [opportunitiesData.opportunities, period]);
  const leads = useMemo(() => leadsData.opportunities.filter((item) => matchesPeriod(item.agendaDate || item.createdAt, period)), [leadsData.opportunities, period]);
  const stages = opportunitiesData.options.stages.length ? opportunitiesData.options.stages : leadsData.options.stages;
  if (!canView) return <div className="rounded-lg bg-white p-4 text-sm text-slate-700">No tienes permiso para ingresar al panel de PostVenta.</div>;
  return (
    <div className="min-w-0 bg-slate-50 p-4 text-slate-950">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-violet-700">Panel de PostVenta</h1>
          <p className="text-sm text-slate-500">{canViewAll ? "Vista completa" : "Mi vista"}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => { opportunitiesData.reload(); leadsData.reload(); }}><RefreshCw className="size-4" /></Button>
      </header>
      <div className="mb-4 flex justify-end"><PeriodFilter value={period} onChange={setPeriod} /></div>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        {canViewOpportunities ? <Stat label="Oportunidades PV" value={opportunities.length} accent="violet" /> : null}
        {canViewLeads ? <Stat label="Leads PV" value={leads.length} accent="red" /> : null}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage) => {
          const op = canViewOpportunities ? opportunities.filter((item) => Number(item.etapaId) === Number(stage.id)).length : 0;
          const ld = canViewLeads ? leads.filter((item) => Number(item.etapaId) === Number(stage.id)).length : 0;
          return <Stat key={stage.id} label={stage.nombre} value={op + ld} sub={`OPPV: ${op} | LDPV: ${ld}`} accent="cyan" />;
        })}
      </div>
      {canViewOpportunities ? <Table title={`Oportunidades - ${opportunities.length} registros`} rows={opportunities} /> : null}
      {canViewLeads ? <Table title={`Leads - ${leads.length} registros`} rows={leads} /> : null}
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  const colors = { violet: "border-violet-300 text-violet-700", red: "border-red-200 text-red-500", cyan: "border-cyan-300 text-cyan-600" };
  return <div className={`rounded-lg border bg-white p-4 shadow-sm ${colors[accent] || ""}`}><p className="text-xs text-slate-600">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p>{sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}</div>;
}

function PeriodFilter({ value, onChange }) {
  return <div className="flex rounded-lg border bg-white p-1">{[["day", "Hoy"], ["week", "Esta semana"], ["month", "Este mes"]].map(([v, l]) => <button key={v} className={`rounded-md px-3 py-1 text-xs font-bold ${value === v ? "bg-slate-950 text-white" : "text-slate-700"}`} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

function Table({ title, rows }) {
  return <section className="mb-4 overflow-hidden rounded-lg border bg-white p-4 shadow-sm"><h2 className="mb-4 font-bold text-violet-700">{title}</h2><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b"><th className="py-3">Codigo</th><th>Cliente</th><th>Vehiculo</th><th>Asignado</th><th>Etapa</th><th>Agenda</th></tr></thead><tbody className="divide-y">{rows.map((item) => <tr key={item.id}><td className="py-3 font-bold">{item.code}</td><td>{item.clienteNombre}</td><td>{item.vehiculoNombre}</td><td>{item.asignadoNombre}</td><td><span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">{item.etapaNombre}</span></td><td>{item.agendaDate || "-"}</td></tr>)}</tbody></table></div></section>;
}

function matchesPeriod(value, period) {
  const date = new Date(value);
  const now = new Date();
  if (Number.isNaN(date.getTime())) return false;
  if (period === "day") return date.toDateString() === now.toDateString();
  if (period === "week") return Math.abs(date - now) <= 7 * 24 * 60 * 60 * 1000;
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}
