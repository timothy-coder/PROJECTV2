"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, Edit3, Eye, MoreVertical, Plus, RefreshCw, Search, Send, Trash2 } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePostventaOpportunities } from "@/hooks/postventa/usePostventaOpportunities";
import { hasPerm } from "@/lib/permissions";

function permissionKey(kind) {
  return kind === "lead" ? "leadspv" : "oportunidadespv";
}

function sortPostventaRows(items, sortConfig) {
  const closedLast = (left, right) => Number(isClosedStage(left.etapaNombre)) - Number(isClosedStage(right.etapaNombre));
  if (!sortConfig.key) return [...items].sort(closedLast);
  const direction = sortConfig.direction === "desc" ? -1 : 1;
  return [...items].sort((left, right) => closedLast(left, right) || comparePostventaValue(left, right, sortConfig.key) * direction);
}

function comparePostventaValue(left, right, key) {
  if (key === "agendaAt") return compareDates(rowAgendaAt(left), rowAgendaAt(right));
  if (key === "citaAt") return compareDates(rowCitaAt(left), rowCitaAt(right));
  return compareText(left[key], right[key]);
}

function compareText(left, right) {
  const leftEmpty = left === null || left === undefined || String(left).trim() === "";
  const rightEmpty = right === null || right === undefined || String(right).trim() === "";
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  return String(left).localeCompare(String(right), "es", { sensitivity: "base", numeric: true });
}

function compareDates(left, right) {
  const leftTime = left ? new Date(left).getTime() : Number.NaN;
  const rightTime = right ? new Date(right).getTime() : Number.NaN;
  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return 1;
  if (Number.isNaN(rightTime)) return -1;
  return leftTime - rightTime;
}

function rowAgendaAt(item) {
  return item?.agendaDate ? `${item.agendaDate}T${item.agendaTime || "00:00"}` : "";
}

function rowCitaAt(item) {
  return item?.citaFecha ? `${item.citaFecha}T${item.citaHora || "00:00"}` : "";
}

export default function PostventaOpportunitiesPage({ userPermissions, kind = "opportunity" }) {
  const data = usePostventaOpportunities(kind);
  const [query, setQuery] = useState("");
  const [stageId, setStageId] = useState("");
  const [timeStateId, setTimeStateId] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileActionId, setMobileActionId] = useState(null);
  const [editDialog, setEditDialog] = useState({ open: false, item: null, detail: null });
  const [assignDialog, setAssignDialog] = useState({ open: false, item: null });
  const perm = permissionKey(kind);
  const canViewAll = Boolean(hasPerm(userPermissions, [perm, "viewall"]) || data.currentUser?.canViewAll);
  const canView = Boolean(hasPerm(userPermissions, [perm, "view"]) || canViewAll);
  const canCreate = hasPerm(userPermissions, [perm, "create"]);
  const canEdit = hasPerm(userPermissions, [perm, "edit"]) || canViewAll;
  const canAssign = hasPerm(userPermissions, [perm, "asignar"]) || canViewAll;
  const canOpenMaintenance = Boolean(hasPerm(userPermissions, ["oportunidadespv", "view"]) || hasPerm(userPermissions, ["oportunidadespv", "viewall"]));
  const copy = kind === "lead"
    ? { title: "Leads PosVenta", subtitle: "Gestiona los leads de PosVenta" }
    : { title: "Oportunidades PosVenta", subtitle: "Gestiona oportunidades de mantenimiento y citas" };
  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    const filtered = data.opportunities.filter((item) => {
      const matchesText = !text || `${item.code} ${item.clienteNombre} ${item.vehiculoNombre} ${item.placa} ${item.vin || ""}`.toLowerCase().includes(text);
      const matchesStage = !stageId || Number(item.etapaId) === Number(stageId);
      const matchesTimeState = !timeStateId || Number(item.timeState?.id) === Number(timeStateId);
      return matchesText && matchesStage && matchesTimeState;
    });
    return sortPostventaRows(filtered, sortConfig);
  }, [data.opportunities, query, sortConfig, stageId, timeStateId]);
  if (!canView) return <div className="rounded-lg bg-white p-4 text-sm text-slate-700">No tienes permiso para ver esta pagina.</div>;

  function handleSort(key) {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  async function openEdit(item) {
    const detail = await data.detail(item.id);
    setEditDialog({ open: true, item, detail });
  }

  return (
    <div className="min-w-0 bg-slate-50 p-4 text-slate-950">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold leading-tight text-violet-700">{copy.title}</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">{copy.subtitle} {canViewAll ? "- Vista completa" : "- Mi vista"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={data.reload}><RefreshCw className="size-4" />Actualizar</Button>
          {canCreate && canOpenMaintenance ? <Button className="bg-violet-700 text-white hover:bg-violet-800" onClick={() => { window.location.href = "/proximosmantenimientos"; }}><Plus className="size-4" />Desde mantenimiento</Button> : null}
        </div>
      </header>
      <section className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
        <button type="button" className="mb-3 flex w-full items-center justify-between rounded-md border border-violet-100 bg-violet-50 px-3 py-2 text-left text-xs font-bold text-violet-700 md:hidden" onClick={() => setFiltersOpen((open) => !open)}>
          Filtros
          <ChevronDown className={`size-4 transition ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
        <div className={`${filtersOpen ? "grid" : "hidden"} gap-3 md:grid md:grid-cols-[320px_220px_220px_120px]`}>
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Buscar cliente, vehiculo o VIN..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <SearchableSelect value={stageId} options={[{ value: "", label: "Todas las etapas" }, ...data.options.stages.map((item) => ({ value: item.id, label: item.nombre }))]} onChange={setStageId} />
          <SearchableSelect value={timeStateId} options={[{ value: "", label: "Todos los estados de tiempo" }, ...(data.options.timeStates || []).map((item) => ({ value: item.id, label: item.nombre }))]} onChange={setTimeStateId} />
          <Button variant="outline" onClick={() => { setQuery(""); setStageId(""); setTimeStateId(""); }}>Limpiar</Button>
        </div>
      </section>
      <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-700">
              <tr>
                <SortableHeader sortKey="code" sortConfig={sortConfig} onSort={handleSort} className="px-3 py-3">Codigo</SortableHeader>
                <SortableHeader sortKey="clienteNombre" sortConfig={sortConfig} onSort={handleSort}>Cliente</SortableHeader>
                <SortableHeader sortKey="vehiculoNombre" sortConfig={sortConfig} onSort={handleSort}>Vehiculo</SortableHeader>
                <SortableHeader sortKey="origenNombre" sortConfig={sortConfig} onSort={handleSort}>Origen</SortableHeader>
                <SortableHeader sortKey="etapaNombre" sortConfig={sortConfig} onSort={handleSort}>Etapa</SortableHeader>
                <SortableHeader sortKey="asignadoNombre" sortConfig={sortConfig} onSort={handleSort}>Asignado</SortableHeader>
                <SortableHeader sortKey="agendaAt" sortConfig={sortConfig} onSort={handleSort}>Fecha agenda</SortableHeader>
                <SortableHeader sortKey="citaAt" sortConfig={sortConfig} onSort={handleSort}>Cita</SortableHeader>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((item) => (
                <tr key={item.id} style={rowTimeStyle(item)}>
                  <td className="px-3 py-3 font-bold text-blue-700">{item.code}</td>
                  <td>{item.clienteNombre}</td>
                  <td>{item.vehiculoNombre}</td>
                  <td>{item.origenNombre}</td>
                  <td><span className="rounded-full px-2 py-1 text-xs font-bold" style={{ color: item.etapaColor, backgroundColor: `${item.etapaColor}1f` }}>{item.etapaNombre}</span></td>
                  <td>{item.asignadoNombre}</td>
                  <td>{item.agendaDate ? `${item.agendaDate} ${item.agendaTime}` : "-"}</td>
                  <td>
                    {item.citaId ? (
                      <Button size="sm" variant="outline" onClick={() => { window.location.href = `/citaspv?id=${item.citaId}`; }}>
                        Ir a cita
                      </Button>
                    ) : <span className="text-xs text-slate-400">Sin cita</span>}
                  </td>
                  <td className="px-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="icon" variant="ghost" title="Ver detalle" onClick={() => { window.location.href = `/${kind === "lead" ? "leadspv" : "oportunidadespv"}/${item.id}`; }}><Eye className="size-4" /></Button>
                      {canEdit ? <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(item)}><Edit3 className="size-4" /></Button> : null}
                      {canAssign ? <Button size="icon" variant="ghost" title="Asignar" onClick={() => setAssignDialog({ open: true, item })}><Send className="size-4" /></Button> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={9} className="py-10 text-center text-slate-500">{data.loading ? "Cargando..." : "No hay registros"}</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="overflow-visible md:hidden">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
              <tr>
                <th className="w-[23%] px-2 py-2">Codigo</th>
                <th className="w-[38%] px-2 py-2">Cliente</th>
                <th className="w-[23%] px-2 py-2">Etapa</th>
                <th className="w-[16%] px-2 py-2 text-right">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((item) => (
                <tr key={item.id} className="align-top" style={rowTimeStyle(item)}>
                  <td className="px-2 py-3">
                    <button type="button" className="break-words text-left text-[11px] font-bold leading-tight text-blue-700" onClick={() => { window.location.href = `/${kind === "lead" ? "leadspv" : "oportunidadespv"}/${item.id}`; }}>
                      {item.code}
                    </button>
                  </td>
                  <td className="px-2 py-3">
                    <p className="line-clamp-2 text-[11px] font-bold leading-tight text-slate-950">{item.clienteNombre}</p>
                    <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight text-slate-500">{item.vehiculoNombre}</p>
                  </td>
                  <td className="px-2 py-3">
                    <span className="inline-flex max-w-full rounded-full px-2 py-1 text-[9px] font-bold leading-tight" style={{ color: item.etapaColor, backgroundColor: `${item.etapaColor}1f` }}>{item.etapaNombre}</span>
                  </td>
                  <td className="relative px-2 py-3 text-right">
                    <Button size="icon" variant="outline" className="size-8" onClick={() => setMobileActionId((current) => current === item.id ? null : item.id)}>
                      <MoreVertical className="size-4" />
                    </Button>
                    {mobileActionId === item.id ? (
                      <div className="absolute right-2 top-12 z-30 w-40 rounded-lg border border-slate-200 bg-white p-1 text-left text-xs shadow-xl">
                        <button type="button" className="block w-full rounded-md px-3 py-2 font-semibold hover:bg-slate-100" onClick={() => { setMobileActionId(null); window.location.href = `/${kind === "lead" ? "leadspv" : "oportunidadespv"}/${item.id}`; }}>Ver detalle</button>
                        {canEdit ? <button type="button" className="block w-full rounded-md px-3 py-2 font-semibold hover:bg-slate-100" onClick={() => { setMobileActionId(null); openEdit(item); }}>Editar</button> : null}
                        {canAssign ? <button type="button" className="block w-full rounded-md px-3 py-2 font-semibold hover:bg-slate-100" onClick={() => { setMobileActionId(null); setAssignDialog({ open: true, item }); }}>Asignar</button> : null}
                        {item.citaId ? <button type="button" className="block w-full rounded-md px-3 py-2 font-semibold hover:bg-slate-100" onClick={() => { setMobileActionId(null); window.location.href = `/citaspv?id=${item.citaId}`; }}>Ir a cita</button> : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={4} className="py-10 text-center text-slate-500">{data.loading ? "Cargando..." : "No hay registros"}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {editDialog.open ? (
        <EditOpportunityDialog
          state={editDialog}
          options={data.options}
          currentUser={data.currentUser}
          canViewAll={canViewAll}
          onClose={() => setEditDialog({ open: false, item: null, detail: null })}
          onSubmit={async (payload) => {
            await data.update(editDialog.item.id, payload);
            setEditDialog({ open: false, item: null, detail: null });
          }}
        />
      ) : null}
      {assignDialog.open ? (
        <AssignDialog
          state={assignDialog}
          users={data.options.users}
          onClose={() => setAssignDialog({ open: false, item: null })}
          onSubmit={async (payload) => {
            await data.assign(assignDialog.item.id, payload);
            setAssignDialog({ open: false, item: null });
          }}
        />
      ) : null}
    </div>
  );
}

function SortableHeader({ children, className = "", onSort, sortConfig, sortKey }) {
  const active = sortConfig.key === sortKey;
  return (
    <th className={className}>
      <button type="button" className={`inline-flex items-center gap-1 font-bold transition hover:text-violet-700 ${active ? "text-violet-700" : ""}`} onClick={() => onSort(sortKey)}>
        <span>{children}</span>
        {active ? <span className="text-[10px]">{sortConfig.direction === "asc" ? "ASC" : "DESC"}</span> : <ArrowUpDown className="size-3 text-slate-400" />}
      </button>
    </th>
  );
}

function EditOpportunityDialog({ state, options, currentUser, canViewAll, onClose, onSubmit }) {
  const item = state.item;
  const detail = state.detail;
  const [form, setForm] = useState({
    origenId: item?.origenId ? String(item.origenId) : "",
    suborigenId: item?.suborigenId ? String(item.suborigenId) : "",
    etapaId: item?.etapaId ? String(item.etapaId) : "",
    asignadoA: item?.asignadoA ? String(item.asignadoA) : "",
    fechaAgenda: "",
    horaAgenda: "",
    activityText: "",
    details: [],
    activities: [],
  });
  const originOptions = options.origins.map((origin) => ({ value: origin.id, label: origin.name }));
  const suboriginOptions = options.suborigins.filter((suborigin) => !form.origenId || Number(suborigin.origenId) === Number(form.origenId)).map((suborigin) => ({ value: suborigin.id, label: suborigin.name }));
  const stageOptions = options.stages.map((stage) => ({ value: stage.id, label: stage.nombre }));
  const userOptions = [{ value: "", label: "Sin asignar" }, ...options.users.map((user) => ({ value: user.id, label: user.fullname }))];

  function addDetail() {
    if (!form.fechaAgenda || !form.horaAgenda) return;
    setForm((current) => ({
      ...current,
      details: [...current.details, { fechaAgenda: current.fechaAgenda, horaAgenda: current.horaAgenda }],
      fechaAgenda: "",
      horaAgenda: "",
    }));
  }

  function addActivity() {
    const detalle = form.activityText.trim();
    if (!detalle) return;
    setForm((current) => ({
      ...current,
      activities: [...current.activities, { detalle }],
      activityText: "",
    }));
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(96vw,820px)] overflow-y-auto bg-white text-slate-950">
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-violet-700">Editar oportunidad</DialogTitle>
            <DialogDescription>{item?.code} - {item?.clienteNombre}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Cliente"><Input disabled value={item?.clienteNombre || ""} /></Field>
            <Field label="Creado por"><Input disabled value={detail?.opportunity?.creadoNombre || currentUser?.fullname || ""} /></Field>
            <Field label="Origen"><SearchableSelect value={form.origenId} options={originOptions} onChange={(value) => setForm((current) => ({ ...current, origenId: value, suborigenId: "" }))} /></Field>
            <Field label="Suborigen"><SearchableSelect value={form.suborigenId} options={suboriginOptions} onChange={(value) => setForm((current) => ({ ...current, suborigenId: value }))} /></Field>
            <Field label="Etapa"><SearchableSelect value={form.etapaId} options={stageOptions} onChange={(value) => setForm((current) => ({ ...current, etapaId: value }))} /></Field>
            <Field label="Asignado a"><SearchableSelect disabled={!canViewAll} value={form.asignadoA} options={userOptions} onChange={(value) => setForm((current) => ({ ...current, asignadoA: value }))} /></Field>
          </div>
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <h3 className="mb-3 text-sm font-bold text-emerald-800">Agregar agendas</h3>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <Field label="Fecha agenda"><Input type="date" value={form.fechaAgenda} onChange={(event) => setForm((current) => ({ ...current, fechaAgenda: event.target.value }))} /></Field>
              <Field label="Hora agenda"><Input type="time" value={form.horaAgenda} onChange={(event) => setForm((current) => ({ ...current, horaAgenda: event.target.value }))} /></Field>
              <div className="flex items-end"><Button type="button" variant="outline" className="w-full" onClick={addDetail}><Plus className="size-4" />Agregar</Button></div>
            </div>
            <AgendaList
              title="Nuevas agendas"
              details={form.details}
              onDelete={(index) => setForm((current) => ({ ...current, details: current.details.filter((_, itemIndex) => itemIndex !== index) }))}
            />
            <AgendaList title="Agendas registradas" details={detail?.details || []} />
          </section>
          <section className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <h3 className="mb-3 text-sm font-bold text-blue-800">Agregar actividades</h3>
            <Textarea className="min-h-24 bg-white" value={form.activityText} placeholder="Describe la actividad..." onChange={(event) => setForm((current) => ({ ...current, activityText: event.target.value }))} />
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={addActivity}><Plus className="size-4" />Agregar actividad</Button>
            <ActivityList
              title="Nuevas actividades"
              activities={form.activities}
              onDelete={(index) => setForm((current) => ({ ...current, activities: current.activities.filter((_, itemIndex) => itemIndex !== index) }))}
            />
            <ActivityList title="Actividades registradas" activities={detail?.activities || []} />
          </section>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActivityList({ title, activities, onDelete }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-bold text-slate-600">{title}</p>
      {activities.map((activity, index) => (
        <div key={`${title}-${activity.id || index}-${activity.detalle}`} className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-white p-2 text-sm">
          <span className="whitespace-pre-wrap font-semibold">{activity.detalle || "-"}</span>
          {onDelete ? <Button type="button" size="icon" variant="ghost" onClick={() => onDelete(index)}><Trash2 className="size-4 text-red-600" /></Button> : null}
        </div>
      ))}
      {!activities.length ? <p className="rounded-lg border border-dashed border-blue-300 bg-white p-3 text-center text-sm text-slate-500">Sin registros.</p> : null}
    </div>
  );
}

function AssignDialog({ state, users, onClose, onSubmit }) {
  const [asignadoA, setAsignadoA] = useState(state.item?.asignadoA ? String(state.item.asignadoA) : "");
  const userOptions = [{ value: "", label: "Sin asignar" }, ...users.map((user) => ({ value: user.id, label: user.fullname }))];
  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>Asignar oportunidad</DialogTitle>
          <DialogDescription>{state.item?.code}</DialogDescription>
        </DialogHeader>
        <Field label="Asignado a"><SearchableSelect value={asignadoA} options={userOptions} onChange={setAsignadoA} /></Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={() => onSubmit({ asignadoA })}>Asignar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgendaList({ title, details, onDelete }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-bold text-slate-600">{title}</p>
      {details.map((detail, index) => (
        <div key={`${title}-${detail.id || index}-${detail.fechaAgenda}-${detail.horaAgenda}`} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-white p-2 text-sm">
          <span className="font-semibold">{detail.fechaAgenda || "-"} {detail.horaAgenda || "-"}</span>
          {onDelete ? <Button type="button" size="icon" variant="ghost" onClick={() => onDelete(index)}><Trash2 className="size-4 text-red-600" /></Button> : null}
        </div>
      ))}
      {!details.length ? <p className="rounded-lg border border-dashed border-emerald-300 bg-white p-3 text-center text-sm text-slate-500">Sin registros.</p> : null}
    </div>
  );
}

function rowTimeStyle(item) {
  if (isClosedStage(item?.etapaNombre)) return undefined;
  if (!item.timeState?.color) return undefined;
  return {
    backgroundColor: hexToRgba(item.timeState.color, 0.14),
    boxShadow: `inset 4px 0 0 ${item.timeState.color}`,
  };
}

function isClosedStage(value) {
  const stage = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return stage.includes("cerrad");
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
  return <div className="space-y-1"><Label className="text-xs font-bold text-slate-700">{label}</Label>{children}</div>;
}
