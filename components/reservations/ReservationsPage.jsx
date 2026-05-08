"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Eye, FileText, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReservations } from "@/hooks/reservations/useReservations";

export default function ReservationsPage() {
  const { reservations, stats, loading } = useReservations();
  const [filters, setFilters] = useState({ query: "", estado: "", firma: "" });
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
        <h1 className="text-3xl font-bold">Reservas</h1>
        <p className="mt-1 text-sm text-slate-600">Gestiona todas tus reservas y el proceso de firma</p>
      </header>
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <Stat label="Total" value={stats.total || 0} icon={FileText} tone="blue" />
        <Stat label="Firmadas" value={stats.firmadas || 0} icon={CheckCircle2} tone="green" />
        <Stat label="Pendientes" value={stats.pendientes || 0} icon={Clock} tone="yellow" />
        <Stat label="Por Revisar" value={stats.revisar || 0} icon={AlertCircle} tone="red" />
      </div>
      <section className="mb-5 rounded-lg border bg-white shadow-sm">
        <div className="bg-slate-50 px-4 py-3 font-bold">Filtros</div>
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_240px]">
          <div>
            <LabelText>Buscar</LabelText>
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="ID, cliente, creador..." value={filters.query} onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))} /></div>
          </div>
          <SelectBox label="Estado" value={filters.estado} onChange={(value) => setFilters((f) => ({ ...f, estado: value }))} options={[["", "Todos"], ["borrador", "Borrador"], ["enviado_firma", "Enviado a Firma"], ["observado", "Observado"], ["subsanado", "Subsanado"], ["firmado", "Firmado"]]} />
          <SelectBox label="Firma" value={filters.firma} onChange={(value) => setFilters((f) => ({ ...f, firma: value }))} options={[["", "Todas"], ["firmado", "Firmado"], ["pendiente", "Pendiente"]]} />
          <div className="flex items-end"><Button variant="outline" className="w-full" onClick={() => setFilters({ query: "", estado: "", firma: "" })}>Limpiar Filtros</Button></div>
        </div>
        <p className="px-4 pb-4 text-sm text-slate-500">Mostrando {rows.length} de {reservations.length} reservas</p>
      </section>
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="overflow-x-auto rounded-lg border">
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
                  <td><div className="text-xs">0% Completo<div className="mt-1 h-1.5 w-24 rounded-full bg-slate-200"><div className={`h-1.5 rounded-full ${row.estado === "firmado" ? "w-full bg-emerald-500" : "w-0"}`} /></div></div></td>
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
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }) {
  const tones = { blue: "border-blue-200 bg-blue-50 text-blue-700", green: "border-emerald-200 bg-emerald-50 text-emerald-700", yellow: "border-yellow-200 bg-yellow-50 text-yellow-700", red: "border-red-200 bg-red-50 text-red-700" };
  return <div className={`flex min-h-24 items-center justify-between rounded-lg border p-4 ${tones[tone]}`}><div><p className="text-xs font-bold">{label}</p><p className="mt-3 text-2xl font-bold text-slate-950">{value}</p></div><Icon className="size-9 opacity-40" /></div>;
}

function SelectBox({ label, value, onChange, options }) {
  return <label className="block"><LabelText>{label}</LabelText><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}
function LabelText({ children }) { return <span className="mb-1 block text-xs font-bold text-slate-500">{children}</span>; }
function StatusBadge({ estado }) {
  const tone = estado === "firmado" ? "bg-emerald-100 text-emerald-700" : estado === "observado" ? "bg-yellow-100 text-yellow-700" : estado === "enviado_firma" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{estado}</span>;
}
function formatDate(value) { return value ? new Date(value).toLocaleDateString("es-PE") : "-"; }
