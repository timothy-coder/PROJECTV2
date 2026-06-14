"use client";

import { useMemo, useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronDown, ChevronRight, Edit3, Eye, ListChecks, Loader2, Plus, Search, Trash2, Wrench, Zap } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMaintenance } from "@/hooks/maintenance/useMaintenance";
import { hasPerm } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function can(userPermissions, module, action) {
  return hasPerm(userPermissions, [module, action]);
}

export default function MaintenancePage({ userPermissions }) {
  const data = useMaintenance();
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [dialog, setDialog] = useState({ open: false, type: "maintenance", item: null, readonly: false });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, title: "", description: "", onConfirm: null });

  const canCreateMaintenance = can(userPermissions, "combomantenimiento", "create");
  const canEditMaintenance = can(userPermissions, "combomantenimiento", "edit");
  const canDeleteMaintenance = can(userPermissions, "combomantenimiento", "delete");
  const canCreateSub = can(userPermissions, "submantenimiento", "create");
  const canEditSub = can(userPermissions, "submantenimiento", "edit");
  const canDeleteSub = can(userPermissions, "submantenimiento", "delete");

  const canViewMaintenance = can(userPermissions, "combomantenimiento", "view");
  const canViewSub = can(userPermissions, "submantenimiento", "view");
  const filteredMaintenances = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return data.maintenances;
    return data.maintenances.filter((item) => {
      const subText = item.subitems.map((sub) => `${sub.name} ${sub.description || ""}`).join(" ");
      return `${item.name} ${item.description || ""} ${subText}`.toLowerCase().includes(clean);
    });
  }, [data.maintenances, query]);

  function askDelete(config) {
    setDeleteDialog({ open: true, ...config });
  }

  if (!canViewMaintenance && !canViewSub) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver mantenimientos.</div>;
  }

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 p-3 text-slate-950 md:h-svh sm:p-4">
      <div className="mb-3 flex shrink-0 items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md bg-violet-700 text-white shadow-sm">
          <Wrench className="size-5" />
        </div>
        <div>
          <h1 className="text-base font-bold leading-tight text-slate-950">Mantenimientos</h1>
          <p className="text-xs font-medium text-slate-500">Gestiona mantenimientos y submantenimientos</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-4 shrink-0 gap-2">
        <Stat label="Total" value={data.stats.total} tone="purple" icon={ListChecks} />
        <Stat label="Activos" value={data.stats.active} tone="green" icon={Zap} />
        <Stat label="Con base" value={data.stats.withBase} tone="orange" icon={Zap} />
        <Stat label="Subs" value={data.stats.subs} tone="blue" icon={ListChecks} />
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." className="h-10 bg-white pl-9" />
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            {canCreateMaintenance ? (
              <Button onClick={() => setDialog({ open: true, type: "maintenance", item: null, readonly: false })} className="h-10 bg-violet-700 text-white hover:bg-violet-800">
                <Plus className="size-4" />
                Nuevo Mantenimiento
              </Button>
            ) : null}
          </div>
        </div>

        <MaintenanceList
          loading={data.loading}
          items={filteredMaintenances}
          maintenances={data.maintenances}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          onView={(item) => setDialog({ open: true, type: "maintenance", item, readonly: true })}
          onEdit={(item) => setDialog({ open: true, type: "maintenance", item, readonly: false })}
          onDelete={(item) => askDelete({
            title: "Eliminar mantenimiento",
            description: `Se eliminara ${item.name} y sus submantenimientos.`,
            onConfirm: () => data.deleteMaintenance(item.id),
          })}
          onCreateSub={(item) => setDialog({ open: true, type: "submaintenance", item: { posventaMantenimientoId: item.id, isNew: true }, readonly: false })}
          onViewSub={(item) => setDialog({ open: true, type: "submaintenance", item, readonly: true })}
          onEditSub={(item) => setDialog({ open: true, type: "submaintenance", item, readonly: false })}
          onDeleteSub={(item) => askDelete({
            title: "Eliminar submantenimiento",
            description: `Se eliminara ${item.name}.`,
            onConfirm: () => data.deleteSubmaintenance(item.id),
          })}
          canEdit={canEditMaintenance}
          canDelete={canDeleteMaintenance}
          canViewSub={canViewSub}
          canCreateSub={canCreateSub}
          canEditSub={canEditSub}
          canDeleteSub={canDeleteSub}
        />
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          <span className="font-medium">Pagina 1 de 1</span>
          <span className="text-center font-medium">{filteredMaintenances.length} de {data.maintenances.length} registros</span>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled className="h-9">
              Anterior
            </Button>
            <Button variant="outline" disabled className="h-9">
              Siguiente
            </Button>
          </div>
        </div>
      </section>

      {dialog.open ? (
        <MaintenanceDialog
          key={`${dialog.type}-${dialog.item?.id || "new"}-${dialog.readonly}`}
          state={dialog}
          maintenances={data.maintenances}
          onClose={() => setDialog({ open: false, type: "maintenance", item: null, readonly: false })}
          onSubmit={async (payload) => {
            if (dialog.type === "maintenance") {
              if (dialog.item) await data.updateMaintenance(dialog.item.id, payload);
              else await data.createMaintenance(payload);
            } else if (dialog.item && !dialog.item.isNew) await data.updateSubmaintenance(dialog.item.id, payload);
            else await data.createSubmaintenance(payload);
            setDialog({ open: false, type: "maintenance", item: null, readonly: false });
          }}
        />
      ) : null}
      <ConfirmDeleteDialog state={deleteDialog} onClose={() => setDeleteDialog({ open: false, title: "", description: "", onConfirm: null })} />
    </div>
  );
}

function MaintenanceList({
  loading,
  items,
  maintenances,
  expandedId,
  setExpandedId,
  onView,
  onEdit,
  onDelete,
  onCreateSub,
  onViewSub,
  onEditSub,
  onDeleteSub,
  canEdit,
  canDelete,
  canViewSub,
  canCreateSub,
  canEditSub,
  canDeleteSub,
}) {
  if (loading) return <div className="min-h-0 flex-1 overflow-auto"><EmptyState text="Cargando mantenimientos..." loading /></div>;
  if (!items.length) return <div className="min-h-0 flex-1 overflow-auto"><EmptyState text="No hay mantenimientos" /></div>;

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-auto px-4 py-3">
      {items.map((item) => {
        const baseNames = getBaseNames(item.mantenimientoId, maintenances);
        return (
          <div key={item.id} className="overflow-visible rounded-lg border border-slate-200">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 gap-2 p-3 pr-1">
                <Button variant="ghost" size="icon-sm" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                  {expandedId === item.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </Button>
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-950">{item.name}</p>
                  <Badge tone={item.isActive ? "green" : "slate"}>{item.isActive ? "Activo" : "Inactivo"}</Badge>
                  {baseNames.length ? <Badge tone="purple">{baseNames.length} base</Badge> : null}
                  <Badge tone="blue">{item.subitems.length} sub</Badge>
                </div>
                {item.description ? <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">{item.description}</p> : null}
                {baseNames.length ? <p className="mt-1 text-xs font-medium text-slate-500">Suma: {baseNames.join(", ")}</p> : null}
              </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 p-3 pl-1">
                {canCreateSub ? <Button onClick={() => onCreateSub(item)} className="hidden bg-violet-700 text-white hover:bg-violet-800 sm:inline-flex"><Plus className="size-4" />Sub</Button> : null}
                <RowActions
                  onView={() => onView(item)}
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item)}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  mobileExtraActions={canCreateSub ? [{ label: "Sub", icon: Plus, onClick: () => onCreateSub(item) }] : []}
                />
              </div>
            </div>
            {expandedId === item.id ? (
              <SubmaintenanceList
                loading={false}
                items={item.subitems}
                onView={onViewSub}
                onEdit={onEditSub}
                onDelete={onDeleteSub}
                canView={canViewSub}
                canEdit={canEditSub}
                canDelete={canDeleteSub}
                nested
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SubmaintenanceList({ loading, items, onView, onEdit, onDelete, canView = true, canEdit, canDelete, nested = false }) {
  if (!canView) return <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">Sin permiso para ver submantenimientos.</div>;
  if (loading) return <EmptyState text="Cargando submantenimientos..." loading />;
  if (!items.length) return <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 text-center text-xs font-medium text-slate-500">No hay submantenimientos.</div>;

  return (
    <div className={cn("space-y-2", nested ? "border-t border-slate-200 bg-slate-50 p-3" : "px-4 pb-4")}>
      {items.map((item) => (
        <div key={item.id} className="overflow-visible rounded-lg border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-slate-950">{item.name}</p>
                <Badge tone="blue">{item.mantenimientoName || "Sin padre"}</Badge>
                <Badge tone={item.isActive ? "green" : "slate"}>{item.isActive ? "Activo" : "Inactivo"}</Badge>
              </div>
              {item.description ? <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">{item.description}</p> : null}
            </div>
            <RowActions onView={() => onView(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} canEdit={canEdit} canDelete={canDelete} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MaintenanceDialog({ state, maintenances, onClose, onSubmit }) {
  const isSub = state.type === "submaintenance";
  const readonly = state.readonly;
  const [form, setForm] = useState(() => {
    if (isSub) {
      return {
        name: state.item?.name || "",
        description: state.item?.description || "",
        posventaMantenimientoId: state.item?.posventaMantenimientoId ? String(state.item.posventaMantenimientoId) : "",
        isActive: state.item?.isActive ?? true,
      };
    }
    return {
      name: state.item?.name || "",
      description: state.item?.description || "",
      mantenimientoIds: parseIds(state.item?.mantenimientoId),
      isBase: Boolean(state.item?.mantenimientoId),
      isActive: state.item?.isActive ?? true,
    };
  });
  const [saving, setSaving] = useState(false);
  const maintenanceOptions = maintenances
    .filter((item) => item.id !== state.item?.id)
    .map((item) => ({ value: item.id, label: item.name }));

  async function submit(event) {
    event.preventDefault();
    if (readonly) return onClose();
    setSaving(true);
    if (isSub) {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim(),
        posventaMantenimientoId: Number(form.posventaMantenimientoId),
        isActive: form.isActive,
      });
    } else {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim(),
        mantenimientoIds: form.mantenimientoIds,
        isActive: form.isActive,
      });
    }
    setSaving(false);
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(94vw,430px)] overflow-y-auto bg-white p-0 text-slate-950">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-violet-100 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700">
              <Wrench className="size-5" />
              {readonly ? "Detalle" : state.item && !state.item.isNew ? "Editar" : "Nuevo"} {isSub ? "submantenimiento" : "mantenimiento"}
            </DialogTitle>
            <DialogDescription>{isSub ? "Configura el submantenimiento" : "Configura el mantenimiento"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 p-4">
            <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3">
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-violet-700">
                <span className="flex size-6 items-center justify-center rounded-full bg-violet-700 text-xs text-white">1</span>
                Informacion
              </p>
              <div className="space-y-3">
                <Field label="Nombre *">
                  <Input disabled={readonly} value={form.name} placeholder="Ej: Cambio de aceite" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                </Field>
                <Field label="Descripcion">
                  <Textarea disabled={readonly} value={form.description} placeholder="Descripcion detallada..." onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24 bg-white" />
                </Field>
                {isSub ? (
                  <Field label="Mantenimiento padre *">
                    <SearchableSelect
                      disabled={readonly}
                      value={form.posventaMantenimientoId}
                      options={maintenanceOptions}
                      placeholder="Seleccionar mantenimiento"
                      searchPlaceholder="Buscar mantenimiento..."
                      onChange={(value) => setForm((current) => ({ ...current, posventaMantenimientoId: value }))}
                    />
                  </Field>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3">
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-violet-700">
                <span className="flex size-6 items-center justify-center rounded-full bg-violet-700 text-xs text-white">{isSub ? 2 : 3}</span>
                Opciones
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-3 rounded-lg border border-violet-100 bg-white p-3">
                  <Switch disabled={readonly} checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: Boolean(checked) }))} />
                  <span>
                    <span className="block text-sm font-bold text-violet-700">Activo</span>
                    <span className="text-xs font-medium text-slate-500">Visible en el sistema</span>
                  </span>
                </label>
                {!isSub ? (
                  <>
                    <label className="flex items-center gap-3 rounded-lg border border-violet-100 bg-white p-3">
                      <Switch
                        disabled={readonly}
                        checked={Boolean(form.isBase)}
                        onCheckedChange={(checked) => setForm((current) => ({
                          ...current,
                          isBase: Boolean(checked),
                          mantenimientoIds: checked ? current.mantenimientoIds : [],
                        }))}
                      />
                      <span>
                        <span className="block text-sm font-bold text-violet-700">Mantenimiento base</span>
                        <span className="text-xs font-medium text-slate-500">{form.isBase ? "Activo" : "Inactivo"}</span>
                      </span>
                    </label>
                    {form.isBase ? (
                      <Field label="Mantenimientos que suma">
                        <MaintenanceMultiSelect
                          disabled={readonly}
                          value={form.mantenimientoIds}
                          options={maintenanceOptions}
                          onChange={(value) => setForm((current) => ({ ...current, mantenimientoIds: value }))}
                        />
                      </Field>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 p-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            {!readonly ? <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">{saving ? "Guardando..." : "Guardar cambios"}</Button> : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MaintenanceMultiSelect({ value, options, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.filter((option) => value.includes(Number(option.value)));

  function toggle(optionValue) {
    const id = Number(optionValue);
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  }

  return (
    <div className="relative">
      <Button type="button" variant="outline" disabled={disabled} onClick={() => setOpen((current) => !current)} className="h-9 w-full justify-start bg-white text-slate-950">
        <span className="truncate">{selected.length ? selected.map((item) => item.label).join(", ") : "Click para buscar..."}</span>
      </Button>
      {open ? (
        <>
          <button type="button" aria-label="Cerrar selector" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
            <Command>
              <div className="flex h-9 items-center gap-2 border-b border-slate-200 px-3">
                <Search className="size-4 text-slate-400" />
                <Command.Input placeholder="Buscar mantenimiento..." className="h-full w-full bg-transparent text-sm outline-none" />
              </div>
              <Command.List className="max-h-56 overflow-y-auto p-1">
                <Command.Empty className="px-3 py-6 text-center text-sm text-slate-500">No se encontro.</Command.Empty>
                {options.map((option) => (
                  <Command.Item key={option.value} value={option.label} onSelect={() => toggle(option.value)} className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm data-[selected=true]:bg-slate-100">
                    <span className="truncate">{option.label}</span>
                    {value.includes(Number(option.value)) ? <Check className="size-4 text-violet-700" /> : null}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </div>
        </>
      ) : null}
    </div>
  );
}

function RowActions({ onView, onEdit, onDelete, canEdit, canDelete, mobileExtraActions = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex shrink-0 justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((current) => !current)}
        className="h-8 gap-1 px-2 sm:hidden"
      >
        Acciones
        <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
      </Button>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg sm:hidden">
          {mobileExtraActions.map((action) => (
            <MobileMenuItem key={action.label} icon={action.icon} label={action.label} onClick={action.onClick} close={() => setOpen(false)} />
          ))}
          <MobileMenuItem icon={Eye} label="Ver" onClick={onView} close={() => setOpen(false)} />
          {canEdit ? <MobileMenuItem icon={Edit3} label="Editar" onClick={onEdit} close={() => setOpen(false)} /> : null}
          {canDelete ? <MobileMenuItem icon={Trash2} label="Eliminar" onClick={onDelete} close={() => setOpen(false)} className="text-red-600 hover:bg-red-50" /> : null}
        </div>
      ) : null}

      <div className="hidden shrink-0 justify-end gap-2 sm:flex">
        <Button variant="ghost" size="icon" onClick={onView}><Eye className="size-4" /></Button>
        {canEdit ? <Button variant="ghost" size="icon" onClick={onEdit}><Edit3 className="size-4" /></Button> : null}
        {canDelete ? <Button variant="destructive" size="icon" onClick={onDelete}><Trash2 className="size-4" /></Button> : null}
      </div>
    </div>
  );
}

function MobileMenuItem({ icon: Icon, label, onClick, close, className = "" }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        close?.();
      }}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50",
        className
      )}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {label}
    </button>
  );
}

function ConfirmDeleteDialog({ state, onClose }) {
  const [saving, setSaving] = useState(false);
  if (!state.open) return null;

  async function confirm() {
    setSaving(true);
    await state.onConfirm?.();
    setSaving(false);
    onClose();
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-red-600">{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={saving}>{saving ? "Eliminando..." : "Eliminar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ text, loading }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center px-4 py-10 text-center text-xs font-medium text-slate-500">
      {loading ? <Loader2 className="mb-2 size-7 animate-spin text-slate-300" /> : <Wrench className="mb-2 size-8 text-slate-300" />}
      {text}
    </div>
  );
}

function Stat({ label, value, tone, icon: Icon }) {
  const tones = {
    purple: "border-violet-200 bg-violet-50 text-violet-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <div className={cn("flex items-center justify-between rounded-lg border px-2 py-2 sm:px-3", tones[tone])}>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold leading-4 sm:text-[11px]">{label}</p>
        <p className="mt-0.5 text-xl font-bold leading-6 text-slate-950">{value}</p>
      </div>
      <Icon className="hidden size-5 shrink-0 opacity-50 sm:block" />
    </div>
  );
}

function Badge({ tone, children }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    purple: "bg-violet-50 text-violet-700 border-violet-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", tones[tone])}>{children}</span>;
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-violet-700">{label}</Label>
      {children}
    </div>
  );
}

function filterByQuery(items, query) {
  const clean = query.trim().toLowerCase();
  if (!clean) return items;
  return items.filter((item) => `${item.name} ${item.description || ""}`.toLowerCase().includes(clean));
}

function parseIds(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter(Boolean);
}

function getBaseNames(value, maintenances) {
  const ids = parseIds(value);
  return maintenances.filter((item) => ids.includes(item.id)).map((item) => item.name);
}
