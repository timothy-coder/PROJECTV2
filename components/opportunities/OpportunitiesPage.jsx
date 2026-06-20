"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, CalendarDays, ChevronDown, Edit3, Eye, Kanban, Loader2, MoreVertical, Plus, RefreshCw, Search, Send, Table2 } from "lucide-react";

import { ClientDialog } from "@/components/clients/ClientDialog";
import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useOpportunities } from "@/hooks/opportunities/useOpportunities";
import { useClients } from "@/hooks/clients/useClients";
import { hasPerm } from "@/lib/permissions";

function permissionKey(kind) {
  return kind === "lead" ? "leads" : "oportunidades";
}

export default function OpportunitiesPage({ userPermissions, kind = "opportunity" }) {
  const data = useOpportunities(kind);
  const clientsData = useClients();
  const [view, setView] = useState("general");
  const [filters, setFilters] = useState({ clienteId: "", origenId: "", etapaId: "", asignadoA: "", createdBy: "", time: "all", cierreMotivoId: "", cotizacionModeloId: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const tableContainerRef = useRef(null);
  const paginationRef = useRef(null);
  const [dialog, setDialog] = useState({ open: false, item: null, mode: "edit" });
  const [assignDialog, setAssignDialog] = useState({ open: false, item: null });
  const [conflict, setConflict] = useState(null);
  const canViewAll = Boolean(
    hasPerm(userPermissions, [permissionKey(kind), "viewall"]) ||
    hasPerm(userPermissions, ["oportunidades", "viewall"]) ||
    hasPerm(userPermissions, ["agenda", "viewall"]) ||
    data.currentUser?.canViewAll
  );
  const canView = Boolean(hasPerm(userPermissions, [permissionKey(kind), "view"]) || canViewAll);
  const canCreate = hasPerm(userPermissions, [permissionKey(kind), "create"]);
  const canEdit = hasPerm(userPermissions, [permissionKey(kind), "edit"]);
  const canCreateClient = hasPerm(userPermissions, ["clientes", "create"]);
  const copy = kind === "lead"
    ? { title: "Leads", subtitle: "Gestiona todos tus leads de ventas", add: "Agregar lead", type: "LD / LF", detailPath: "/leads" }
    : { title: "Oportunidades", subtitle: "Gestiona todas tus oportunidades de negocio", add: "Agregar oportunidad", type: "OPO", detailPath: "/oportunidades" };

  const filtered = useMemo(() => data.opportunities.filter((item) => {
    const selectedStageId = filters.etapaId || "";
    const matchClient = !filters.clienteId || item.clienteId === Number(filters.clienteId);
    const matchOrigin = !filters.origenId || item.origenId === Number(filters.origenId);
    const matchStage = !selectedStageId || item.etapaId === Number(selectedStageId);
    const matchAssigned = !filters.asignadoA || item.asignadoA === Number(filters.asignadoA);
    const matchCreated = !filters.createdBy || item.createdBy === Number(filters.createdBy);
    const matchTime = filters.time === "all" || matchesTime(item.nextAgenda || item.createdAt, filters.time);
    const matchClosureReason = !filters.cierreMotivoId || (item.closureReasonIds || []).some((id) => Number(id) === Number(filters.cierreMotivoId));
    const matchQuoteModel = !filters.cotizacionModeloId || (item.quoteModelIds || []).some((id) => Number(id) === Number(filters.cotizacionModeloId));
    return matchClient && matchOrigin && matchStage && matchAssigned && matchCreated && matchTime && matchClosureReason && matchQuoteModel;
  }), [data.opportunities, filters]);

  const sortedFiltered = useMemo(() => sortOpportunities(filtered, sortConfig), [filtered, sortConfig]);
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / limit));
  const currentPage = Math.min(page, totalPages);
  const pagedOpportunities = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return sortedFiltered.slice(start, start + limit);
  }, [currentPage, limit, sortedFiltered]);

  useEffect(() => {
    function updateLimit() {
      if (view !== "general") return;
      const height = window.visualViewport?.height || window.innerHeight || 800;
      const tableTop = tableContainerRef.current?.getBoundingClientRect().top || 190;
      const paginationHeight = paginationRef.current?.getBoundingClientRect().height || 42;
      const tableHeaderHeight = 34;
      const bottomGap = 18;
      const rowHeight = 54;
      const availableRowsHeight = height - tableTop - paginationHeight - tableHeaderHeight - bottomGap;
      const nextLimit = Math.max(4, Math.min(100, Math.floor(availableRowsHeight / rowHeight)));
      setLimit((current) => {
        if (current === nextLimit) return current;
        setPage(1);
        return nextLimit;
      });
    }

    const frame = window.requestAnimationFrame(updateLimit);
    window.addEventListener("resize", updateLimit);
    window.visualViewport?.addEventListener("resize", updateLimit);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateLimit);
      window.visualViewport?.removeEventListener("resize", updateLimit);
    };
  }, [view]);

  const handleSort = (key) => {
    setPage(1);
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleFilterChange = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleViewChange = (nextView) => {
    setPage(1);
    setView(nextView);
  };

  const allClientOptionsSource = clientsData.clients.length
    ? clientsData.clients.map((item) => ({
        id: item.id,
        nombre: [item.nombre, item.apellido].filter(Boolean).join(" ") || item.nombreComercial || item.celular || `Cliente ${item.id}`,
        documento: item.identificacionFiscal || "",
      }))
    : data.options.clients;
  const clientOptions = [{ value: "", label: "Todos" }, ...allClientOptionsSource.map((item) => ({ value: item.id, label: [item.nombre, item.documento].filter(Boolean).join(" - ") }))];
  const originOptions = [{ value: "", label: "Todos" }, ...data.options.origins.map((item) => ({ value: item.id, label: item.name }))];
  const stageOptions = [{ value: "", label: "Todos" }, ...data.options.stages.map((item) => ({ value: item.id, label: item.nombre }))];
  const userOptions = [{ value: "", label: "Todos" }, ...data.options.users.map((item) => ({ value: item.id, label: item.fullname }))];
  const closureReasonOptions = [{ value: "", label: "Todos" }, ...(data.options.closureReasons || []).map((item) => ({ value: item.id, label: item.detalle }))];
  const quoteModelOptions = [{ value: "", label: "Todos" }, ...(data.options.quoteModels || []).map((item) => ({ value: item.id, label: item.name }))];
  const timeOptions = [{ value: "all", label: "Todas" }, { value: "day", label: "Hoy" }, { value: "week", label: "Semana" }, { value: "month", label: "Mes" }];
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => value && !(key === "time" && value === "all")).length;

  if (!canView) return <div className="rounded-lg bg-white p-4 text-sm text-slate-700">No tienes permiso para ver {copy.title.toLowerCase()}.</div>;

  async function saveOpportunity(payload) {
    try {
      if (dialog.item) await data.update(dialog.item.id, payload);
      else await data.create(payload);
      setDialog({ open: false, item: null, mode: "edit" });
    } catch (error) {
      if (error.status === 409) setConflict(error.data || error);
      else throw error;
    }
  }

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 p-3 text-slate-950 md:h-svh sm:p-4">
        <div className="mb-3 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-base font-bold leading-tight text-violet-700">{copy.title}</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">{copy.subtitle} {canViewAll ? `${copy.type} - Vista completa` : `${copy.type} - Mi vista`}</p></div>
          <div className="flex gap-2"><Button variant="outline" onClick={data.reload}>
            <RefreshCw className="size-4" />Actualizar</Button>
            {canCreate ? <Button onClick={() => setDialog({ open: true, item: null, mode: "edit" })} className="bg-violet-700 text-white hover:bg-violet-800"><Plus className="size-4" />{copy.add}</Button> : null}
            </div>
        </div>
        <section className="mb-3 shrink-0 rounded-lg border border-violet-200 bg-violet-50/30 p-2 sm:p-3">
          <button type="button" className="flex h-9 w-full items-center justify-between rounded-md border border-violet-200 bg-white px-3 text-xs font-bold text-violet-700 sm:hidden" onClick={() => setFiltersOpen((current) => !current)}>
            <span>Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
            <ChevronDown className={`size-4 transition ${filtersOpen ? "rotate-180" : ""}`} />
          </button>
          <div className={`${filtersOpen ? "grid" : "hidden"} mt-2 gap-2 sm:mt-0 sm:grid sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8`}>
            <Field label="Cliente"><SearchableSelect value={filters.clienteId} options={clientOptions} onChange={(value) => handleFilterChange("clienteId", value)} /></Field>
            <Field label="Origen"><SearchableSelect value={filters.origenId} options={originOptions} onChange={(value) => handleFilterChange("origenId", value)} /></Field>
            <Field label="Etapa"><SearchableSelect value={filters.etapaId} options={stageOptions} onChange={(value) => handleFilterChange("etapaId", value)} /></Field>
            {canViewAll ? <Field label="Asignado a"><SearchableSelect value={filters.asignadoA} options={userOptions} onChange={(value) => handleFilterChange("asignadoA", value)} /></Field> : null}
            {canViewAll ? <Field label="Creado por"><SearchableSelect value={filters.createdBy} options={userOptions} onChange={(value) => handleFilterChange("createdBy", value)} /></Field> : null}
            <Field label="Fecha Agenda"><SearchableSelect value={filters.time} options={timeOptions} onChange={(value) => handleFilterChange("time", value)} /></Field>
            <Field label="Motivo cierre"><SearchableSelect value={filters.cierreMotivoId} options={closureReasonOptions} onChange={(value) => handleFilterChange("cierreMotivoId", value)} /></Field>
            <Field label="Modelo cotizacion"><SearchableSelect value={filters.cotizacionModeloId} options={quoteModelOptions} onChange={(value) => handleFilterChange("cotizacionModeloId", value)} /></Field>
          </div>
        </section>
        <div className="mb-3 flex shrink-0 flex-wrap gap-2">
          <ViewButton active={view === "general"} onClick={() => handleViewChange("general")} icon={Table2} label="General" />
          <ViewButton active={view === "timeline"} onClick={() => handleViewChange("timeline")} icon={CalendarDays} label="Tablero" />
          <ViewButton active={view === "kanban"} onClick={() => handleViewChange("kanban")} icon={Kanban} label="Kanban" />
        </div>
        {view === "general" ? (
          <GeneralView
            data={pagedOpportunities}
            loading={data.loading}
            canEdit={canEdit}
            canViewAll={canViewAll}
            sortConfig={sortConfig}
            onSort={handleSort}
            onView={(item) => { window.location.href = `${copy.detailPath}/${item.id}`; }}
            onEdit={(item) => setDialog({ open: true, item, mode: "edit" })}
            onAssign={(item) => setAssignDialog({ open: true, item })}
            tableContainerRef={tableContainerRef}
            paginationRef={paginationRef}
            page={currentPage}
            totalPages={totalPages}
            total={sortedFiltered.length}
            onPageChange={setPage}
          />
        ) : null}
        {view === "timeline" ? <TimelineView data={filtered} users={data.options.users} currentUser={data.currentUser} canViewAll={canViewAll} detailPath={copy.detailPath} /> : null}
        {view === "kanban" ? <KanbanView data={filtered} stages={data.options.stages} detailPath={copy.detailPath} /> : null}
        {dialog.open ? <OpportunityDialog state={dialog} options={data.options} currentUser={data.currentUser} canViewAll={canViewAll} canCreateClient={canCreateClient} onClose={() => setDialog({ open: false, item: null, mode: "edit" })} onSubmit={saveOpportunity} /> : null}
        {assignDialog.open ? <AssignDialog state={assignDialog} users={data.options.users} onClose={() => setAssignDialog({ open: false, item: null })} onSubmit={async (payload) => { await data.assign(assignDialog.item.id, payload); setAssignDialog({ open: false, item: null }); }} /> : null}
        {conflict ? <ConflictDialog conflict={conflict} onClose={() => setConflict(null)} /> : null}
      </div>
    </TooltipProvider>
  );
}

function GeneralView({
  data,
  loading,
  canEdit,
  canViewAll,
  sortConfig,
  onSort,
  onView,
  onEdit,
  onAssign,
  tableContainerRef,
  paginationRef,
  page,
  totalPages,
  total,
  onPageChange,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const runMobileAction = (action) => {
    action();
    setOpenMenu(null);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div ref={tableContainerRef} className="max-w-full overflow-x-auto md:hidden">
        <table className="w-full table-fixed text-left text-[11px]">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-600">
            <tr>
              <th className="w-[27%] px-2 py-2">Codigo</th>
              <th className="w-[34%] px-2 py-2">Cliente</th>
              <th className="w-[23%] px-2 py-2">Etapa</th>
              <th className="w-[16%] px-2 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-10 text-center">
                  <Loader2 className="inline size-4 animate-spin" />
                </td>
              </tr>
            ) : data.length ? (
              data.map((item) => (
                <tr key={item.id} className="relative" style={rowTimeStyle(item)}>
                  <td className="px-2 py-2 align-top">
                    <button className="text-[11px] font-bold leading-tight text-blue-700 underline" onClick={() => onView(item)}>
                      {item.code}
                    </button>
                    <div className="mt-1 text-[10px] font-medium leading-tight text-slate-500">
                      <DateTimeStack value={item.createdAt} />
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-slate-900">{item.clienteNombre}</p>
                    {item.clienteDocumento ? <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">DNI: {item.clienteDocumento}</p> : null}
                  </td>
                  <td className="px-2 py-2 align-top"><StageBadge item={item} /></td>
                  <td className="px-2 py-2 text-right align-top">
                    <Button size="icon" variant="outline" className="size-8" onClick={() => setOpenMenu((current) => current === item.id ? null : item.id)}>
                      <MoreVertical className="size-4" />
                    </Button>
                    {openMenu === item.id ? (
                      <div className="absolute right-2 top-10 z-30 w-36 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-xl">
                        <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-medium hover:bg-slate-100" onClick={() => runMobileAction(() => onView(item))}>Ver</button>
                        {canEdit ? <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-medium hover:bg-slate-100" onClick={() => runMobileAction(() => onEdit(item))}>Editar</button> : null}
                        {canViewAll ? <button type="button" className="block w-full rounded-md px-3 py-2 text-left font-medium hover:bg-slate-100" onClick={() => runMobileAction(() => onAssign(item))}>Asignar</button> : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-10 text-center text-slate-500">No hay registros para mostrar</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="hidden max-w-full overflow-x-auto md:block">
        <table className="w-full min-w-[1080px] table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-[11px] font-bold">
            <tr>
              <SortableHeader sortKey="code" sortConfig={sortConfig} onSort={onSort}>Codigo</SortableHeader>
              <SortableHeader sortKey="createdAt" sortConfig={sortConfig} onSort={onSort}>Fecha creacion</SortableHeader>
              <SortableHeader sortKey="clienteNombre" sortConfig={sortConfig} onSort={onSort}>Cliente</SortableHeader>
              <SortableHeader sortKey="origenNombre" sortConfig={sortConfig} onSort={onSort}>Origen</SortableHeader>
              <SortableHeader sortKey="etapaNombre" sortConfig={sortConfig} onSort={onSort}>Etapa</SortableHeader>
              <SortableHeader sortKey="asignadoANombre" sortConfig={sortConfig} onSort={onSort}>Asignado</SortableHeader>
              <SortableHeader sortKey="nextAgenda" sortConfig={sortConfig} onSort={onSort}>Proxima Agenda</SortableHeader>
              <SortableHeader sortKey="latestQuoteModelName" sortConfig={sortConfig} onSort={onSort}>Modelo</SortableHeader>
              <SortableHeader sortKey="temperature" sortConfig={sortConfig} onSort={onSort}>Temp.</SortableHeader>
              <SortableHeader sortKey="detail" sortConfig={sortConfig} onSort={onSort}>Detalle</SortableHeader>
              <th className="px-2 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={11} className="py-10 text-center">
                  <Loader2 className="inline size-4 animate-spin" />
                </td>
              </tr>
            ) : data.length ? (
              data.map((item) => (
                <tr key={item.id} style={rowTimeStyle(item)}>
                  <td className="px-2 py-2">
                    <button className="font-bold text-blue-700 underline" onClick={() => onView(item)}>
                      {item.code}
                    </button>
                  </td>
                  <td className="px-2 py-2"><DateTimeStack value={item.createdAt} /></td>
                  <td className="max-w-[170px] whitespace-normal px-2 py-2 leading-tight">
                    <p className="line-clamp-2 font-semibold">{item.clienteNombre}</p>
                    {item.clienteDocumento ? <p className="mt-0.5 text-[10px] font-medium text-slate-500">DNI: {item.clienteDocumento}</p> : null}
                  </td>
                  <td className="px-2 py-2">{item.origenNombre}</td>
                  <td className="px-2 py-2"><StageBadge item={item} /></td>
                  <td className="max-w-[140px] px-2 py-2 leading-tight">
                    <p>{item.asignadoANombre}</p>
                    <div className="mt-1"><TimeStateBadge item={item} /></div>
                  </td>
                  <td className="px-2 py-2 font-semibold"><DateTimeStack value={item.nextAgenda} /></td>
                  <td className="px-2 py-2 font-semibold">{item.latestQuoteModelName || "-"}</td>
                  <td className="px-2 py-2"><TemperatureBadge item={item} /></td>
                  <td className="max-w-[140px] px-2 py-2 leading-tight">{item.detail}</td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => onView(item)}><Eye className="size-3.5" /></Button>
                      {canEdit ? <Button size="icon" variant="ghost" className="size-8" onClick={() => onEdit(item)}><Edit3 className="size-3.5" /></Button> : null}
                      {canViewAll ? <Button size="icon" variant="ghost" className="size-8" onClick={() => onAssign(item)}><Send className="size-3.5" /></Button> : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11} className="py-10 text-center text-slate-500">No hay registros para mostrar</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div ref={paginationRef} className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-sm">
        <span className="font-medium text-slate-500">
          Mostrando {data.length} de {total} registros. Pagina {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={loading || page <= 1} onClick={() => onPageChange((current) => Math.max(1, current - 1))}>Anterior</Button>
          <Button type="button" variant="outline" disabled={loading || page >= totalPages} onClick={() => onPageChange((current) => current + 1)}>Siguiente</Button>
        </div>
      </div>
    </section>
  );
}

function SortableHeader({ sortKey, sortConfig, onSort, children }) {
  const active = sortConfig.key === sortKey;
  const direction = active ? (sortConfig.direction === "asc" ? "ASC" : "DESC") : "";
  return (
    <th className="px-2 py-2">
      <button type="button" onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 font-bold transition hover:text-violet-700 ${active ? "text-violet-700" : ""}`}>
        {children}
        {active ? <span className="text-[10px]">{direction}</span> : <ArrowUpDown className="size-3 text-slate-400" />}
      </button>
    </th>
  );
}

function sortOpportunities(items, sortConfig) {
  const closedLast = (a, b) => Number(isClosedOpportunity(a)) - Number(isClosedOpportunity(b));
  if (!sortConfig.key) return [...items].sort(closedLast);

  const direction = sortConfig.direction === "desc" ? -1 : 1;
  return [...items].sort((a, b) => closedLast(a, b) || compareOpportunityValue(a, b, sortConfig.key) * direction);
}

function isClosedOpportunity(item) {
  return String(item?.etapaNombre || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("cerrad");
}

function compareOpportunityValue(a, b, key) {
  if (key === "createdAt" || key === "nextAgenda") return compareDates(a[key], b[key]);
  if (key === "temperature") return compareNumbers(a[key], b[key]);
  if (key === "timeStateNombre") return compareText(a.timeState?.nombre, b.timeState?.nombre);
  if (key === "latestQuoteModelName") return compareText(a.latestQuoteModelName, b.latestQuoteModelName);
  return compareText(a[key], b[key]);
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "es", { sensitivity: "base", numeric: true });
}

function compareNumbers(a, b) {
  const left = Number(a);
  const right = Number(b);
  if (Number.isNaN(left) && Number.isNaN(right)) return 0;
  if (Number.isNaN(left)) return 1;
  if (Number.isNaN(right)) return -1;
  return left - right;
}

function compareDates(a, b) {
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  const leftInvalid = Number.isNaN(left);
  const rightInvalid = Number.isNaN(right);
  if (leftInvalid && rightInvalid) return 0;
  if (leftInvalid) return 1;
  if (rightInvalid) return -1;
  return left - right;
}

function LegendLine({ color, label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-0.5 w-4 ${color}`} />
      {label}
    </span>
  );
}

function formatBoardDate(date) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateKeyFromText(value) {
  const text = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : dateKey(date);
}

function minutesFromTime(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function buildSalesTimeSlots(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 48 }, (_, index) => {
    const slot = new Date(start.getTime() + index * 30 * 60 * 1000);
    return slot.toTimeString().slice(0, 5);
  });
}

function currentSalesTimePosition(now, slots) {
  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutesFromTime(slots[0]);
  return Math.max(0, Math.min(slots.length, (current - start) / 30));
}

function slotIndexForAgenda(value, slots) {
  const text = String(value || "");
  const time = text.match(/(\d{2}:\d{2})/)?.[1] || "";
  if (!time) return -1;
  const diff = minutesFromTime(time) - minutesFromTime(slots[0]);
  return diff >= 0 && diff < slots.length * 30 ? Math.floor(diff / 30) : -1;
}

function advisorDotClass(index) {
  return ["bg-cyan-500", "bg-blue-600", "bg-indigo-700", "bg-red-700", "bg-emerald-600", "bg-amber-500"][index % 6];
}

function TimelineView({ data, users, currentUser, canViewAll, detailPath }) {
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [selectedAdvisorIds, setSelectedAdvisorIds] = useState([]);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const boardScrollRef = useRef(null);
  const boardDragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const now = useMemo(() => new Date(), []);
  const slots = useMemo(() => buildSalesTimeSlots(now), [now]);
  const advisors = useMemo(() => {
    const source = canViewAll ? users : users.filter((user) => Number(user.id) === Number(currentUser?.id));
    return source.length ? source : currentUser ? [{ id: currentUser.id, fullname: currentUser.fullname || "Mi usuario" }] : [];
  }, [canViewAll, currentUser, users]);
  const visibleAdvisors = selectedAdvisorIds.length && canViewAll
    ? advisors.filter((advisor) => selectedAdvisorIds.includes(String(advisor.id)))
    : advisors;
  const todayKey = dateKey(now);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const board = boardScrollRef.current;
      if (!board) return;
      const timelineWidth = Math.max(board.scrollWidth - 130, 1);
      const slotWidth = timelineWidth / Math.max(slots.length, 1);
      const currentLeft = 130 + currentSalesTimePosition(now, slots) * slotWidth;
      board.scrollLeft = Math.max(0, currentLeft - board.clientWidth / 2);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [now, slots]);

  function toggleAdvisor(id) {
    const value = String(id);
    setSelectedAdvisorIds((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function openOpportunity(item) {
    window.location.assign(`${detailPath}/${item.id}`);
  }

  function startBoardDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (!boardScrollRef.current) return;
    event.preventDefault();
    boardDragRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: boardScrollRef.current.scrollLeft,
    };
    setIsDraggingBoard(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveBoardDrag(event) {
    if (!boardDragRef.current.active || !boardScrollRef.current) return;
    event.preventDefault();
    const deltaX = event.clientX - boardDragRef.current.startX;
    boardScrollRef.current.scrollLeft = boardDragRef.current.scrollLeft - deltaX;
  }

  function stopBoardDrag(event) {
    if (!boardDragRef.current.active) return;
    boardDragRef.current.active = false;
    setIsDraggingBoard(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm">
      <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <LegendLine color="bg-emerald-400" label="Oportunidad agendada" />
          <span className="font-bold text-violet-700">{formatBoardDate(now)}</span>
        </div>
        <div className="relative">
          <button type="button" className="inline-flex h-8 min-w-44 items-center justify-between rounded-full border border-slate-300 bg-white px-4 text-xs font-bold text-blue-600" onClick={() => setAdvisorOpen((current) => !current)}>
            {canViewAll ? (selectedAdvisorIds.length ? `Asesores ${selectedAdvisorIds.length}` : `Asesores +${advisors.length}`) : "Mi asesor"}
            <ChevronDown className={`size-4 text-slate-500 transition ${advisorOpen ? "rotate-180" : ""}`} />
          </button>
          {advisorOpen && canViewAll ? (
            <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-lg">
              <button type="button" className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-bold text-blue-600 hover:bg-blue-50" onClick={() => setSelectedAdvisorIds([])}>
                Ver todos
              </button>
              {advisors.map((advisor) => (
                <label key={advisor.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
                  <input type="checkbox" checked={!selectedAdvisorIds.length || selectedAdvisorIds.includes(String(advisor.id))} onChange={() => toggleAdvisor(advisor.id)} />
                  <span className="text-xs font-semibold text-slate-700">{advisor.fullname}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div
        ref={boardScrollRef}
        className={`min-h-0 flex-1 overflow-auto bg-white select-none touch-pan-y ${isDraggingBoard ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={startBoardDrag}
        onPointerMove={moveBoardDrag}
        onPointerUp={stopBoardDrag}
        onPointerCancel={stopBoardDrag}
        onPointerLeave={stopBoardDrag}
      >
        <div className="grid" style={{ minWidth: `calc(130px + ${slots.length} * 105px)`, gridTemplateColumns: `130px repeat(${slots.length}, minmax(105px, 1fr))` }}>
          <div className="sticky left-0 z-20 border-b border-r border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-600">Asesores</div>
          {slots.map((slot, index) => (
            <div key={slot} className={`border-b border-r border-slate-200 px-1 py-3 text-center text-xs text-slate-500 ${index < currentSalesTimePosition(now, slots) ? "bg-slate-100" : ""}`}>
              {slot}
            </div>
          ))}
        </div>
        <div className="relative grid" style={{ minWidth: `calc(130px + ${slots.length} * 105px)`, gridTemplateColumns: `130px repeat(${slots.length}, minmax(105px, 1fr))` }}>
          {visibleAdvisors.map((advisor, rowIndex) => {
            const advisorItems = data.filter((item) => Number(item.asignadoA) === Number(advisor.id) && dateKeyFromText(item.nextAgenda) === todayKey);
            return (
              <Fragment key={advisor.id}>
                <div className="sticky left-0 z-10 flex min-h-[104px] items-center border-b border-r border-slate-200 bg-white px-4 text-sm text-slate-900">
                  <span className={`mr-2 h-1.5 w-1.5 rounded-full ${advisorDotClass(rowIndex)}`} />
                  <span className="leading-tight">{advisor.fullname}</span>
                </div>
                {slots.map((slot, index) => {
                  const cellItems = advisorItems.filter((item) => slotIndexForAgenda(item.nextAgenda, slots) === index);
                  return (
                    <div key={`${advisor.id}-${slot}`} className={`min-h-[104px] border-b border-r border-slate-200 p-1 ${index < currentSalesTimePosition(now, slots) ? "bg-slate-100" : ""}`}>
                      <div className="space-y-1">
                        {cellItems.map((item) => (
                          <button key={item.id} type="button" className="w-full rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-left text-[11px] font-semibold leading-tight text-slate-950 shadow-sm hover:border-violet-300 hover:bg-violet-50" onClick={() => openOpportunity(item)}>
                            <span className="block truncate text-blue-700">{item.code}</span>
                            <span className="block truncate">{item.clienteNombre}</span>
                            <span className="block truncate text-slate-500">{String(item.nextAgenda || "").slice(11, 16) || "-"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
          <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-blue-600" style={{ left: `calc(130px + ${currentSalesTimePosition(now, slots)} * ((100% - 130px) / ${slots.length}))` }} />
        </div>
      </div>
    </section>
  );
}

function KanbanView({ data, stages, detailPath }) {
  const [selectedStage, setSelectedStage] = useState(null);
  const [stageQuery, setStageQuery] = useState("");
  const stageItems = selectedStage ? data.filter((item) => Number(item.etapaId) === Number(selectedStage.id)) : [];
  const cleanQuery = stageQuery.trim().toLowerCase();
  const filteredStageItems = cleanQuery
    ? stageItems.filter((item) => [
      item.code,
      item.clienteNombre,
      item.cliente,
      item.nombreCliente,
      item.documentoCliente,
      item.asignadoANombre,
      item.nextAgenda,
    ].filter(Boolean).join(" ").toLowerCase().includes(cleanQuery))
    : stageItems;

  function openStage(stage) {
    setSelectedStage(stage);
    setStageQuery("");
  }

  function openOpportunity(item) {
    window.location.assign(`${detailPath}/${item.id}`);
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm">
      <div className="shrink-0 bg-violet-50 px-3 py-2">
        <h2 className="text-base font-bold text-violet-700">Kanban de Etapas</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-px">
        <div className="grid min-h-full grid-cols-1 gap-px sm:min-w-[920px] sm:grid-cols-4">
          {stages.map((stage) => {
            const items = data.filter((item) => Number(item.etapaId) === Number(stage.id));
            return (
              <div key={stage.id} className="flex min-h-0 flex-col bg-white">
                <button type="button" className="m-2 rounded-lg bg-blue-600 px-2 py-2 text-center text-white transition hover:bg-blue-700" onClick={() => openStage(stage)}>
                  <p className="truncate text-sm font-bold">{stage.nombre}</p>
                  <p className="text-xl font-bold leading-6">{items.length}</p>
                </button>
                <div className="hidden min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-2 sm:block">
                  {items.map((item) => (
                    <Tooltip key={item.id}>
                      <TooltipTrigger>
                        <OpportunityKanbanCard item={item} onClick={() => openOpportunity(item)} />
                      </TooltipTrigger>
                      <TooltipContent><TooltipBody item={item} /></TooltipContent>
                    </Tooltip>
                  ))}
                  {!items.length ? <p className="rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">Sin oportunidades</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selectedStage ? (
        <Dialog open onOpenChange={(open) => !open && setSelectedStage(null)}>
          <DialogContent className="max-h-[92svh] max-w-[min(94vw,620px)] overflow-hidden bg-white p-0 text-slate-950">
            <DialogHeader className="border-b border-slate-200 px-4 py-3">
              <DialogTitle className="text-lg font-bold text-violet-700">{selectedStage.nombre}</DialogTitle>
              <DialogDescription>{stageItems.length} oportunidades en esta etapa.</DialogDescription>
            </DialogHeader>
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input value={stageQuery} onChange={(event) => setStageQuery(event.target.value)} placeholder="Buscar oportunidad..." className="h-9 bg-white pl-9" />
              </div>
            </div>
            <div className="max-h-[62svh] space-y-2 overflow-y-auto px-4 py-3">
              {filteredStageItems.map((item) => <OpportunityKanbanCard key={item.id} item={item} onClick={() => openOpportunity(item)} />)}
              {!filteredStageItems.length ? <p className="py-8 text-center text-sm text-slate-500">No hay oportunidades para mostrar.</p> : null}
            </div>
            <DialogFooter className="border-t border-slate-200 px-4 py-3">
              <Button variant="outline" onClick={() => setSelectedStage(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}

function OpportunityKanbanCard({ item, onClick }) {
  return (
    <button type="button" className="w-full rounded-md border border-slate-200 p-2 text-left text-xs text-slate-950 shadow-sm transition hover:border-violet-300 hover:bg-violet-50" style={rowTimeStyle(item)} onClick={onClick}>
      <p className="truncate text-sm font-bold leading-5">{item.code}</p>
      <p className="truncate font-medium">{item.clienteNombre}</p>
      <p className="truncate text-slate-500">{item.nextAgenda || "-"}</p>
      <div className="mt-1"><TimeStateBadge item={item} /></div>
    </button>
  );
}

function OpportunityDialog({ state, options, currentUser, canViewAll, canCreateClient, onClose, onSubmit }) {
  const readOnly = state.mode === "view";
  const clientsData = useClients();
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const assignedDefault = canViewAll ? (state.item?.asignadoA ? String(state.item.asignadoA) : "") : String(currentUser?.id || "");
  const [form, setForm] = useState({ clienteId: state.item?.clienteId ? String(state.item.clienteId) : "", origenId: state.item?.origenId ? String(state.item.origenId) : "", suborigenId: state.item?.suborigenId ? String(state.item.suborigenId) : "", etapaId: state.item?.etapaId ? String(state.item.etapaId) : "", asignadoA: assignedDefault, activityText: "", activities: [], fechaAgenda: "", horaAgenda: "" });
  const clientSource = clientsData.clients.length ? clientsData.clients.map((item) => ({ id: item.id, nombre: [item.nombre, item.apellido].filter(Boolean).join(" ") || item.nombreComercial || item.celular || `Cliente ${item.id}`, documento: item.identificacionFiscal || "" })) : options.clients;
  const clientOptions = clientSource.map((item) => ({ value: item.id, label: [item.nombre, item.documento].filter(Boolean).join(" - ") }));
  const originOptions = options.origins.map((item) => ({ value: item.id, label: item.name }));
  const suboriginOptions = options.suborigins.filter((item) => !form.origenId || item.origenId === Number(form.origenId)).map((item) => ({ value: item.id, label: item.name }));
  const userOptions = [{ value: "", label: "Sin asignar" }, ...options.users.map((item) => ({ value: item.id, label: item.fullname }))];
  const stageOptions = options.stages.map((item) => ({ value: item.id, label: item.nombre }));
  const stageName = state.item?.etapaNombre || (canViewAll ? (form.asignadoA ? "Asignado" : "Nuevo") : "Asignado");
  const existingActivities = state.item?.activities || [];
  const existingDetails = state.item?.details || [];
  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(96vw,920px)] overflow-y-auto bg-white p-0 text-slate-950">
        <form onSubmit={(event) => { event.preventDefault(); if (!readOnly) onSubmit({ clienteId: form.clienteId, origenId: form.origenId, suborigenId: form.suborigenId, etapaId: form.etapaId || state.item?.etapaId, asignadoA: form.asignadoA, activities: form.activities, detail: { fechaAgenda: form.fechaAgenda, horaAgenda: form.horaAgenda } }); }} className="space-y-0">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-violet-700">{readOnly ? "Detalle oportunidad" : state.item ? "Editar oportunidad" : "Nueva oportunidad"}</DialogTitle>
              <DialogDescription>Completa los datos, actividades y agenda de la oportunidad.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid p-5">
            <div className="space-y-4">
              <section className="rounded-lg border border-violet-200 bg-violet-50/30 p-4">
                <h3 className="mb-3 font-bold text-violet-700">Informacion general</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Cliente *">
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <SearchableSelect disabled={readOnly || Boolean(state.item)} value={form.clienteId} options={clientOptions} placeholder="Buscar cliente..." onChange={(value) => setForm((current) => ({ ...current, clienteId: value }))} />
                      {canCreateClient && !readOnly && !state.item ? (
                        <Button type="button" variant="outline" size="icon" title="Agregar cliente" onClick={() => setClientDialogOpen(true)}>
                          <Plus className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </Field>
                  <Field label="Creado por"><Input disabled value={state.item?.creadoPorNombre || currentUser?.fullname || ""} /></Field>
                  <Field label="Origen *"><SearchableSelect disabled={readOnly} value={form.origenId} options={originOptions} placeholder="Buscar origen..." onChange={(value) => setForm((current) => ({ ...current, origenId: value, suborigenId: "" }))} /></Field>
                  <Field label="Suborigen"><SearchableSelect disabled={readOnly} value={form.suborigenId} options={suboriginOptions} placeholder="Buscar suborigen..." onChange={(value) => setForm((current) => ({ ...current, suborigenId: value }))} /></Field>
                  <Field label="Etapa actual">{state.item ? <SearchableSelect disabled={readOnly} value={form.etapaId} options={stageOptions} onChange={(value) => setForm((current) => ({ ...current, etapaId: value }))} /> : <Input disabled value={stageName} className="bg-violet-100 font-bold text-violet-700" />}</Field>
                  <Field label="Asignado a"><SearchableSelect disabled={readOnly || !canViewAll} value={form.asignadoA} options={userOptions} onChange={(value) => setForm((current) => ({ ...current, asignadoA: value }))} /></Field>
                </div>
              </section>
              <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-3 font-bold text-blue-800">Nueva actividad</h3>
                <Textarea disabled={readOnly} value={form.activityText} onChange={(event) => setForm((current) => ({ ...current, activityText: event.target.value }))} placeholder="Describe que accion se realizo..." className="min-h-28 bg-white" />
                {!readOnly ? <Button type="button" className="mt-3 w-full" onClick={() => setForm((current) => ({ ...current, activities: current.activityText ? [...current.activities, { detalle: current.activityText }] : current.activities, activityText: "" }))}><Plus className="size-4" />Agregar actividad</Button> : null}
              <HistoryBox title={`Actividades (${existingActivities.length + form.activities.length})`} empty="No hay actividades">
                {existingActivities.map((activity) => <HistoryItem key={`old-${activity.id}`} title={activity.detalle} subtitle={`${activity.createdByNombre || ""} ${formatShortDate(activity.createdAt)}`} />)}
                {form.activities.map((activity, index) => <HistoryItem key={`new-${index}`} title={activity.detalle} subtitle="Nueva actividad" />)}
              </HistoryBox>
              </section>
              <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="mb-3 font-bold text-emerald-800">Nueva agenda</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Fecha agenda"><Input disabled={readOnly} type="date" value={form.fechaAgenda} onChange={(event) => setForm((current) => ({ ...current, fechaAgenda: event.target.value }))} /></Field>
                  <Field label="Hora agenda"><Input disabled={readOnly} type="time" value={form.horaAgenda} onChange={(event) => setForm((current) => ({ ...current, horaAgenda: event.target.value }))} /></Field>
                </div>
                {state.item && !readOnly ? <p className="mt-2 text-xs font-semibold text-emerald-700">Si ya existe una agenda previa, al guardar se marcara como Reprogramado si esa etapa existe.</p> : null}
              <HistoryBox title={`Agendas (${existingDetails.length})`} empty="No hay agendas registradas">
                {existingDetails.map((detail) => <HistoryItem key={detail.id} title={`${detail.fechaAgenda || "-"} ${detail.horaAgenda || ""}`} subtitle={formatShortDate(detail.createdAt)} />)}
              </HistoryBox>
              </section>
            </div>
            
          </div>
          <DialogFooter className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            {!readOnly ? <Button type="submit">Guardar</Button> : null}
          </DialogFooter>
        </form>
        <ClientDialog
          open={clientDialogOpen}
          mode="create"
          client={null}
          options={clientsData.options}
          onClose={() => setClientDialogOpen(false)}
          onSubmit={async (payload) => {
            const result = await clientsData.createClient(payload);
            if (result?.id) setForm((current) => ({ ...current, clienteId: String(result.id) }));
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ state, users, onClose, onSubmit }) {
  const [asignadoA, setAsignadoA] = useState(state.item?.asignadoA ? String(state.item.asignadoA) : "");
  const userOptions = [{ value: "", label: "Sin asignar" }, ...users.map((item) => ({ value: item.id, label: item.fullname }))];
  return <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}><DialogContent className="bg-white text-slate-950"><DialogHeader><DialogTitle>Asignar oportunidad</DialogTitle><DialogDescription>{state.item?.code}</DialogDescription></DialogHeader><Field label="Asignado a"><SearchableSelect value={asignadoA} options={userOptions} onChange={setAsignadoA} /></Field><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => onSubmit({ asignadoA })}>Asignar</Button></DialogFooter></DialogContent></Dialog>;
}

function ConflictDialog({ conflict, onClose }) {
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="bg-white text-slate-950"><DialogHeader><DialogTitle>Oportunidad abierta</DialogTitle><DialogDescription>{conflict.message}</DialogDescription></DialogHeader><div className="rounded-lg bg-violet-50 p-3 text-sm font-bold text-violet-700">{conflict.opportunity?.oportunidad_id} - Etapa {conflict.opportunity?.etapa_nombre}</div><DialogFooter><Button variant="outline" onClick={onClose}>Cerrar</Button></DialogFooter></DialogContent></Dialog>;
}

function HistoryBox({ title, empty, children }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="rounded-lg border border-slate-200 bg-white p-3"><h3 className="mb-3 font-bold text-slate-950">{title}</h3><div className="space-y-2">{hasChildren ? children : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">{empty}</p>}</div></section>;
}

function HistoryItem({ title, subtitle }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-950">{title}</p>{subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}</div>;
}

function TooltipBody({ item }) {
  return <div className="space-y-1 text-left"><p>Codigo: {item.code}</p><p>Cliente: {item.clienteNombre}</p><p>Origen: {item.origenNombre}</p><p>Etapa: {item.etapaNombre}</p><p>Asignado: {item.asignadoANombre}</p><p>Fecha/Hora: {item.nextAgenda || "-"}</p></div>;
}

function ViewButton({ active, onClick, icon: Icon, label }) {
  return <Button className={active ? "bg-violet-700 text-white hover:bg-violet-800" : "bg-slate-400 text-white hover:bg-slate-500"} onClick={onClick}><Icon className="size-4" />{label}</Button>;
}

function StageBadge({ item }) {
  return <span className="rounded-full px-2 py-1 text-xs font-bold text-blue-700" style={{ backgroundColor: `${item.etapaColor}22` }}>{item.etapaNombre}</span>;
}

function TemperatureBadge({ item }) {
  if (isClosedOpportunity(item)) return <span className="text-xs font-bold text-slate-400">-</span>;
  return <span className="rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[11px] font-bold text-orange-700">{item.temperature}%</span>;
}

function TimeStateBadge({ item }) {
  if (!item.timeState) return <span className="text-xs text-slate-400">-</span>;
  return <span className="rounded-full border px-2 py-1 text-xs font-bold" style={{ borderColor: item.timeState.color, color: item.timeState.color, backgroundColor: hexToRgba(item.timeState.color, 0.12) }}>{item.timeState.nombre}</span>;
}

function rowTimeStyle(item) {
  if (!item.timeState?.color) return undefined;
  return {
    backgroundColor: hexToRgba(item.timeState.color, 0.14),
    boxShadow: `inset 4px 0 0 ${item.timeState.color}`,
  };
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || "").replace("#", "");
  if (clean.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function Field({ label, children }) {
  return <div className="space-y-1"><Label className="text-xs font-bold text-violet-700">{label}</Label>{children}</div>;
}

function matchesTime(value, mode) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  if (mode === "day") return date.toDateString() === now.toDateString();
  if (mode === "week") return Math.abs(date - now) <= 7 * 24 * 60 * 60 * 1000;
  if (mode === "month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  return true;
}

function formatShortDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function DateTimeStack({ value }) {
  const formatted = formatDateTime(value);
  if (!formatted) return "-";
  const [date, time] = formatted.split(" ");
  return <span className="inline-flex min-w-28 flex-col leading-tight"><span>{date}</span><span className="mt-1 text-xs font-semibold text-slate-600">{time}</span></span>;
}
