"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Clock, Eye, FileText, Filter, MoreVertical, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReservations } from "@/hooks/reservations/useReservations";

export default function ReservationsPage() {
  const { reservations, stats, loading } = useReservations();
  const [filters, setFilters] = useState({ query: "", estado: "", firma: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(null);
  const rows = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return reservations.filter((row) => {
      const matchesQuery = !query || `${row.id} ${row.oportunidadCode} ${row.cliente} ${row.creadoPor}`.toLowerCase().includes(query);
      const matchesState = !filters.estado || row.estado === filters.estado;
      const signed = row.estado === "firmado";
      const matchesFirma = !filters.firma || (filters.firma === "firmado" ? signed : !signed);
      return matchesQuery && matchesState && matchesFirma;
    });
  }, [filters, reservations]);
  return (
    <div className="min-h-full bg-slate-50 p-4 text-slate-950">
      <header className="mb-5 border-b border-slate-200 pb-4">
        <h1 className="text-base font-bold leading-tight text-violet-700">Notas de Pedido</h1>
        <p className="mt-0.5 text-xs font-medium text-violet-400">Gestiona todas tus notas de pedido y el proceso de firma</p>
      </header>
      <div className="mb-4 grid grid-cols-3 gap-2 md:mb-5 md:grid-cols-3 md:gap-3">
        <Stat label="Total" value={stats.total || 0} icon={FileText} tone="blue" />
        <Stat label="Firmadas" value={stats.firmadas || 0} icon={CheckCircle2} tone="green" />
        <Stat label="Pendientes" value={stats.pendientes || 0} icon={Clock} tone="yellow" />
      </div>
      <section className="mb-3 rounded-lg border bg-white shadow-sm md:mb-5">
        <button type="button" className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left text-sm font-bold md:pointer-events-none" onClick={() => setFiltersOpen((value) => !value)}>
          <span className="inline-flex items-center gap-2"><Filter className="size-4 text-violet-600" />Filtros</span>
          <ChevronDown className={`size-4 transition md:hidden ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
        <div className={`${filtersOpen ? "grid" : "hidden"} gap-3 p-4 md:grid md:grid-cols-[1fr_180px_180px_240px]`}>
          <div>
            <LabelText>Buscar</LabelText>
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="ID, cliente, creador..." value={filters.query} onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))} /></div>
          </div>
          <SelectBox label="Estado" value={filters.estado} onChange={(value) => setFilters((f) => ({ ...f, estado: value }))} options={[["", "Todos"], ["borrador", "Borrador"], ["enviado_firma", "Enviado a Firma"], ["observado", "Observado"], ["subsanado", "Subsanado"], ["firmado", "Firmado"]]} />
          <SelectBox label="Firma" value={filters.firma} onChange={(value) => setFilters((f) => ({ ...f, firma: value }))} options={[["", "Todas"], ["firmado", "Firmado"], ["pendiente", "Pendiente"]]} />
          <div className="flex items-end"><Button variant="outline" className="w-full" onClick={() => setFilters({ query: "", estado: "", firma: "" })}>Limpiar Filtros</Button></div>
        </div>
        <p className="px-4 pb-3 text-xs text-slate-500 md:pb-4 md:text-sm">Mostrando {rows.length} de {reservations.length} reservas</p>
      </section>
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="hidden overflow-x-auto rounded-lg border md:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold"><tr><th className="px-3 py-3">ID</th><th>Oportunidad</th><th>Cliente</th><th>Creado Por</th><th>Estado</th><th>Firmas</th><th>Fecha</th><th className="text-right">Acciones</th></tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={8} className="py-10 text-center text-slate-500">Cargando...</td></tr> : rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 font-bold text-blue-700">#{row.id}</td>
                  <td>{row.oportunidadCode}</td>
                  <td className="font-bold">{row.cliente}</td>
                  <td>{row.creadoPor}</td>
                  <td><StatusBadge estado={row.estado} /></td>
                  <td><SignatureProgress estado={row.estado} /></td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td className="text-right">
                    <Link className="mr-2 inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-slate-50" href={`/reservas/${row.id}`}><Eye className="size-4" />Ver</Link>
                    {row.oportunidadId ? <Link className="inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium hover:bg-slate-50" href={`/oportunidades/${row.oportunidadId}`}>Oportunidad</Link> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-visible rounded-lg border md:hidden">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-[56px] px-2 py-2">ID</th>
                <th className="px-2 py-2">Cliente</th>
                <th className="w-[86px] px-2 py-2">Estado</th>
                <th className="w-[58px] px-2 py-2 text-right">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={4} className="py-10 text-center text-slate-500">Cargando...</td></tr>
              ) : rows.length ? rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-2 py-3 font-bold text-blue-700">#{row.id}</td>
                  <td className="px-2 py-3">
                    <div className="break-words text-[11px] font-semibold leading-tight text-slate-900">{row.cliente}</div>
                    <div className="mt-1 break-words text-[10px] font-medium leading-tight text-slate-500">{row.oportunidadCode}</div>
                  </td>
                  <td className="px-2 py-3"><StatusBadge estado={row.estado} compact /></td>
                  <td className="relative px-2 py-3 text-right">
                    <button type="button" className="inline-flex size-8 items-center justify-center rounded-md border bg-white text-slate-700 shadow-sm" onClick={() => setMobileMenu((value) => (value === row.id ? null : row.id))} aria-label="Opciones">
                      <MoreVertical className="size-4" />
                    </button>
                    {mobileMenu === row.id ? (
                      <div className="absolute right-2 top-11 z-30 w-36 rounded-lg border bg-white p-1 text-left text-[11px] font-semibold shadow-xl">
                        <Link className="flex items-center gap-2 rounded-md px-2 py-2 text-slate-700 hover:bg-slate-100" href={`/reservas/${row.id}`} onClick={() => setMobileMenu(null)}><Eye className="size-3.5" />Ver reserva</Link>
                        {row.oportunidadId ? <Link className="block rounded-md px-2 py-2 text-slate-700 hover:bg-slate-100" href={`/oportunidades/${row.oportunidadId}`} onClick={() => setMobileMenu(null)}>Oportunidad</Link> : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-10 text-center text-slate-500">No hay reservas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }) {
  const tones = { blue: "border-blue-200 bg-blue-50 text-blue-700", green: "border-emerald-200 bg-emerald-50 text-emerald-700", yellow: "border-yellow-200 bg-yellow-50 text-yellow-700" };
  return <div className={`flex min-h-[68px] items-center justify-between rounded-lg border p-2 md:min-h-24 md:p-4 ${tones[tone]}`}><div><p className="text-[10px] font-bold leading-tight md:text-xs">{label}</p><p className="mt-2 text-lg font-bold text-slate-950 md:mt-3 md:text-2xl">{value}</p></div><Icon className="size-5 opacity-40 md:size-9" /></div>;
}

function SelectBox({ label, value, onChange, options }) {
  return <label className="block"><LabelText>{label}</LabelText><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}
function LabelText({ children }) { return <span className="mb-1 block text-xs font-bold text-slate-500">{children}</span>; }
function StatusBadge({ estado, compact = false }) {
  const tone = estado === "firmado" ? "bg-emerald-100 text-emerald-700" : estado === "observado" ? "bg-yellow-100 text-yellow-700" : estado === "enviado_firma" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700";
  const label = String(estado || "").replaceAll("_", " ");
  return <span className={`inline-flex max-w-full rounded-full px-2 py-1 font-bold capitalize leading-tight ${compact ? "text-[9px]" : "text-xs"} ${tone}`}>{label}</span>;
}
function SignatureProgress({ estado }) {
  const percent = estado === "firmado" ? 100 : 0;
  return (
    <div className="text-xs">
      {percent}% Completo
      <div className="mt-1 h-1.5 w-24 rounded-full bg-slate-200">
        <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
function formatDate(value) { return value ? new Date(value).toLocaleDateString("es-PE") : "-"; }
