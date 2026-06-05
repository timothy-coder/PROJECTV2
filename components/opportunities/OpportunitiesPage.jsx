"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, CalendarDays, Edit3, Eye, Kanban, Loader2, Plus, RefreshCw, Send, Table2 } from "lucide-react";

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
  const [view, setView] = useState("general");
  const [timelineMode, setTimelineMode] = useState("timeline");
  const [filters, setFilters] = useState({ clienteId: "", origenId: "", etapaId: "", asignadoA: "", createdBy: "", time: "all" });
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });
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
    return matchClient && matchOrigin && matchStage && matchAssigned && matchCreated && matchTime;
  }), [data.opportunities, filters]);

  const sortedFiltered = useMemo(() => sortOpportunities(filtered, sortConfig), [filtered, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const clientOptions = [{ value: "", label: "Todos" }, ...data.options.clients.map((item) => ({ value: item.id, label: [item.nombre, item.documento].filter(Boolean).join(" - ") }))];
  const originOptions = [{ value: "", label: "Todos" }, ...data.options.origins.map((item) => ({ value: item.id, label: item.name }))];
  const stageOptions = [{ value: "", label: "Todos" }, ...data.options.stages.map((item) => ({ value: item.id, label: item.nombre }))];
  const userOptions = [{ value: "", label: "Todos" }, ...data.options.users.map((item) => ({ value: item.id, label: item.fullname }))];
  const timeOptions = [{ value: "all", label: "Todas" }, { value: "day", label: "Hoy" }, { value: "week", label: "Semana" }, { value: "month", label: "Mes" }];

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
          <div><h1 className="text-2xl font-bold text-violet-700">{copy.title}</h1><p className="text-xs text-slate-500">{copy.subtitle} {canViewAll ? `${copy.type} - Vista completa` : `${copy.type} - Mi vista`}</p></div>
          <div className="flex gap-2"><Button variant="outline" onClick={data.reload}><RefreshCw className="size-4" />Actualizar</Button>{canCreate ? <Button onClick={() => setDialog({ open: true, item: null, mode: "edit" })} className="bg-violet-700 text-white hover:bg-violet-800"><Plus className="size-4" />{copy.add}</Button> : null}</div>
        </div>
        <section className="mb-3 shrink-0 rounded-lg border border-violet-200 bg-violet-50/30 p-3">
          <div className="grid gap-2 md:grid-cols-6">
            <Field label="Cliente"><SearchableSelect value={filters.clienteId} options={clientOptions} onChange={(value) => setFilters((current) => ({ ...current, clienteId: value }))} /></Field>
            <Field label="Origen"><SearchableSelect value={filters.origenId} options={originOptions} onChange={(value) => setFilters((current) => ({ ...current, origenId: value }))} /></Field>
            <Field label="Etapa"><SearchableSelect value={filters.etapaId} options={stageOptions} onChange={(value) => setFilters((current) => ({ ...current, etapaId: value }))} /></Field>
            {canViewAll ? <Field label="Asignado a"><SearchableSelect value={filters.asignadoA} options={userOptions} onChange={(value) => setFilters((current) => ({ ...current, asignadoA: value }))} /></Field> : null}
            {canViewAll ? <Field label="Creado por"><SearchableSelect value={filters.createdBy} options={userOptions} onChange={(value) => setFilters((current) => ({ ...current, createdBy: value }))} /></Field> : null}
            <Field label="Fecha Agenda"><SearchableSelect value={filters.time} options={timeOptions} onChange={(value) => setFilters((current) => ({ ...current, time: value }))} /></Field>
          </div>
        </section>
        <div className="mb-3 flex shrink-0 flex-wrap gap-2">
          <ViewButton active={view === "general"} onClick={() => setView("general")} icon={Table2} label="General" />
          <ViewButton active={view === "timeline"} onClick={() => setView("timeline")} icon={CalendarDays} label="Tablero" />
          <ViewButton active={view === "kanban"} onClick={() => setView("kanban")} icon={Kanban} label="Kanban" />
        </div>
        {view === "general" ? <GeneralView data={sortedFiltered} loading={data.loading} canEdit={canEdit} canViewAll={canViewAll} sortConfig={sortConfig} onSort={handleSort} onView={(item) => { window.location.href = `${copy.detailPath}/${item.id}`; }} onEdit={(item) => setDialog({ open: true, item, mode: "edit" })} onAssign={(item) => setAssignDialog({ open: true, item })} /> : null}
        {view === "timeline" ? <TimelineView data={filtered} mode={timelineMode} setMode={setTimelineMode} /> : null}
        {view === "kanban" ? <KanbanView data={filtered} stages={data.options.stages} /> : null}
        {dialog.open ? <OpportunityDialog state={dialog} options={data.options} currentUser={data.currentUser} canViewAll={canViewAll} canCreateClient={canCreateClient} onClose={() => setDialog({ open: false, item: null, mode: "edit" })} onSubmit={saveOpportunity} /> : null}
        {assignDialog.open ? <AssignDialog state={assignDialog} users={data.options.users} onClose={() => setAssignDialog({ open: false, item: null })} onSubmit={async (payload) => { await data.assign(assignDialog.item.id, payload); setAssignDialog({ open: false, item: null }); }} /> : null}
        {conflict ? <ConflictDialog conflict={conflict} onClose={() => setConflict(null)} /> : null}
      </div>
    </TooltipProvider>
  );
}

function GeneralView({ data, loading, canEdit, canViewAll, sortConfig, onSort, onView, onEdit, onAssign }) {
  return <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="min-h-0 flex-1 overflow-auto overscroll-contain"><table className="w-full min-w-[1080px] text-left text-xs"><thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold"><tr><SortableHeader sortKey="code" sortConfig={sortConfig} onSort={onSort}>Codigo</SortableHeader><SortableHeader sortKey="createdAt" sortConfig={sortConfig} onSort={onSort}>Fecha creacion</SortableHeader><SortableHeader sortKey="clienteNombre" sortConfig={sortConfig} onSort={onSort}>Cliente</SortableHeader><SortableHeader sortKey="origenNombre" sortConfig={sortConfig} onSort={onSort}>Origen</SortableHeader><SortableHeader sortKey="etapaNombre" sortConfig={sortConfig} onSort={onSort}>Etapa</SortableHeader><SortableHeader sortKey="asignadoANombre" sortConfig={sortConfig} onSort={onSort}>Asignado</SortableHeader><SortableHeader sortKey="nextAgenda" sortConfig={sortConfig} onSort={onSort}>Proxima Agenda</SortableHeader><SortableHeader sortKey="timeStateNombre" sortConfig={sortConfig} onSort={onSort}>Tiempo</SortableHeader><SortableHeader sortKey="temperature" sortConfig={sortConfig} onSort={onSort}>Temp.</SortableHeader><SortableHeader sortKey="detail" sortConfig={sortConfig} onSort={onSort}>Detalle</SortableHeader><th className="px-2 py-2 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-200">{loading ? <tr><td colSpan={11} className="py-10 text-center"><Loader2 className="inline size-4 animate-spin" /></td></tr> : data.map((item) => <tr key={item.id} style={rowTimeStyle(item)}><td className="px-2 py-2"><button className="font-bold text-blue-700 underline" onClick={() => onView(item)}>{item.code}</button></td><td className="px-2 py-2"><DateTimeStack value={item.createdAt} /></td><td className="max-w-[170px] whitespace-normal px-2 py-2 leading-tight"><p className="font-semibold">{item.clienteNombre}</p>{item.clienteDocumento ? <p className="mt-0.5 text-[10px] font-medium text-slate-500">DNI: {item.clienteDocumento}</p> : null}</td><td className="px-2 py-2">{item.origenNombre}</td><td className="px-2 py-2"><StageBadge item={item} /></td><td className="max-w-[140px] px-2 py-2 leading-tight">{item.asignadoANombre}</td><td className="px-2 py-2 font-semibold"><DateTimeStack value={item.nextAgenda} /></td><td className="px-2 py-2"><TimeStateBadge item={item} /></td><td className="px-2 py-2"><TemperatureBadge item={item} /></td><td className="max-w-[140px] px-2 py-2 leading-tight">{item.detail}</td><td className="px-2 py-2"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" className="size-8" onClick={() => onView(item)}><Eye className="size-3.5" /></Button>{canEdit ? <Button size="icon" variant="ghost" className="size-8" onClick={() => onEdit(item)}><Edit3 className="size-3.5" /></Button> : null}{canViewAll ? <Button size="icon" variant="ghost" className="size-8" onClick={() => onAssign(item)}><Send className="size-3.5" /></Button> : null}</div></td></tr>)}</tbody></table></div></section>;
}

function SortableHeader({ sortKey, sortConfig, onSort, children }) {
  const active = sortConfig.key === sortKey;
  const direction = active ? (sortConfig.direction === "asc" ? "↑" : "↓") : "";
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

function TimelineView({ data, mode, setMode }) {
  const byDate = data.reduce((acc, item) => {
    const key = String(item.nextAgenda || item.createdAt || "").slice(0, 10) || "Sin fecha";
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
  return <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-violet-200 bg-white p-4 shadow-sm"><div className="mb-4 flex shrink-0 items-center justify-between"><h2 className="font-bold text-violet-700">{mode === "calendar" ? "Calendario" : "Linea de tiempo"}</h2><div className="flex gap-2"><Button size="sm" variant={mode === "timeline" ? "default" : "outline"} onClick={() => setMode("timeline")}>Linea</Button><Button size="sm" variant={mode === "calendar" ? "default" : "outline"} onClick={() => setMode("calendar")}>Calendario</Button></div></div><div className="min-h-0 flex-1 overflow-auto">{mode === "timeline" ? <div className="space-y-3">{data.map((item) => <Tooltip key={item.id}><TooltipTrigger><div className="rounded-lg border border-slate-200 p-3 text-left" style={rowTimeStyle(item)}><p className="font-bold text-blue-700">{item.code} - {item.clienteNombre}</p><p className="text-xs text-slate-500">{item.nextAgenda || item.createdAt}</p><TimeStateBadge item={item} /></div></TooltipTrigger><TooltipContent><TooltipBody item={item} /></TooltipContent></Tooltip>)}</div> : <div className="grid gap-3 md:grid-cols-3">{Object.entries(byDate).map(([date, items]) => <div key={date} className="rounded-lg border border-slate-200 p-3"><h3 className="mb-2 font-bold text-violet-700">{date}</h3><div className="space-y-2">{items.map((item) => <Tooltip key={item.id}><TooltipTrigger><div className="rounded-md p-2 text-left text-xs font-bold text-slate-950" style={rowTimeStyle(item)}>{item.code}<p>{item.clienteNombre}</p></div></TooltipTrigger><TooltipContent><TooltipBody item={item} /></TooltipContent></Tooltip>)}</div></div>)}</div>}</div></section>;
}

function KanbanView({ data, stages }) {
  return <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm"><div className="shrink-0 bg-violet-50 p-4"><h2 className="text-xl font-bold text-violet-700">Kanban de Etapas</h2></div><div className="grid min-w-[920px] flex-1 grid-cols-4 gap-px overflow-auto bg-slate-200">{stages.map((stage) => { const items = data.filter((item) => item.etapaId === stage.id); return <div key={stage.id} className="min-h-80 bg-white p-3"><div className="mb-3 rounded-lg bg-blue-600 p-3 text-center font-bold text-white">{stage.nombre}<p className="text-2xl">{items.length}</p></div><div className="space-y-2">{items.map((item) => <Tooltip key={item.id}><TooltipTrigger><div className="rounded-lg p-3 text-left text-slate-950 shadow-sm" style={rowTimeStyle(item)}><p className="font-bold">{item.code}</p><p className="text-xs">{item.clienteNombre}</p><p className="text-xs">{item.nextAgenda || "-"}</p><TimeStateBadge item={item} /></div></TooltipTrigger><TooltipContent><TooltipBody item={item} /></TooltipContent></Tooltip>)}</div></div>; })}</div></section>;
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
