"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Edit3, FileText, RefreshCw, Search, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { pointOfSaleQuotesApi } from "@/app/api/point-of-sale-quotes.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasPerm } from "@/lib/permissions";

const money = (value, code = "S/") => `${code || "S/"} ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("aprob") || normalized.includes("envi")) return "bg-emerald-50 text-emerald-700";
  if (normalized.includes("cancel") || normalized.includes("rech")) return "bg-red-50 text-red-700";
  if (normalized.includes("pend")) return "bg-amber-50 text-amber-700";
  return "bg-violet-50 text-violet-700";
}

export default function PointOfSaleQuotesPage({ quotes = [], userPermissions = {} }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todos");
  const [items, setItems] = useState(quotes);
  const [deletingId, setDeletingId] = useState(null);
  const canEdit = hasPerm(userPermissions, ["puntoventa_cotizaciones", "edit"]);
  const canDelete = hasPerm(userPermissions, ["puntoventa_cotizaciones", "delete"]);
  const canSell = hasPerm(userPermissions, ["puntoventa_cotizaciones", "sell"]);

  const statuses = useMemo(() => {
    const values = [...new Set(items.map((quote) => quote.estado || "pendiente"))];
    return ["todos", ...values];
  }, [items]);

  const filteredQuotes = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return items.filter((quote) => {
      const matchesQuery = !clean || `${quote.id} ${quote.codigo} ${quote.cliente} ${quote.documento} ${quote.descripcion} ${quote.creadoPor} ${quote.puntoVentaCodigo}`.toLowerCase().includes(clean);
      const matchesStatus = status === "todos" || quote.estado === status;
      return matchesQuery && matchesStatus;
    });
  }, [items, query, status]);

  const stats = useMemo(() => {
    const total = filteredQuotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0);
    return {
      count: filteredQuotes.length,
      sold: filteredQuotes.filter((quote) => quote.estado === "vendida").length,
      quote: filteredQuotes.filter((quote) => quote.estado === "cotizacion").length,
      total,
    };
  }, [filteredQuotes]);

  async function deleteQuote(quote) {
    if (!window.confirm(`Eliminar la cotizacion ${quote.codigo}?`)) return;
    setDeletingId(quote.id);
    try {
      await pointOfSaleQuotesApi.delete(quote.id);
      setItems((current) => current.filter((item) => item.id !== quote.id));
    } finally {
      setDeletingId(null);
    }
  }

  function openSales(quote, mode) {
    if (mode === "pasar-venta") {
      router.push(`/puntoventa?cotizacionId=${quote.id}&modo=venta`);
      return;
    }
    router.push(`/puntoventa?cotizacionId=${quote.id}&modo=editar`);
  }

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-950">
      <header className="mb-3 flex flex-col gap-3 border-b border-violet-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-base font-bold leading-tight text-violet-700">Cotizaciones</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">Listado de cotizaciones registradas en el sistema</p>
        </div>
        <Button type="button" variant="outline" className="h-9 w-fit" onClick={() => window.location.reload()}>
          <RefreshCw className="size-4" />
          Actualizar
        </Button>
      </header>

      <section className="mb-3 grid gap-2 sm:grid-cols-4">
        <StatCard label="Cotizaciones" value={stats.count} />
        <StatCard label="Pendientes" value={stats.quote} />
        <StatCard label="Pasadas a ventas" value={stats.sold} />
        <StatCard label="Total" value={money(stats.total)} />
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="grid gap-2 border-b bg-slate-50/70 p-3 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por codigo, cliente, documento, caja o creador..."
              className="h-9 bg-white pl-8 text-sm"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 rounded-md border bg-white px-3 text-sm font-semibold text-slate-700"
          >
            {statuses.map((item) => (
              <option key={item} value={item}>{item === "todos" ? "Todos los estados" : item}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Codigo</th>
                <th>Cliente</th>
                <th>Documento</th>
                <th>Items</th>
                <th>Caja</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Creado por</th>
                <th>Fecha</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredQuotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-violet-50/30">
                  <td className="px-3 py-3 font-black text-violet-700">{quote.codigo || `#${quote.id}`}</td>
                  <td>
                    <p className="font-bold text-slate-900">{quote.cliente || "-"}</p>
                    <p className="text-xs text-slate-400">{quote.puntoVentaCodigo || "Sin caja"}</p>
                  </td>
                  <td className="text-slate-600">{quote.documento || "-"}</td>
                  <td className="max-w-[280px] truncate text-slate-600">{quote.descripcion || "-"}</td>
                  <td><span className="rounded-full border px-2 py-1 text-xs font-bold uppercase text-slate-600">{quote.puntoVentaCodigo || "-"}</span></td>
                  <td className="font-black text-emerald-700">{money(quote.total, quote.monedaCodigo || quote.monedaSimbolo || "S/")}</td>
                  <td><span className={`rounded-full px-2 py-1 text-xs font-black ${statusClass(quote.estado)}`}>{quote.estado || "pendiente"}</span></td>
                  <td>{quote.creadoPor || "-"}</td>
                  <td>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <CalendarClock className="size-3.5" />
                      {formatDate(quote.createdAt)}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      {canEdit ? (
                        <Button type="button" variant="ghost" size="icon" title="Editar en ventas" onClick={() => openSales(quote, "editar")}>
                          <Edit3 className="size-4 text-violet-700" />
                        </Button>
                      ) : null}
                      {canSell ? (
                        <Button type="button" variant="ghost" size="icon" title="Pasar a ventas" onClick={() => openSales(quote, "pasar-venta")}>
                          <Send className="size-4 text-emerald-700" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Eliminar"
                          disabled={deletingId === quote.id}
                          onClick={() => deleteQuote(quote)}
                        >
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredQuotes.length ? (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center">
                    <FileText className="mx-auto mb-2 size-7 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-500">No hay cotizaciones para mostrar.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-sm">
      <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-violet-700">{value}</p>
    </div>
  );
}
