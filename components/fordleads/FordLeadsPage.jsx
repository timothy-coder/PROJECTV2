"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Check, ChevronDown, ChevronsUpDown, Eye, Filter, Loader2, MoreVertical, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasPerm } from "@/lib/permissions";

const TYPE_STATUS_OPTIONS = [
  "",
  "New",
  "Contacted",
  "Closed Won",
  "Closed Lost",
];

const CLOSED_TYPE_STATUS = new Set(["Closed Won", "Closed Lost"]);

function todayStartDateTimeLocal() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00:00`;
}

function normalizeDateTime(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";
  const clean = text.replace(" ", "T").replace(".000Z", "Z").replace(/[zZ]$/, "");
  const [datePart, timePart = "00:00:00"] = clean.split("T");
  const timePieces = timePart.split(":");
  const hours = timePieces[0] || "00";
  const minutes = timePieces[1] || "00";
  const seconds = timePieces[2] || "00";
  return `${datePart}T${hours}:${minutes}:${seconds}Z`;
}

function contactName(contact = {}) {
  return contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "-";
}

function vehicleName(vehicle = {}) {
  return [vehicle.model, vehicle.version].filter(Boolean).join(" ") || "-";
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.detail ? ` ${JSON.stringify(payload.detail)}` : "";
    throw new Error(`${payload?.message || "Ocurrio un error."}${detail}`);
  }
  return payload;
}

function formatFordDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function itemSearchText(item = {}) {
  return [
    item.id,
    item.status,
    item.contact?.name,
    item.contact?.firstName,
    item.contact?.lastName,
    item.contact?.documentNumber,
    item.contact?.email,
    item.contact?.phone,
    item.contact?.mobilePhone,
    item.vehicle?.brand,
    item.vehicle?.marca,
    item.vehicle?.model,
    item.vehicle?.modelo,
    item.vehicle?.version,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function uniqueOptions(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function sortDirectionFor(current, key) {
  return current.key === key && current.direction === "asc" ? "desc" : "asc";
}

function isEmptySortValue(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function isNumericSortValue(value) {
  return /^-?\d+(\.\d+)?$/.test(String(value).trim());
}

function isDateSortValue(value) {
  const text = String(value || "").trim();
  return /(\d{4}-\d{2}-\d{2}|T|\d{1,2}\/\d{1,2}\/\d{2,4})/.test(text) && !Number.isNaN(new Date(text).getTime());
}

function compareSortValues(leftValue, rightValue) {
  const leftEmpty = isEmptySortValue(leftValue);
  const rightEmpty = isEmptySortValue(rightValue);
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  if (isNumericSortValue(leftValue) && isNumericSortValue(rightValue)) {
    return Number(leftValue) - Number(rightValue);
  }

  if (isDateSortValue(leftValue) && isDateSortValue(rightValue)) {
    return new Date(leftValue).getTime() - new Date(rightValue).getTime();
  }

  return String(leftValue).localeCompare(String(rightValue), "es", { numeric: true, sensitivity: "base" });
}

function sortRows(rows, sortConfig, accessors) {
  const accessor = accessors[sortConfig.key];
  if (!accessor) return rows;
  const direction = sortConfig.direction === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => {
    const leftValue = accessor(left);
    const rightValue = accessor(right);
    const leftEmpty = isEmptySortValue(leftValue);
    const rightEmpty = isEmptySortValue(rightValue);
    if (leftEmpty && rightEmpty) return 0;
    if (leftEmpty) return 1;
    if (rightEmpty) return -1;
    return compareSortValues(leftValue, rightValue) * direction;
  });
}

function SortableHeader({ children, className = "px-3 py-2", onSort, sortConfig, sortKey }) {
  const active = sortConfig.key === sortKey;
  return (
    <th className={className}>
      <button type="button" className="inline-flex items-center gap-1 font-bold uppercase hover:text-violet-900" onClick={() => onSort(sortKey)}>
        <span>{children}</span>
        {active ? <span className="text-[10px]">{sortConfig.direction === "asc" ? "ASC" : "DESC"}</span> : <ArrowUpDown className="size-3 opacity-60" />}
      </button>
    </th>
  );
}

const FORD_SORT_ACCESSORS = {
  id: (item) => item.id,
  status: (item) => item.status,
  cliente: (item) => contactName(item.contact),
  contacto: (item) => item.contact?.email || item.contact?.mobilePhone || item.contact?.phone,
  vehiculo: (item) => vehicleName(item.vehicle),
  modificado: (item) => item.lastModifiedDate || item.createdDate,
};

const SENT_SORT_ACCESSORS = {
  oportunidad: (item) => item.oportunidadCodigo,
  token: (item) => item.token,
  cliente: (item) => item.clienteNombre,
  modelo: (item) => item.vehiculoNombre || item.modeloNombre,
  contacto: (item) => item.email || item.celular,
  estado: (item) => (item.isActualized ? "Actualizado" : "Pendiente"),
  asesor: (item) => item.asesorNombre || item.creadoPorNombre,
  fecha: (item) => item.createdAt,
};

export default function FordLeadsPage({ userPermissions = {} }) {
  const canSync = hasPerm(userPermissions, ["leads_ford", "sync"]);
  const canCreate = hasPerm(userPermissions, ["leads_ford", "create"]);
  const canEdit = hasPerm(userPermissions, ["leads_ford", "edit"]);

  const [startDate, setStartDate] = useState(() => todayStartDateTimeLocal());
  const [endDate, setEndDate] = useState("");
  const [typeStatus, setTypeStatus] = useState("");
  const [typeStatusOpen, setTypeStatusOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sentModelFilter, setSentModelFilter] = useState("");
  const [sentAdvisorFilter, setSentAdvisorFilter] = useState("");
  const [sentStartDate, setSentStartDate] = useState("");
  const [sentEndDate, setSentEndDate] = useState("");
  const [tab, setTab] = useState("ford");
  const [items, setItems] = useState([]);
  const [sentItems, setSentItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sentLoading, setSentLoading] = useState(false);
  const [importingOpportunities, setImportingOpportunities] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [message, setMessage] = useState("");
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileLeadMenu, setMobileLeadMenu] = useState(null);
  const [fordSort, setFordSort] = useState({ key: "", direction: "asc" });
  const [sentSort, setSentSort] = useState({ key: "", direction: "asc" });

  const status = useMemo(() => (CLOSED_TYPE_STATUS.has(typeStatus) ? "closed" : "open"), [typeStatus]);
  const filteredItems = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => itemSearchText(item).includes(needle));
  }, [items, searchTerm]);
  const sortedItems = useMemo(() => sortRows(filteredItems, fordSort, FORD_SORT_ACCESSORS), [filteredItems, fordSort]);
  const visibleLeadIds = useMemo(() => sortedItems.map((item) => item.id).filter(Boolean), [sortedItems]);
  const allVisibleSelected = visibleLeadIds.length > 0 && visibleLeadIds.every((id) => selectedLeadIds.includes(id));
  const filteredSentItems = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const start = sentStartDate ? new Date(`${sentStartDate}T00:00:00`) : null;
    const end = sentEndDate ? new Date(`${sentEndDate}T23:59:59`) : null;
    return sentItems.filter((item) => {
      const text = [
        item.oportunidadCodigo,
        item.token,
        item.clienteNombre,
        item.email,
        item.celular,
        item.creadoPorNombre,
        item.asesorNombre,
        item.modeloNombre,
        item.version,
        item.vehiculoNombre,
      ].filter(Boolean).join(" ").toLowerCase();
      const itemDate = item.createdAt ? new Date(item.createdAt) : null;
      const matchText = !needle || text.includes(needle);
      const matchModel = !sentModelFilter || String(item.modeloNombre || "") === sentModelFilter;
      const matchAdvisor = !sentAdvisorFilter || String(item.asesorNombre || "") === sentAdvisorFilter;
      const matchStart = !start || (itemDate && itemDate >= start);
      const matchEnd = !end || (itemDate && itemDate <= end);
      return matchText && matchModel && matchAdvisor && matchStart && matchEnd;
    });
  }, [sentItems, searchTerm, sentAdvisorFilter, sentEndDate, sentModelFilter, sentStartDate]);
  const sortedSentItems = useMemo(() => sortRows(filteredSentItems, sentSort, SENT_SORT_ACCESSORS), [filteredSentItems, sentSort]);
  const sentModelOptions = useMemo(() => uniqueOptions(sentItems.map((item) => item.modeloNombre).filter(Boolean)), [sentItems]);
  const sentAdvisorOptions = useMemo(() => uniqueOptions(sentItems.map((item) => item.asesorNombre).filter(Boolean)), [sentItems]);

  function handleFordSort(key) {
    setFordSort((current) => ({ key, direction: sortDirectionFor(current, key) }));
  }

  function handleSentSort(key) {
    setSentSort((current) => ({ key, direction: sortDirectionFor(current, key) }));
  }

  async function searchLeads({ silent = false } = {}) {
    if (!canSync) return;
    setLoading(true);
    if (!silent) setMessage("");
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", normalizeDateTime(startDate));
      if (endDate) params.set("endDate", normalizeDateTime(endDate));
      if (status) params.set("status", status);
      if (typeStatus) params.set("typeStatus", typeStatus);

      const data = await fetch(`/api/ford-leads?${params.toString()}`).then(readJson);
      setItems(data.items || []);
      setSelectedLeadIds([]);
      setMessage(`Se encontraron ${data.items?.length || 0} leads.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSentLeads() {
    setSentLoading(true);
    setMessage("");
    try {
      const data = await fetch("/api/ford-leads?sentTokens=1").then(readJson);
      setSentItems(data.items || []);
      setMessage(`Se encontraron ${data.items?.length || 0} leads enviados a Ford.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSentLoading(false);
    }
  }

  function toggleLeadSelection(id) {
    if (!id) return;
    setSelectedLeadIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    setSelectedLeadIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleLeadIds.includes(id));
      return Array.from(new Set([...current, ...visibleLeadIds]));
    });
  }

  async function createOpportunitiesNow({ selectedOnly = false } = {}) {
    if (!canSync) return;
    const leadIds = selectedOnly ? selectedLeadIds : [];
    if (selectedOnly && !leadIds.length) {
      setMessage("Selecciona al menos un lead.");
      return;
    }
    setImportingOpportunities(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      params.set("force", "1");
      if (startDate) params.set("startDate", normalizeDateTime(startDate));
      if (endDate) params.set("endDate", normalizeDateTime(endDate));
      if (status) params.set("status", status);
      if (typeStatus) params.set("typeStatus", typeStatus);

      const data = await fetch(`/api/ford-leads/sync-opportunities?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }),
      }).then(readJson);
      const created = data.created?.length || 0;
      const skipped = data.skipped?.length || 0;
      setMessage(`Oportunidades creadas: ${created}. Omitidas: ${skipped}.`);
      setSelectedLeadIds([]);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setImportingOpportunities(false);
    }
  }

  useEffect(() => {
    if (!canSync) return;
    let cancelled = false;
    Promise.resolve().then(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("startDate", normalizeDateTime(todayStartDateTimeLocal()));
        params.set("status", "open");
          const data = await fetch(`/api/ford-leads?${params.toString()}`).then(readJson);
        if (!cancelled) {
          setItems(data.items || []);
          setSelectedLeadIds([]);
          setMessage(`Se encontraron ${data.items?.length || 0} leads.`);
        }
      } catch (error) {
        if (!cancelled) setMessage(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [canSync]);

  useEffect(() => {
    if (tab !== "sent") return;
    Promise.resolve().then(loadSentLeads);
  }, [tab]);

  return (
    <div className="min-h-[calc(100svh-80px)] space-y-3 bg-slate-50 p-2 text-black sm:p-3 lg:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-violet-200 bg-slate-50 px-1 pb-3">
        <div>
          <h1 className="text-base font-bold leading-tight text-violet-700">Leads Ford</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">Consulta, crea y actualiza leads usando la configuracion Ford del entorno.</p>
        </div>
        <div className="relative sm:hidden">
          <Button variant="outline" className="border-violet-200 bg-white text-violet-700 hover:bg-violet-50" onClick={() => setMobileActionsOpen((open) => !open)}>
            Acciones
            <ChevronDown className={`ml-2 size-4 transition ${mobileActionsOpen ? "rotate-180" : ""}`} />
          </Button>
          {mobileActionsOpen ? (
            <div className="fixed left-3 right-3 top-20 z-50 rounded-lg border border-violet-200 bg-white p-1 text-sm shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-56">
              {canSync ? (
                <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-semibold text-violet-700 hover:bg-violet-50" disabled={importingOpportunities || !selectedLeadIds.length} onClick={() => { setMobileActionsOpen(false); createOpportunitiesNow({ selectedOnly: true }); }}>
                  Crear seleccionados
                </button>
              ) : null}
              {canSync ? (
                <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-semibold text-violet-700 hover:bg-violet-50" disabled={importingOpportunities} onClick={() => { setMobileActionsOpen(false); createOpportunitiesNow({ selectedOnly: false }); }}>
                  Crear todos
                </button>
              ) : null}
              {canCreate ? (
                <Link href="/leads-ford/nuevo" className="block rounded-md px-3 py-2 font-semibold text-violet-700 hover:bg-violet-50" onClick={() => setMobileActionsOpen(false)}>
                  Agregar Lead
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="hidden flex-wrap gap-2 sm:flex">
          {canSync ? (
            <Button variant="outline" className="border-violet-200 text-violet-700 hover:bg-violet-50" onClick={() => createOpportunitiesNow({ selectedOnly: true })} disabled={importingOpportunities || !selectedLeadIds.length}>
              {importingOpportunities ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              Crear seleccionados
            </Button>
          ) : null}
          {canSync ? (
            <Button variant="outline" className="border-violet-200 text-violet-700 hover:bg-violet-50" onClick={() => createOpportunitiesNow({ selectedOnly: false })} disabled={importingOpportunities}>
              {importingOpportunities ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              Crear todos
            </Button>
          ) : null}
          {canCreate ? (
            <Link href="/leads-ford/nuevo">
              <Button className="bg-violet-700 text-white hover:bg-violet-800">
                <Send className="mr-2 size-4" />
                Agregar Lead
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <section className="bg-white p-2 shadow-sm sm:p-3">
        <div className="mb-3 flex flex-wrap gap-2">
          <Button type="button" variant={tab === "ford" ? "default" : "outline"} className={tab === "ford" ? "bg-violet-700 text-white hover:bg-violet-800" : "border-violet-200 text-violet-700 hover:bg-violet-50"} onClick={() => setTab("ford")}>
            Leads Ford
          </Button>
          <Button type="button" variant={tab === "sent" ? "default" : "outline"} className={tab === "sent" ? "bg-violet-700 text-white hover:bg-violet-800" : "border-violet-200 text-violet-700 hover:bg-violet-50"} onClick={() => setTab("sent")}>
            Enviados desde sistema
          </Button>
        </div>

        {tab === "sent" ? (
          <div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_180px_180px_160px_160px_auto_auto]">
              <Field label="Buscar">
                <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Token, oportunidad, cliente, modelo..." />
              </Field>
              <Field label="Modelo">
                <NativeSelect value={sentModelFilter} onChange={(event) => setSentModelFilter(event.target.value)} options={[["", "Todos"], ...sentModelOptions.map((item) => [item, item])]} />
              </Field>
              <Field label="Asesor">
                <NativeSelect value={sentAdvisorFilter} onChange={(event) => setSentAdvisorFilter(event.target.value)} options={[["", "Todos"], ...sentAdvisorOptions.map((item) => [item, item])]} />
              </Field>
              <Field label="Desde">
                <Input type="date" value={sentStartDate} onChange={(event) => setSentStartDate(event.target.value)} />
              </Field>
              <Field label="Hasta">
                <Input type="date" value={sentEndDate} onChange={(event) => setSentEndDate(event.target.value)} />
              </Field>
              <div className="flex items-end">
                <Button variant="outline" className="w-full border-violet-200 text-violet-700 hover:bg-violet-50" onClick={() => { setSearchTerm(""); setSentModelFilter(""); setSentAdvisorFilter(""); setSentStartDate(""); setSentEndDate(""); }}>
                  Limpiar
                </Button>
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="w-full border-violet-200 text-violet-700 hover:bg-violet-50" onClick={loadSentLeads} disabled={sentLoading}>
                  {sentLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Actualizar
                </Button>
              </div>
            </div>

            {message ? <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">{message}</div> : null}

            <div className="mt-3 overflow-hidden rounded-lg border border-violet-200">
              <div className="flex items-center justify-between border-b border-violet-200 bg-violet-50 px-3 py-2">
                <h2 className="text-sm font-bold text-violet-700">Leads enviados a Ford</h2>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-700">{filteredSentItems.length} visibles</span>
              </div>
              <div className="max-h-[calc(100svh-360px)] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-violet-50 text-left text-xs uppercase text-violet-700">
                    <tr>
                      <SortableHeader sortKey="oportunidad" sortConfig={sentSort} onSort={handleSentSort}>Oportunidad</SortableHeader>
                      <SortableHeader sortKey="token" sortConfig={sentSort} onSort={handleSentSort}>Token Ford</SortableHeader>
                      <SortableHeader sortKey="cliente" sortConfig={sentSort} onSort={handleSentSort}>Cliente</SortableHeader>
                      <SortableHeader sortKey="modelo" sortConfig={sentSort} onSort={handleSentSort}>Modelo</SortableHeader>
                      <SortableHeader sortKey="contacto" sortConfig={sentSort} onSort={handleSentSort}>Contacto</SortableHeader>
                      <SortableHeader sortKey="estado" sortConfig={sentSort} onSort={handleSentSort}>Estado</SortableHeader>
                      <SortableHeader sortKey="asesor" sortConfig={sentSort} onSort={handleSentSort}>Asesor</SortableHeader>
                      <SortableHeader sortKey="fecha" sortConfig={sentSort} onSort={handleSentSort}>Fecha</SortableHeader>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {sentLoading ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-10 text-center text-black">Cargando enviados...</td>
                      </tr>
                    ) : null}
                    {!sentLoading && sortedSentItems.map((item) => (
                      <tr key={item.id} className="hover:bg-violet-50/50">
                        <td className="px-3 py-2 font-bold text-violet-700">{item.oportunidadCodigo || "-"}</td>
                        <td className="max-w-[230px] truncate px-3 py-2 font-mono text-xs">{item.token || "-"}</td>
                        <td className="px-3 py-2">{item.clienteNombre || "-"}</td>
                        <td className="px-3 py-2">{item.vehiculoNombre || item.modeloNombre || "-"}</td>
                        <td className="px-3 py-2">{item.email || item.celular || "-"}</td>
                        <td className="px-3 py-2">{item.isActualized ? "Actualizado" : "Pendiente"}</td>
                        <td className="px-3 py-2">{item.asesorNombre || item.creadoPorNombre || "-"}</td>
                        <td className="px-3 py-2">{formatFordDate(item.createdAt)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-2">
                          {item.oportunidadId ? (
                            <Link href={`/oportunidades/${item.oportunidadId}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-violet-200 px-3 text-xs font-bold text-violet-700 hover:bg-violet-50" title="Ver oportunidad">
                              <Eye className="size-4" />Ver oportunidad
                            </Link>
                          ) : null}
                          {item.token ? (
                            <Link href={`/leads-ford/${encodeURIComponent(item.token)}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-violet-200 px-3 text-xs font-bold text-violet-700 hover:bg-violet-50" title="Ver detalle Ford">
                              <Eye className="size-4" />Ver Ford
                            </Link>
                          ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!sentLoading && !filteredSentItems.length ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-10 text-center text-slate-600">No hay leads enviados desde el sistema.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
        <div>
          <button type="button" className="mb-2 flex h-9 w-full items-center justify-between rounded-md border border-violet-200 bg-white px-3 text-xs font-bold text-violet-700 sm:hidden" onClick={() => setMobileFiltersOpen((open) => !open)}>
            Filtros
            <ChevronDown className={`size-4 transition ${mobileFiltersOpen ? "rotate-180" : ""}`} />
          </button>
          <div className={`${mobileFiltersOpen ? "grid" : "hidden"} gap-3 sm:grid md:grid-cols-2 xl:grid-cols-6`}>
            <Field label="Inicio">
              <Input type="datetime-local" step="1" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </Field>
            <Field label="Fin">
              <Input type="datetime-local" step="1" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </Field>
            <Field label="Estado">
              <Input value={status} readOnly />
            </Field>
            <Field label="Tipo estado">
              <div className="relative">
                <Button type="button" variant="outline" className="h-9 w-full justify-between border-violet-200 text-black hover:bg-violet-50" onClick={() => setTypeStatusOpen((open) => !open)}>
                  {typeStatus || "Todos"}
                  <ChevronsUpDown className="size-4 opacity-60" />
                </Button>
                {typeStatusOpen ? (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-violet-200 bg-white shadow-lg">
                    <Command>
                      <CommandInput placeholder="Buscar estado..." />
                      <CommandList>
                        <CommandEmpty>Sin resultados.</CommandEmpty>
                        <CommandGroup>
                          {TYPE_STATUS_OPTIONS.map((option) => (
                            <CommandItem
                              key={option || "all"}
                              value={option || "Todos"}
                              onSelect={() => {
                                setTypeStatus(option);
                                setTypeStatusOpen(false);
                              }}
                            >
                              <span>{option || "Todos"}</span>
                              {typeStatus === option ? <Check className="ml-auto size-4" /> : null}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </div>
                ) : null}
              </div>
            </Field>
            <Field label="Buscar">
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="ID, cliente, documento, modelo..." />
            </Field>
            <div className="flex items-end">
              <Button className="w-full bg-violet-700 text-white hover:bg-violet-800" onClick={searchLeads} disabled={!canSync || loading}>
                <Filter className="mr-2 size-4" />
                Filtrar
              </Button>
            </div>
          </div>

          {message ? <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">{message}</div> : null}

          <div className="mt-3 overflow-hidden rounded-lg border border-violet-200">
            <div className="flex items-center justify-between border-b border-violet-200 bg-violet-50 px-3 py-2">
              <h2 className="text-sm font-bold text-violet-700">Resultados</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-700">{filteredItems.length} visibles</span>
            </div>
            <div className="max-h-[calc(100svh-330px)] overflow-auto sm:hidden">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-10 bg-violet-50 text-left text-[10px] uppercase text-violet-700">
                  <tr>
                    <th className="px-2 py-2">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Seleccionar visibles" />
                    </th>
                    <SortableHeader className="px-2 py-2" sortKey="id" sortConfig={fordSort} onSort={handleFordSort}>Id</SortableHeader>
                    <SortableHeader className="px-2 py-2" sortKey="cliente" sortConfig={fordSort} onSort={handleFordSort}>Cliente</SortableHeader>
                    <SortableHeader className="px-2 py-2" sortKey="vehiculo" sortConfig={fordSort} onSort={handleFordSort}>Vehiculo</SortableHeader>
                    <th className="px-2 py-2 text-right">Opciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-black">Cargando leads...</td>
                    </tr>
                  ) : null}
                  {!loading && sortedItems.map((item, index) => (
                    <Fragment key={`${item.id || "lead-mobile"}-${index}`}>
                      <tr key={`${item.id || "lead-mobile"}-${index}`} className="hover:bg-violet-50/50">
                        <td className="px-2 py-2 align-top">
                          <input type="checkbox" checked={Boolean(item.id && selectedLeadIds.includes(item.id))} onChange={() => toggleLeadSelection(item.id)} aria-label={`Seleccionar ${item.id || "lead"}`} />
                        </td>
                        <td className="max-w-[92px] truncate px-2 py-2 align-top font-mono text-[10px] font-bold text-violet-700">{item.id || "-"}</td>
                        <td className="px-2 py-2 align-top">
                          <p className="line-clamp-2 text-[11px] font-bold leading-tight text-slate-950">{contactName(item.contact)}</p>
                          <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-slate-500">{item.contact?.email || item.contact?.mobilePhone || item.contact?.phone || "-"}</p>
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] leading-tight">{vehicleName(item.vehicle)}</td>
                        <td className="px-2 py-2 text-right align-top">
                          <Button size="icon" variant="outline" className="size-7 border-violet-200 text-violet-700" onClick={() => setMobileLeadMenu((current) => current === item.id ? null : item.id)}>
                            <MoreVertical className="size-4" />
                          </Button>
                        </td>
                      </tr>
                      {mobileLeadMenu === item.id ? (
                        <tr key={`${item.id || "lead-mobile"}-${index}-actions`}>
                          <td colSpan={5} className="bg-violet-50 px-2 py-2">
                            <div className="ml-auto flex w-full max-w-[180px] flex-col rounded-lg border border-violet-200 bg-white p-1 text-sm shadow-sm">
                              {item.id ? (
                                <Link href={`/leads-ford/${encodeURIComponent(item.id)}`} className="block rounded-md px-3 py-2 text-left font-semibold text-violet-700 hover:bg-violet-50" onClick={() => setMobileLeadMenu(null)}>
                                  Ver detalle
                                </Link>
                              ) : (
                                <span className="block rounded-md px-3 py-2 text-left font-semibold text-slate-400">Sin opciones</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                  {!loading && !filteredItems.length ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-slate-600">No hay leads para mostrar con estos filtros.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="hidden max-h-[calc(100svh-360px)] overflow-auto sm:block">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-violet-50 text-left text-xs uppercase text-violet-700">
                <tr>
                  <th className="px-3 py-2">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Seleccionar visibles" />
                  </th>
                  <SortableHeader sortKey="id" sortConfig={fordSort} onSort={handleFordSort}>Id</SortableHeader>
                  <SortableHeader sortKey="status" sortConfig={fordSort} onSort={handleFordSort}>Estado</SortableHeader>
                  <SortableHeader sortKey="cliente" sortConfig={fordSort} onSort={handleFordSort}>Cliente</SortableHeader>
                  <SortableHeader sortKey="contacto" sortConfig={fordSort} onSort={handleFordSort}>Contacto</SortableHeader>
                  <SortableHeader sortKey="vehiculo" sortConfig={fordSort} onSort={handleFordSort}>Vehiculo</SortableHeader>
                  <SortableHeader sortKey="modificado" sortConfig={fordSort} onSort={handleFordSort}>Modificado</SortableHeader>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-black">Cargando leads...</td>
                  </tr>
                ) : null}
                {!loading && sortedItems.map((item, index) => (
                  <tr key={`${item.id || "lead"}-${index}`} className="hover:bg-violet-50/50">
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={Boolean(item.id && selectedLeadIds.includes(item.id))} onChange={() => toggleLeadSelection(item.id)} aria-label={`Seleccionar ${item.id || "lead"}`} />
                    </td>
                    <td className="max-w-[190px] truncate px-3 py-2 font-mono text-xs text-violet-700">{item.id || "-"}</td>
                    <td className="px-3 py-2">{item.status || "-"}</td>
                    <td className="px-3 py-2 font-medium">{contactName(item.contact)}</td>
                    <td className="px-3 py-2 text-black">{item.contact?.email || item.contact?.mobilePhone || item.contact?.phone || "-"}</td>
                    <td className="px-3 py-2">{vehicleName(item.vehicle)}</td>
                    <td className="px-3 py-2">{formatFordDate(item.lastModifiedDate || item.createdDate)}</td>
                    <td className="px-3 py-2 text-right">
                      {item.id ? (
                        <Link href={`/leads-ford/${encodeURIComponent(item.id)}`} className="inline-flex size-7 items-center justify-center rounded-md text-violet-700 hover:bg-violet-50" title="Ver detalle">
                          <Eye className="size-4" />
                        </Link>
                      ) : (
                        <Button size="icon" variant="ghost">
                          <Eye className="size-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && !filteredItems.length ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-slate-600">No hay leads para mostrar con estos filtros.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            </div>
          </div>
        </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold uppercase text-black">{label}</Label>
      {children}
    </div>
  );
}

function NativeSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={onChange} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400">
      {options.map(([optionValue, label]) => <option key={optionValue || "all"} value={optionValue}>{label}</option>)}
    </select>
  );
}
