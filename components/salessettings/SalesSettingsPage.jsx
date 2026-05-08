"use client";

import { useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Clock, Edit3, FileText, GripVertical, Plus, Trash2, Workflow } from "lucide-react";
import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSalesSettings } from "@/hooks/salessettings/useSalesSettings";
import { hasPerm } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const days = [
  ["monday", "Lunes"], ["tuesday", "Martes"], ["wednesday", "Miercoles"], ["thursday", "Jueves"], ["friday", "Viernes"], ["saturday", "Sabado"], ["sunday", "Domingo"],
];

export default function SalesSettingsPage({ scope, userPermissions }) {
  const data = useSalesSettings(scope);
  const permKey = scope === "ventas" ? "configagenda" : "configcotizacion";
  const [tab, setTab] = useState("schedule");
  const [dialog, setDialog] = useState({ open: false, resource: "", item: null });
  const canView = hasPerm(userPermissions, [permKey, "view"]);
  const canCreate = hasPerm(userPermissions, [permKey, "create"]);
  const canEdit = hasPerm(userPermissions, [permKey, "edit"]);
  const canDelete = hasPerm(userPermissions, [permKey, "delete"]);
  const tabs = [
    { id: "schedule", label: scope === "ventas" ? "Horarios Ventas" : "Horarios PostVenta" },
    { id: "stages", label: "Etapas de Conversion" },
    { id: "times", label: "Tiempos" },
    ...(scope === "ventas" ? [{ id: "closings", label: "Detalles de cierre" }] : []),
  ];
  if (!canView) return <div className="rounded-lg bg-white p-4 text-sm text-slate-700">No tienes permiso para ver esta configuracion.</div>;
  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <h1 className="mb-4 text-2xl font-bold">Configuracion del sistema</h1>
      <div className="mb-3 overflow-x-auto rounded-lg bg-slate-100 p-1">
        <div className="flex min-w-max gap-1">{tabs.map((item) => <button key={item.id} className={cn("h-8 rounded-md px-8 text-xs font-semibold text-slate-600", tab === item.id && "bg-white text-slate-950 shadow-sm")} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
      </div>
      {tab === "schedule" ? <ScheduleTab data={data} canEdit={canEdit} scope={scope} /> : null}
      {tab === "stages" ? <StageTab data={data} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} openDialog={(item) => setDialog({ open: true, resource: "stage", item })} /> : null}
      {tab === "times" ? <TimeTab data={data} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} openDialog={(item) => setDialog({ open: true, resource: "time", item })} /> : null}
      {tab === "closings" ? <ClosingTab data={data} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} openDialog={(item) => setDialog({ open: true, resource: "closing", item })} /> : null}
      {dialog.open ? <EntityDialog state={dialog} onClose={() => setDialog({ open: false, resource: "", item: null })} onSubmit={async (payload) => { await data.save({ ...payload, resource: dialog.resource }); setDialog({ open: false, resource: "", item: null }); }} /> : null}
    </div>
  );
}

function ScheduleTab({ data, canEdit, scope }) {
  const firstCenterId = data.centers[0]?.id ? String(data.centers[0].id) : "";
  const firstSchedule = data.schedules.find((item) => String(item.centroId) === firstCenterId) || data.schedules[0];
  const [centroId, setCentroId] = useState(firstCenterId || (firstSchedule?.centroId ? String(firstSchedule.centroId) : ""));
  const selectedCenterId = centroId || firstCenterId;
  const selected = data.schedules.find((item) => String(item.centroId) === String(selectedCenterId)) || firstSchedule || {};
  const [draft, setDraft] = useState({});
  const slot = draft.slot ?? selected.slotMinutes ?? 30;
  const week = draft.week ?? selected.week ?? defaultWeek();
  const centerOptions = data.centers.map((item) => ({ value: item.id, label: item.nombre }));
  const subtitle = scope === "ventas" ? "Configura los horarios disponibles para ventas por centro" : "Configura los horarios disponibles para postventa por centro";
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Header icon={Calendar} title="Horario de Atencion" subtitle={subtitle} />
      <div className="mb-4 grid gap-3 md:grid-cols-[220px_1fr_280px]">
        <Field label="Centro de Atencion"><SearchableSelect value={selectedCenterId} options={centerOptions} placeholder="Seleccione centro" onChange={(value) => { const s = data.schedules.find((item) => String(item.centroId) === value); setCentroId(value); setDraft({ slot: s?.slotMinutes || 30, week: s?.week || defaultWeek() }); }} /></Field>
        <Field label="Duracion del Slot"><Input type="number" value={slot} onChange={(e) => setDraft((value) => ({ ...value, slot: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-2"><Mini label="Dias Activos" value={Object.values(week).filter((d) => d.active).length} /><Mini label="Horas/Semana" value={`${Object.values(week).filter((d) => d.active).length * 10}.0h`} /></div>
      </div>
      <div className="space-y-2">
        {days.map(([key, label]) => {
          const value = week[key] || { active: false, start: "08:00", end: "18:00" };
          return <div key={key} className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-2 font-bold"><Switch checked={value.active} onCheckedChange={(checked) => setDraft((draftValue) => ({ ...draftValue, week: { ...week, [key]: { ...value, active: Boolean(checked) } } }))} />{label}<span className="rounded-full bg-blue-600 px-2 py-1 text-xs text-white">{value.active ? "Activo" : "Inactivo"}</span></label><div className="flex gap-2"><Input type="time" value={value.start} onChange={(e) => setDraft((draftValue) => ({ ...draftValue, week: { ...week, [key]: { ...value, start: e.target.value } } }))} /><Input type="time" value={value.end} onChange={(e) => setDraft((draftValue) => ({ ...draftValue, week: { ...week, [key]: { ...value, end: e.target.value } } }))} /></div></div>;
        })}
      </div>
      {canEdit ? <div className="mt-3 flex justify-end"><Button disabled={!selectedCenterId} onClick={() => data.save({ resource: "schedule", centroId: selectedCenterId, slotMinutes: slot, week })}>Guardar Cambios</Button></div> : null}
    </section>
  );
}

function StageTab({ data, canCreate, canEdit, canDelete, openDialog }) {
  const active = data.stages.filter((s) => s.isActive).length;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const stageIds = data.stages.map((item) => item.id);
  const handleDragEnd = async ({ active: activeItem, over }) => {
    if (!over || activeItem.id === over.id || !canEdit) return;
    const fromIndex = data.stages.findIndex((item) => item.id === activeItem.id);
    const toIndex = data.stages.findIndex((item) => item.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    const items = arrayMove(data.stages, fromIndex, toIndex);
    await data.save({ resource: "stage-order", items: items.map((item, index) => ({ id: item.id, sortOrder: index + 1 })) });
  };
  const toggleStage = (item, checked) => data.save({ resource: "stage", ...item, isActive: checked });
  return <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><Header icon={Workflow} title="Etapas de Conversion" subtitle="Arrastra para reordenar las etapas en el flujo" action={canCreate ? <Button onClick={() => openDialog(null)}><Plus className="size-4" />Nueva Etapa</Button> : null} /><div className="mb-4 grid gap-3 md:grid-cols-3"><Stat label="Total de Etapas" value={data.stages.length} /><Stat label="Etapas Activas" value={active} tone="green" /><Stat label="Inactivas" value={data.stages.length - active} tone="slate" /></div><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={stageIds} strategy={verticalListSortingStrategy}><List>{data.stages.map((item) => <StageRow key={item.id} item={item} canDrag={canEdit} canEdit={canEdit} canDelete={canDelete} onToggle={(checked) => toggleStage(item, checked)} onEdit={() => openDialog(item)} onDelete={() => data.delete("stage", item.id)} />)}</List></SortableContext></DndContext></section>;
}
function TimeTab({ data, canCreate, canEdit, canDelete, openDialog }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><Header icon={Clock} title="Estados de Tiempo" subtitle="Configura los rangos de tiempo y codigos de color" action={canCreate ? <Button onClick={() => openDialog(null)}><Plus className="size-4" />Nuevo Estado</Button> : null} /><div className="mb-4 grid gap-3 md:grid-cols-3"><Stat label="Total de Estados" value={data.times.length} /><Stat label="Rango Minimo" value={data.times.length ? Math.min(...data.times.map((t) => t.minutosDesde)) : 0} /><Stat label="Rango Maximo" value={data.times.length ? Math.max(...data.times.map((t) => t.minutosHasta)) : 0} /></div><List>{data.times.map((item) => <Row key={item.id} title={item.nombre} subtitle={`${item.minutosDesde} a ${item.minutosHasta} min - ${item.descripcion || ""}`} badges={[item.estado, item.colorHexadecimal]} color={item.colorHexadecimal} onEdit={canEdit ? () => openDialog(item) : null} onDelete={canDelete ? () => data.delete("time", item.id) : null} />)}</List></section>;
}
function ClosingTab({ data, canCreate, canEdit, canDelete, openDialog }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><Header icon={FileText} title="Detalles de Cierre" subtitle="Gestiona los detalles y notas de cierres de periodo" action={canCreate ? <Button onClick={() => openDialog(null)}><Plus className="size-4" />Nuevo</Button> : null} /><List>{data.closings.map((item) => <Row key={item.id} title={item.detalle} subtitle={`ID ${item.id}`} onEdit={canEdit ? () => openDialog(item) : null} onDelete={canDelete ? () => data.delete("closing", item.id) : null} />)}</List></section>;
}

function EntityDialog({ state, onClose, onSubmit }) {
  const isTime = state.resource === "time";
  const isClosing = state.resource === "closing";
  const [form, setForm] = useState({
    id: state.item?.id,
    nombre: state.item?.nombre || "",
    estado: state.item?.estado || "",
    minutosDesde: state.item?.minutosDesde ?? 0,
    minutosHasta: state.item?.minutosHasta ?? 0,
    colorHexadecimal: state.item?.colorHexadecimal || state.item?.color || "#2563eb",
    color: state.item?.color || "#2563eb",
    sortOrder: state.item?.sortOrder || 0,
    descripcion: state.item?.descripcion || 0,
    detalle: state.item?.detalle || "",
    isActive: state.item?.isActive ?? true,
    activo: state.item?.activo ?? true,
  });
  return <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}><DialogContent className="bg-white text-slate-950"><DialogHeader><DialogTitle>{state.item ? "Editar" : "Nuevo"}</DialogTitle><DialogDescription>Completa la informacion.</DialogDescription></DialogHeader><form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">{isClosing ? <Field label="Detalle"><Textarea value={form.detalle} onChange={(e) => setForm((f) => ({ ...f, detalle: e.target.value }))} /></Field> : isTime ? <><Field label="Nombre"><Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></Field><Field label="Estado"><Input value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))} /></Field><div className="grid grid-cols-2 gap-2"><Field label="Desde"><Input type="number" value={form.minutosDesde} onChange={(e) => setForm((f) => ({ ...f, minutosDesde: e.target.value }))} /></Field><Field label="Hasta"><Input type="number" value={form.minutosHasta} onChange={(e) => setForm((f) => ({ ...f, minutosHasta: e.target.value }))} /></Field></div><Field label="Color"><Input type="color" value={form.colorHexadecimal} onChange={(e) => setForm((f) => ({ ...f, colorHexadecimal: e.target.value }))} /></Field><Field label="Descripcion"><Textarea value={form.descripcion || ""} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></Field><label className="flex gap-2"><Switch checked={form.activo} onCheckedChange={(v) => setForm((f) => ({ ...f, activo: Boolean(v) }))} />Activo</label></> : <><Field label="Nombre"><Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></Field><Field label="Color"><Input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} /></Field><Field label="Orden"><Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} /></Field><label className="flex gap-2"><Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: Boolean(v) }))} />Activo</label></>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Guardar</Button></DialogFooter></form></DialogContent></Dialog>;
}

function Header({ icon: Icon, title, subtitle, action }) { return <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-md bg-blue-600 text-white"><Icon className="size-5" /></div><div><h2 className="text-2xl font-bold">{title}</h2><p className="text-xs text-slate-500">{subtitle}</p></div></div>{action}</div>; }
function List({ children }) { return <div className="space-y-2 rounded-lg border border-slate-200 p-3">{children}</div>; }
function StageRow({ item, canDrag, canEdit, canDelete, onToggle, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !canDrag });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50/40", isDragging && "relative z-10 border-blue-400 bg-blue-50 shadow-lg")}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" className={cn("rounded p-1 text-slate-400", canDrag && "cursor-grab hover:bg-slate-100 active:cursor-grabbing")} {...attributes} {...listeners}>
          <GripVertical className="size-4 shrink-0" />
        </button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{item.nombre}</span>
            <span className="rounded-full border bg-slate-50 px-2 py-1 text-xs text-slate-600"><span className="mr-1 inline-block size-2 rounded-full" style={{ background: item.color }} />{item.color}</span>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">#{item.sortOrder}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{item.descripcion || 0}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {canEdit ? <label className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"><Switch checked={item.isActive} onCheckedChange={onToggle} />Activo</label> : <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{item.isActive ? "Activo" : "Inactivo"}</span>}
        {canEdit ? <Button variant="outline" size="icon" onClick={onEdit}><Edit3 className="size-4" /></Button> : null}
        {canDelete ? <Button variant="destructive" size="icon" onClick={onDelete}><Trash2 className="size-4" /></Button> : null}
      </div>
    </div>
  );
}
function Row({ title, subtitle, badges = [], color, onEdit, onDelete }) { return <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-bold">{title}</span>{color ? <span className="size-3 rounded-full" style={{ background: color }} /> : null}{badges.map((b) => <span key={b} className="rounded-full bg-slate-100 px-2 py-1 text-xs">{b}</span>)}</div>{subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}</div><div className="flex gap-2">{onEdit ? <Button variant="outline" size="icon" onClick={onEdit}><Edit3 className="size-4" /></Button> : null}{onDelete ? <Button variant="destructive" size="icon" onClick={onDelete}><Trash2 className="size-4" /></Button> : null}</div></div>; }
function Field({ label, children }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }
function Stat({ label, value, tone = "blue" }) { const tones = { blue:"border-blue-200 bg-blue-50", green:"border-emerald-200 bg-emerald-50", slate:"border-slate-200 bg-slate-50" }; return <div className={`rounded-lg border p-4 ${tones[tone]}`}><p className="text-xs font-bold text-blue-700">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>; }
function Mini({ label, value }) { return <div className="rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="text-xs text-blue-700">{label}</p><p className="text-xl font-bold text-blue-700">{value}</p></div>; }
function defaultWeek() { return Object.fromEntries(days.map(([key]) => [key, { active: true, start: "08:00", end: "18:00" }])); }
