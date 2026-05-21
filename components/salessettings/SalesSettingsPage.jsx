"use client";

import { useMemo, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignCenter, AlignLeft, AlignRight, Calendar, Clock, Edit3, Eye, FileImage, FileText, GripVertical, ImagePlus, Link, Plus, Save, Trash2, Type, Workflow } from "lucide-react";
import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSalesDocumentTemplates } from "@/hooks/salessettings/useSalesDocumentTemplates";
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
  const closePermKey = scope === "ventas" ? permKey : "config_posventa_cierres";
  const canViewClosings = hasPerm(userPermissions, [closePermKey, "view"]) || canView;
  const closingPerms = {
    canCreate: hasPerm(userPermissions, [closePermKey, "create"]) || canCreate,
    canEdit: hasPerm(userPermissions, [closePermKey, "edit"]) || canEdit,
    canDelete: hasPerm(userPermissions, [closePermKey, "delete"]) || canDelete,
  };
  const canViewTemplates = scope === "ventas" && (hasPerm(userPermissions, ["config_ventas_plantillas", "view"]) || canView);
  const templatePerms = {
    canCreate: hasPerm(userPermissions, ["config_ventas_plantillas", "create"]) || canCreate,
    canEdit: hasPerm(userPermissions, ["config_ventas_plantillas", "edit"]) || canEdit,
    canDelete: hasPerm(userPermissions, ["config_ventas_plantillas", "delete"]) || canDelete,
  };
  const tabs = [
    { id: "schedule", label: scope === "ventas" ? "Horarios Ventas" : "Horarios PostVenta" },
    { id: "stages", label: "Etapas de Conversion" },
    { id: "times", label: "Tiempos" },
    ...(canViewClosings ? [{ id: "closings", label: "Detalles de cierre" }] : []),
    ...(canViewTemplates ? [{ id: "templates", label: "Plantillas" }] : []),
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
      {tab === "closings" ? <ClosingTab data={data} scope={scope} canCreate={closingPerms.canCreate} canEdit={closingPerms.canEdit} canDelete={closingPerms.canDelete} openDialog={(item) => setDialog({ open: true, resource: "closing", item })} /> : null}
      {tab === "templates" ? <TemplatesTab perms={templatePerms} /> : null}
      {dialog.open ? <EntityDialog state={dialog} onClose={() => setDialog({ open: false, resource: "", item: null })} onSubmit={async (payload) => { await data.save({ ...payload, resource: dialog.resource }); setDialog({ open: false, resource: "", item: null }); }} /> : null}
    </div>
  );
}

function TemplatesTab({ perms }) {
  const data = useSalesDocumentTemplates(true);
  const [selectedId, setSelectedId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const selected = useMemo(() => data.templates.find((item) => String(item.id) === String(selectedId)) || data.templates[0], [data.templates, selectedId]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Header
        icon={FileText}
        title="Plantillas de Ventas"
        subtitle="Configura ficha tecnica, cotizacion y reserva con encabezado, pie, imagenes y marca de agua"
        action={perms.canCreate ? <Button onClick={() => setDialogOpen(true)}><Plus className="size-4" />Nueva plantilla</Button> : null}
      />
      <div className="grid min-h-[640px] gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">Documentos</p>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">{data.templates.length}</span>
          </div>
          <div className="space-y-2">
            {data.templates.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(String(item.id))}
                className={cn("w-full rounded-lg border bg-white p-3 text-left transition hover:border-blue-300", selected?.id === item.id && "border-blue-500 ring-2 ring-blue-100")}
              >
                <span className="block text-xs font-bold text-blue-700">{documentLabel(item.tipoDocumento)}</span>
                <span className="mt-1 block truncate text-sm font-bold text-slate-900">{item.nombre}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{item.descripcion || "Sin descripcion"}</span>
              </button>
            ))}
            {!data.loading && !data.templates.length ? <p className="rounded-lg bg-white p-3 text-xs font-medium text-slate-500">Aun no hay plantillas.</p> : null}
          </div>
        </aside>
        {selected ? (
          <TemplateEditor
            key={templateRevisionKey(selected)}
            template={selected}
            data={data}
            perms={perms}
            onDeleted={() => setSelectedId("")}
          />
        ) : (
          <div className="grid place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">Crea o selecciona una plantilla.</div>
        )}
      </div>
      {dialogOpen ? <TemplateDialog open onClose={() => setDialogOpen(false)} onSubmit={async (payload) => { await data.create(payload); setDialogOpen(false); }} /> : null}
    </section>
  );
}

function TemplateEditor({ template, data, perms, onDeleted }) {
  const [draft, setDraft] = useState(template);
  const [activeSectionId, setActiveSectionId] = useState(template.secciones[0]?.id || "");
  const activeSection = draft.secciones.find((item) => item.id === activeSectionId) || draft.secciones[0];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  async function saveTemplate() {
    await data.save({ action: "save-template", id: draft.id, tipoDocumento: draft.tipoDocumento, nombre: draft.nombre, descripcion: draft.descripcion, isActive: draft.isActive });
  }

  async function saveSection(section) {
    await data.save({ action: "save-section", id: section.id, nombre: section.nombre, orden: section.orden, isActive: section.isActive });
  }

  async function saveElement(element) {
    await data.save({ action: "save-element", ...element });
  }

  async function uploadIntoElement(file, element) {
    if (!file) return;
    const uploaded = await data.uploadImage(file);
    await saveElement({ ...element, imagenPath: uploaded.path });
  }

  async function uploadWatermark(file) {
    if (!file) return;
    const uploaded = await data.uploadImage(file);
    await data.save({ action: "save-watermark", plantillaId: draft.id, imagenPath: uploaded.path, opacity: 0.15, rotateDeg: 0, scale: 1 });
  }

  function updateElementLocal(elementId, patch) {
    setDraft((current) => ({
      ...current,
      secciones: current.secciones.map((section) => ({
        ...section,
        elementos: section.elementos.map((element) => (element.id === elementId ? { ...element, ...patch } : element)),
      })),
    }));
  }

  async function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id || !activeSection || !perms.canEdit) return;
    const fromIndex = activeSection.elementos.findIndex((item) => item.id === active.id);
    const toIndex = activeSection.elementos.findIndex((item) => item.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    const moved = arrayMove(activeSection.elementos, fromIndex, toIndex).map((item, index) => ({ ...item, orden: index + 1 }));
    setDraft((current) => ({ ...current, secciones: current.secciones.map((section) => (section.id === activeSection.id ? { ...section, elementos: moved } : section)) }));
    for (const item of moved) await saveElement(item);
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(360px,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="grid gap-3 md:grid-cols-[160px_1fr]">
            <Field label="Tipo"><NativeSelect disabled={!perms.canEdit} value={draft.tipoDocumento} onChange={(e) => setDraft((v) => ({ ...v, tipoDocumento: e.target.value }))} options={[["FICHA_TECNICA", "Ficha tecnica"], ["COTIZACION", "Cotizacion"], ["RESERVA", "Reserva"]]} /></Field>
            <Field label="Nombre"><Input disabled={!perms.canEdit} value={draft.nombre} onChange={(e) => setDraft((v) => ({ ...v, nombre: e.target.value }))} /></Field>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
            <Field label="Descripcion"><Input disabled={!perms.canEdit} value={draft.descripcion || ""} onChange={(e) => setDraft((v) => ({ ...v, descripcion: e.target.value }))} /></Field>
            <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-slate-700"><Checkbox disabled={!perms.canEdit} checked={draft.isActive} onCheckedChange={(checked) => setDraft((v) => ({ ...v, isActive: Boolean(checked) }))} />Activa</label>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {perms.canDelete ? <Button variant="destructive" onClick={async () => { await data.save({ action: "delete-template", id: draft.id }); onDeleted(); }}><Trash2 className="size-4" />Eliminar</Button> : null}
            {perms.canEdit ? <Button onClick={saveTemplate}><Save className="size-4" />Guardar datos</Button> : null}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-100 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><Eye className="size-4" />Vista previa</div>
          <DocumentPreview template={draft} activeSectionId={activeSection?.id} onPickSection={setActiveSectionId} />
        </div>
      </div>
      <aside className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-bold text-slate-800">Editor de elementos</p>
        <div className="grid grid-cols-2 gap-2">
          {draft.secciones.map((section) => (
            <button key={section.id} type="button" onClick={() => setActiveSectionId(section.id)} className={cn("rounded-md border px-3 py-2 text-xs font-bold", activeSection?.id === section.id ? "border-blue-500 bg-blue-50 text-blue-700" : "bg-white text-slate-600")}>{section.tipo === "ENCABEZADO" ? "Encabezado" : "Pie"}</button>
          ))}
        </div>
        {activeSection ? (
          <>
            <Field label="Nombre de seccion"><Input disabled={!perms.canEdit} value={activeSection.nombre || ""} onChange={(e) => setDraft((v) => ({ ...v, secciones: v.secciones.map((s) => s.id === activeSection.id ? { ...s, nombre: e.target.value } : s) }))} onBlur={() => saveSection(activeSection)} /></Field>
            {perms.canEdit ? <ElementCreateBar section={activeSection} onCreate={saveElement} /> : null}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={activeSection.elementos.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {activeSection.elementos.map((element) => (
                    <ElementEditor
                      key={element.id}
                      element={element}
                      canEdit={perms.canEdit}
                      canDelete={perms.canDelete}
                      onLocal={updateElementLocal}
                      onSave={saveElement}
                      onDelete={async () => data.save({ action: "delete-element", id: element.id })}
                      onUpload={(file) => uploadIntoElement(file, element)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        ) : null}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-bold text-slate-700">Marca de agua</p>
          {draft.marcaAgua?.imagenPath ? <img src={draft.marcaAgua.imagenPath} alt="" className="mb-2 h-20 max-w-full rounded border object-contain" /> : null}
          {perms.canEdit ? (
            <div className="space-y-2">
              <Input type="file" accept="image/*" onChange={(e) => uploadWatermark(e.target.files?.[0])} />
              {draft.marcaAgua ? (
                <>
                  <Field label="Opacidad"><Input type="number" min="0" max="1" step="0.05" value={draft.marcaAgua.opacity} onChange={(e) => setDraft((v) => ({ ...v, marcaAgua: { ...v.marcaAgua, opacity: e.target.value } }))} /></Field>
                  <Field label="Rotacion"><Input type="number" value={draft.marcaAgua.rotateDeg} onChange={(e) => setDraft((v) => ({ ...v, marcaAgua: { ...v.marcaAgua, rotateDeg: e.target.value } }))} /></Field>
                  <Field label="Escala"><Input type="number" min="0.1" step="0.1" value={draft.marcaAgua.scale} onChange={(e) => setDraft((v) => ({ ...v, marcaAgua: { ...v.marcaAgua, scale: e.target.value } }))} /></Field>
                  <Button className="w-full" onClick={() => data.save({ action: "save-watermark", plantillaId: draft.id, imagenPath: draft.marcaAgua.imagenPath, opacity: draft.marcaAgua.opacity, rotateDeg: draft.marcaAgua.rotateDeg, scale: draft.marcaAgua.scale })}><Save className="size-4" />Guardar marca</Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
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
function ClosingTab({ data, scope, canCreate, canEdit, canDelete, openDialog }) {
  const subtitle = scope === "ventas" ? "Gestiona los detalles y notas de cierres de ventas" : "Gestiona los detalles disponibles para cierres de PostVenta";
  return <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><Header icon={FileText} title="Detalles de Cierre" subtitle={subtitle} action={canCreate ? <Button onClick={() => openDialog(null)}><Plus className="size-4" />Nuevo</Button> : null} /><List>{data.closings.map((item) => <Row key={item.id} title={item.detalle} subtitle={`ID ${item.id}`} onEdit={canEdit ? () => openDialog(item) : null} onDelete={canDelete ? () => data.delete("closing", item.id) : null} />)}</List></section>;
}

function ElementCreateBar({ section, onCreate }) {
  const nextOrder = (section.elementos?.length || 0) + 1;
  return (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="outline" onClick={() => onCreate({ seccionId: section.id, tipo: "TEXTO", texto: "Nuevo texto", orden: nextOrder, align: "LEFT", isActive: true })}><Type className="size-4" />Texto</Button>
      <Button variant="outline" onClick={() => onCreate({ seccionId: section.id, tipo: "LINK", texto: "Nuevo link", url: "https://", orden: nextOrder, align: "LEFT", isActive: true })}><Link className="size-4" />Link</Button>
      <Button variant="outline" onClick={() => onCreate({ seccionId: section.id, tipo: "IMAGEN", orden: nextOrder, align: "CENTER", widthPx: 180, isActive: true })}><ImagePlus className="size-4" />Imagen</Button>
    </div>
  );
}

function ElementEditor({ element, canEdit, canDelete, onLocal, onSave, onDelete, onUpload }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: element.id, disabled: !canEdit });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const Icon = element.tipo === "IMAGEN" ? FileImage : element.tipo === "LINK" ? Link : Type;
  return (
    <div ref={setNodeRef} style={style} className={cn("rounded-lg border border-slate-200 bg-white p-3", isDragging && "relative z-10 border-blue-400 shadow-lg")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100" {...attributes} {...listeners}><GripVertical className="size-4" /></button>
          <Icon className="size-4 text-blue-600" />
          {element.tipo}
        </div>
        <div className="flex gap-1">
          {canEdit ? <Button size="icon-sm" variant="outline" onClick={() => onSave(element)}><Save className="size-3" /></Button> : null}
          {canDelete ? <Button size="icon-sm" variant="destructive" onClick={onDelete}><Trash2 className="size-3" /></Button> : null}
        </div>
      </div>
      <div className="space-y-2">
        {element.tipo !== "IMAGEN" ? <Textarea disabled={!canEdit} value={element.texto || ""} onChange={(e) => onLocal(element.id, { texto: e.target.value })} onBlur={(e) => onSave({ ...element, texto: e.target.value })} className="min-h-16" /> : null}
        {element.tipo === "LINK" ? <Input disabled={!canEdit} value={element.url || ""} placeholder="https://" onChange={(e) => onLocal(element.id, { url: e.target.value })} onBlur={(e) => onSave({ ...element, url: e.target.value })} /> : null}
        {element.tipo === "IMAGEN" ? (
          <div className="space-y-2">
            {element.imagenPath ? <img src={element.imagenPath} alt="" className="max-h-24 rounded border object-contain" /> : null}
            {canEdit ? <Input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0])} /> : null}
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          <Field label="Orden"><Input disabled={!canEdit} type="number" value={element.orden || 0} onChange={(e) => onLocal(element.id, { orden: e.target.value })} onBlur={(e) => onSave({ ...element, orden: e.target.value })} /></Field>
          <Field label="Ancho"><Input disabled={!canEdit} type="number" value={element.widthPx || ""} onChange={(e) => onLocal(element.id, { widthPx: e.target.value })} onBlur={(e) => onSave({ ...element, widthPx: e.target.value })} /></Field>
          <Field label="Alto"><Input disabled={!canEdit} type="number" value={element.heightPx || ""} onChange={(e) => onLocal(element.id, { heightPx: e.target.value })} onBlur={(e) => onSave({ ...element, heightPx: e.target.value })} /></Field>
        </div>
        <div className="flex items-center justify-between gap-2">
          <AlignButtons disabled={!canEdit} value={element.align} onChange={(align) => { onLocal(element.id, { align }); onSave({ ...element, align }); }} />
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Checkbox disabled={!canEdit} checked={element.isActive} onCheckedChange={(checked) => { onLocal(element.id, { isActive: Boolean(checked) }); onSave({ ...element, isActive: Boolean(checked) }); }} />Activo</label>
        </div>
      </div>
    </div>
  );
}

function DocumentPreview({ template, activeSectionId, onPickSection }) {
  const header = template.secciones.find((item) => item.tipo === "ENCABEZADO");
  const footer = template.secciones.find((item) => item.tipo === "PIE");
  return (
    <div className="mx-auto flex min-h-[720px] w-full max-w-[760px] flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200">
      <div className="pointer-events-none absolute" />
      <PreviewSection section={header} active={activeSectionId === header?.id} onClick={() => header && onPickSection(header.id)} />
      <div className="relative mx-8 my-6 flex flex-1 items-center justify-center border-y border-dashed border-slate-200 py-16 text-center text-xs font-semibold text-slate-300">
        {template.marcaAgua?.imagenPath ? <img src={template.marcaAgua.imagenPath} alt="" className="absolute max-h-72 max-w-[70%] object-contain" style={{ opacity: template.marcaAgua.opacity, transform: `rotate(${template.marcaAgua.rotateDeg}deg) scale(${template.marcaAgua.scale})` }} /> : null}
        <span className="relative">Contenido del documento</span>
      </div>
      <PreviewSection section={footer} active={activeSectionId === footer?.id} onClick={() => footer && onPickSection(footer.id)} />
    </div>
  );
}

function PreviewSection({ section, active, onClick }) {
  if (!section) return null;
  const rows = groupElementsByOrder(section.elementos.filter((item) => item.isActive));
  return (
    <button type="button" onClick={onClick} className={cn("min-h-24 w-full border border-dashed px-8 py-4 text-left transition", active ? "border-blue-500 bg-blue-50/60" : "border-transparent hover:border-blue-300")}>
      <p className="mb-2 text-[11px] font-bold uppercase text-slate-400">{section.nombre || section.tipo}</p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="grid items-start gap-3" style={{ gridTemplateColumns: `repeat(${row.items.length}, minmax(0, 1fr))` }}>
            {row.items.map((item) => <PreviewElement key={item.id} item={item} />)}
          </div>
        ))}
      </div>
    </button>
  );
}

function PreviewElement({ item }) {
  const textAlign = item.align?.toLowerCase() || "left";
  const boxStyle = { textAlign };
  const mediaStyle = { width: item.widthPx ? `${item.widthPx}px` : undefined, height: item.heightPx ? `${item.heightPx}px` : undefined };
  if (item.tipo === "IMAGEN") {
    return <div style={boxStyle}>{item.imagenPath ? <img src={item.imagenPath} alt="" className="inline-block max-w-full object-contain" style={mediaStyle} /> : <span className="inline-flex h-16 w-32 items-center justify-center rounded border bg-slate-50 text-xs text-slate-400">Imagen</span>}</div>;
  }
  if (item.tipo === "LINK") return <p style={boxStyle} className="text-sm font-semibold text-blue-700 underline">{item.texto || item.url || "Link"}</p>;
  return <p style={boxStyle} className="whitespace-pre-wrap text-sm text-slate-800">{item.texto || "Texto"}</p>;
}

function TemplateDialog({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({ tipoDocumento: "COTIZACION", nombre: "", descripcion: "", isActive: true });
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="bg-white text-slate-950">
        <DialogHeader><DialogTitle>Nueva plantilla</DialogTitle><DialogDescription>Define el documento base para ventas.</DialogDescription></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
          <Field label="Tipo"><NativeSelect value={form.tipoDocumento} onChange={(e) => setForm((v) => ({ ...v, tipoDocumento: e.target.value }))} options={[["FICHA_TECNICA", "Ficha tecnica"], ["COTIZACION", "Cotizacion"], ["RESERVA", "Reserva"]]} /></Field>
          <Field label="Nombre"><Input value={form.nombre} required onChange={(e) => setForm((v) => ({ ...v, nombre: e.target.value }))} /></Field>
          <Field label="Descripcion"><Textarea value={form.descripcion} onChange={(e) => setForm((v) => ({ ...v, descripcion: e.target.value }))} /></Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.isActive} onCheckedChange={(checked) => setForm((v) => ({ ...v, isActive: Boolean(checked) }))} />Activa</label>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Crear</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AlignButtons({ value, onChange, disabled }) {
  const items = [["LEFT", AlignLeft], ["CENTER", AlignCenter], ["RIGHT", AlignRight]];
  return <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1">{items.map(([align, Icon]) => <button key={align} disabled={disabled} type="button" onClick={() => onChange(align)} className={cn("rounded p-1.5 text-slate-500", value === align && "bg-white text-blue-700 shadow-sm")}><Icon className="size-3.5" /></button>)}</div>;
}

function NativeSelect({ value, onChange, options, disabled }) {
  return <select disabled={disabled} value={value} onChange={onChange} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400">{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>;
}

function documentLabel(value) {
  return { FICHA_TECNICA: "Ficha tecnica", COTIZACION: "Cotizacion", RESERVA: "Reserva" }[value] || value;
}

function groupElementsByOrder(elements) {
  const grouped = new Map();
  elements
    .slice()
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0) || Number(a.id || 0) - Number(b.id || 0))
    .forEach((element) => {
      const key = Number(element.orden || 0);
      const list = grouped.get(key) || [];
      list.push(element);
      grouped.set(key, list);
    });
  return Array.from(grouped.entries()).map(([key, items]) => ({ key, items }));
}

function templateRevisionKey(template) {
  const sections = template.secciones
    .map((section) => `${section.id}:${section.elementos.map((element) => `${element.id}-${element.tipo}-${element.imagenPath || ""}-${element.orden}`).join(",")}`)
    .join("|");
  const watermark = template.marcaAgua ? `${template.marcaAgua.imagenPath}-${template.marcaAgua.opacity}-${template.marcaAgua.rotateDeg}-${template.marcaAgua.scale}` : "";
  return `${template.id}-${template.updatedAt || ""}-${sections}-${watermark}`;
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
  return <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}><DialogContent className="bg-white text-slate-950"><DialogHeader><DialogTitle>{state.item ? "Editar" : "Nuevo"}</DialogTitle><DialogDescription>Completa la informacion.</DialogDescription></DialogHeader><form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">{isClosing ? <Field label="Detalle"><Textarea value={form.detalle} onChange={(e) => setForm((f) => ({ ...f, detalle: e.target.value }))} /></Field> : isTime ? <><Field label="Nombre"><Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></Field><Field label="Estado"><Input value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))} /></Field><div className="grid grid-cols-2 gap-2"><Field label="Desde"><Input type="number" value={form.minutosDesde} onChange={(e) => setForm((f) => ({ ...f, minutosDesde: e.target.value }))} /></Field><Field label="Hasta"><Input type="number" value={form.minutosHasta} onChange={(e) => setForm((f) => ({ ...f, minutosHasta: e.target.value }))} /></Field></div><Field label="Color"><Input type="color" value={form.colorHexadecimal} onChange={(e) => setForm((f) => ({ ...f, colorHexadecimal: e.target.value }))} /></Field><Field label="Descripcion"><Textarea value={form.descripcion || ""} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></Field><label className="flex gap-2"><Switch checked={form.activo} onCheckedChange={(v) => setForm((f) => ({ ...f, activo: Boolean(v) }))} />Activo</label></> : <><Field label="Nombre"><Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></Field><Field label="Color"><Input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} /></Field><Field label="Descripcion"><Input type="number" value={form.descripcion ?? 0} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></Field><Field label="Orden"><Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} /></Field><label className="flex gap-2"><Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: Boolean(v) }))} />Activo</label></>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Guardar</Button></DialogFooter></form></DialogContent></Dialog>;
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
