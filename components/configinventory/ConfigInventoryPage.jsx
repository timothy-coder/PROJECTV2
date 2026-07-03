"use client";

import { useMemo, useState } from "react";
import { Box, Edit3, Info, Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

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
import { useConfigInventory } from "@/hooks/configinventory/useConfigInventory";
import { hasPerm } from "@/lib/permissions";

export default function ConfigInventoryPage({ userPermissions }) {
  const data = useConfigInventory();
  const [activeTab, setActiveTab] = useState("types");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null });
  const [measureDialog, setMeasureDialog] = useState({ open: false, item: null });
  const [measureDeleteDialog, setMeasureDeleteDialog] = useState({ open: false, item: null });
  const canViewTypes = hasPerm(userPermissions, ["configinventario", "view"]);
  const canCreate = hasPerm(userPermissions, ["configinventario", "create"]);
  const canEdit = hasPerm(userPermissions, ["configinventario", "edit"]);
  const canDelete = hasPerm(userPermissions, ["configinventario", "delete"]);
  const canViewSettings = canViewTypes || hasPerm(userPermissions, ["configinventario_opciones", "view"]);
  const canEditSettings = canEdit || hasPerm(userPermissions, ["configinventario_opciones", "edit"]);
  const canViewMeasures = canViewTypes || hasPerm(userPermissions, ["tiposmedida", "view"]) || hasPerm(userPermissions, ["configinventario_medidas", "view"]);
  const canCreateMeasures = canCreate || hasPerm(userPermissions, ["tiposmedida", "create"]) || hasPerm(userPermissions, ["configinventario_medidas", "create"]);
  const canEditMeasures = canEdit || hasPerm(userPermissions, ["tiposmedida", "edit"]) || hasPerm(userPermissions, ["configinventario_medidas", "edit"]);
  const canDeleteMeasures = canDelete || hasPerm(userPermissions, ["tiposmedida", "delete"]) || hasPerm(userPermissions, ["configinventario_medidas", "delete"]);

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return data.types;
    return data.types.filter((item) => item.nombre.toLowerCase().includes(clean));
  }, [data.types, query]);

  const tabs = [
    canViewTypes ? { key: "types", label: "Tipos" } : null,
    canViewSettings ? { key: "settings", label: "Opciones de inventario" } : null,
    canViewMeasures ? { key: "measures", label: "Tipos de medida" } : null,
  ].filter(Boolean);
  const displayedActiveTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : tabs[0]?.key;

  if (!tabs.length) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver configuracion de inventario.</div>;
  }

  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <h1 className="mb-4 text-2xl font-bold text-slate-950">Configuracion del sistema</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-4">
          <div className="flex size-10 items-center justify-center rounded-md bg-blue-600 text-white">
            <Box className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Tipos de Inventario</h2>
            <p className="text-xs font-medium text-slate-500">Gestiona las categorias de inventario disponibles</p>
          </div>
        </div>

        <div className="mb-4 flex w-full gap-2 overflow-x-auto rounded-lg bg-slate-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`h-9 shrink-0 rounded-md px-3 text-sm font-bold transition ${displayedActiveTab === tab.key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {displayedActiveTab === "settings" ? (
          <InventorySettingsPanel
            key={data.settings ? `${data.settings.id}-${data.settings.updatedAt || "settings"}` : "loading"}
            settings={data.settings}
            loading={data.loading}
            canEdit={canEditSettings}
            onSubmit={data.updateSettings}
          />
        ) : displayedActiveTab === "measures" ? (
          <MeasureTypesPanel
            items={data.measureTypes}
            loading={data.loading}
            canCreate={canCreateMeasures}
            canEdit={canEditMeasures}
            canDelete={canDeleteMeasures}
            onCreate={() => setMeasureDialog({ open: true, item: null })}
            onEdit={(item) => setMeasureDialog({ open: true, item })}
            onDelete={(item) => setMeasureDeleteDialog({ open: true, item })}
          />
        ) : (
          <>
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-bold text-blue-700">Total de Tipos</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-bold text-slate-950">{data.stats.total}</p>
            <Box className="size-8 text-blue-200" />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-blue-600 shadow-sm">
          <div className="flex flex-col gap-3 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-md bg-blue-600 text-white"><Box className="size-4" /></div>
              <div>
                <h3 className="text-sm font-bold text-slate-950">Lista de Tipos</h3>
                <p className="text-xs font-medium text-slate-500">Todos los tipos de inventario disponibles</p>
              </div>
            </div>
            {canCreate ? (
              <Button onClick={() => setDialog({ open: true, item: null })} className="bg-blue-600 text-white hover:bg-blue-700">
                <Plus className="size-4" />
                Nuevo Tipo
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="w-fit rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{data.types.length} tipos registrados</span>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tipo..." className="h-9 bg-white pl-9" />
            </div>
          </div>
          <div className="space-y-2 px-4 pb-4">
            {data.loading ? (
              <div className="py-10 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</div>
            ) : filtered.length ? (
              filtered.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 px-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="size-2 rounded-full bg-blue-500" />
                    <p className="truncate text-sm font-bold text-slate-950">{item.nombre}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {canEdit ? <Button variant="outline" size="icon" className="border-orange-300 text-orange-600" onClick={() => setDialog({ open: true, item })}><Edit3 className="size-4" /></Button> : null}
                    {canDelete ? <Button variant="outline" size="icon" className="border-red-300 text-red-600" onClick={() => setDeleteDialog({ open: true, item })}><Trash2 className="size-4" /></Button> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-slate-500">No hay tipos de inventario.</div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex gap-2 text-blue-700">
            <Info className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-sm font-bold">Informacion importante:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs font-medium">
                <li>Los tipos clasifican los articulos del inventario.</li>
                <li>Puedes editar o eliminar tipos en cualquier momento.</li>
                <li>Eliminar un tipo puede afectar registros existentes.</li>
              </ul>
            </div>
          </div>
        </div>
          </>
        )}
      </section>

      {dialog.open ? (
        <TypeDialog
          state={dialog}
          onClose={() => setDialog({ open: false, item: null })}
          onSubmit={async (payload) => {
            if (dialog.item) await data.updateType(dialog.item.id, payload);
            else await data.createType(payload);
            setDialog({ open: false, item: null });
          }}
        />
      ) : null}
      <DeleteDialog
        state={deleteDialog}
        onClose={() => setDeleteDialog({ open: false, item: null })}
        onConfirm={async () => {
          await data.deleteType(deleteDialog.item.id);
          setDeleteDialog({ open: false, item: null });
        }}
      />
      {measureDialog.open ? (
        <MeasureTypeDialog
          state={measureDialog}
          onClose={() => setMeasureDialog({ open: false, item: null })}
          onSubmit={async (payload) => {
            if (measureDialog.item) await data.updateMeasureType(measureDialog.item.id, payload);
            else await data.createMeasureType(payload);
            setMeasureDialog({ open: false, item: null });
          }}
        />
      ) : null}
      <MeasureDeleteDialog
        state={measureDeleteDialog}
        onClose={() => setMeasureDeleteDialog({ open: false, item: null })}
        onConfirm={async () => {
          await data.deleteMeasureType(measureDeleteDialog.item.id);
          setMeasureDeleteDialog({ open: false, item: null });
        }}
      />
    </div>
  );
}

function InventorySettingsPanel({ settings, loading, canEdit, onSubmit }) {
  const [form, setForm] = useState({
    habilitarMarcaManual: false,
    habilitarLotes: true,
    habilitarFechaVencimiento: true,
    habilitarProveedorEnLote: true,
    habilitarTipoMedida: true,
    ...settings,
  });
  const [saving, setSaving] = useState(false);

  const options = [
    {
      key: "habilitarMarcaManual",
      title: "Permitir marca manual",
      description: "Habilita ingresar marca manualmente en inventario de posventa.",
    },
    {
      key: "habilitarLotes",
      title: "Usar lotes",
      description: "Activa el control de lotes para los productos.",
    },
    {
      key: "habilitarFechaVencimiento",
      title: "Fecha de vencimiento",
      description: "Permite registrar vencimiento por lote o producto.",
    },
    {
      key: "habilitarProveedorEnLote",
      title: "Proveedor en lote",
      description: "Permite asociar proveedor al registrar lotes.",
    },
    {
      key: "habilitarTipoMedida",
      title: "Tipo de medida",
      description: "Muestra el tipo de medida en productos de inventario.",
    },
  ];

  async function save() {
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !settings) {
    return <div className="py-10 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando opciones...</div>;
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-950">Opciones de inventario posventa</h3>
          <p className="text-xs font-medium text-slate-500">Esta configuracion se guarda en una sola fila del sistema.</p>
        </div>
        {canEdit ? (
          <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar opciones
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => (
          <label key={option.key} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <span>
              <span className="block text-sm font-bold text-slate-950">{option.title}</span>
              <span className="mt-1 block text-xs font-medium leading-relaxed text-slate-500">{option.description}</span>
            </span>
            <Switch
              checked={Boolean(form[option.key])}
              disabled={!canEdit || saving}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, [option.key]: Boolean(checked) }))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function MeasureTypesPanel({ items, loading, canCreate, canEdit, canDelete, onCreate, onEdit, onDelete }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return items;
    return items.filter((item) => `${item.nombre} ${item.abreviatura || ""}`.toLowerCase().includes(clean));
  }, [items, query]);

  return (
    <>
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-xs font-bold text-blue-700">Total de Tipos de Medida</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-2xl font-bold text-slate-950">{items.length}</p>
          <Box className="size-8 text-blue-200" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-blue-600 shadow-sm">
        <div className="flex flex-col gap-3 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-blue-600 text-white"><Box className="size-4" /></div>
            <div>
              <h3 className="text-sm font-bold text-slate-950">Lista de Tipos de Medida</h3>
              <p className="text-xs font-medium text-slate-500">Medidas disponibles para productos de inventario</p>
            </div>
          </div>
          {canCreate ? (
            <Button onClick={onCreate} className="bg-blue-600 text-white hover:bg-blue-700">
              <Plus className="size-4" />
              Nuevo Tipo
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="w-fit rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{items.length} tipos registrados</span>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar medida..." className="h-9 bg-white pl-9" />
          </div>
        </div>
        <div className="space-y-2 px-4 pb-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</div>
          ) : filtered.length ? (
            filtered.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 px-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="size-2 rounded-full bg-blue-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">{item.nombre}</p>
                    <p className="text-xs font-medium text-slate-500">{item.abreviatura || "Sin abreviatura"}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {canEdit ? <Button variant="outline" size="icon" className="border-orange-300 text-orange-600" onClick={() => onEdit(item)}><Edit3 className="size-4" /></Button> : null}
                  {canDelete ? <Button variant="outline" size="icon" className="border-red-300 text-red-600" onClick={() => onDelete(item)}><Trash2 className="size-4" /></Button> : null}
                </div>
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-sm text-slate-500">No hay tipos de medida.</div>
          )}
        </div>
      </div>
    </>
  );
}

function TypeDialog({ state, onClose, onSubmit }) {
  const [nombre, setNombre] = useState(state.item?.nombre || "");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    await onSubmit({ nombre });
    setSaving(false);
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-white text-slate-950">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-blue-700">{state.item ? "Editar tipo" : "Nuevo tipo"}</DialogTitle>
            <DialogDescription>Completa el nombre del tipo de inventario.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Ej: Repuestos" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MeasureTypeDialog({ state, onClose, onSubmit }) {
  const [nombre, setNombre] = useState(state.item?.nombre || "");
  const [abreviatura, setAbreviatura] = useState(state.item?.abreviatura || "");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    await onSubmit({ nombre, abreviatura });
    setSaving(false);
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-white text-slate-950">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-blue-700">{state.item ? "Editar tipo de medida" : "Nuevo tipo de medida"}</DialogTitle>
            <DialogDescription>Completa el nombre y la abreviatura del tipo de medida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Ej: Unidad" required />
          </div>
          <div className="space-y-2">
            <Label>Abreviatura</Label>
            <Input value={abreviatura} onChange={(event) => setAbreviatura(event.target.value)} placeholder="Ej: und" maxLength={20} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ state, onClose, onConfirm }) {
  if (!state.open) return null;
  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-red-600">Eliminar tipo</DialogTitle>
          <DialogDescription>Se eliminara {state.item?.nombre}.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm}>Eliminar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeasureDeleteDialog({ state, onClose, onConfirm }) {
  if (!state.open) return null;
  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-red-600">Eliminar tipo de medida</DialogTitle>
          <DialogDescription>Se eliminara {state.item?.nombre}.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm}>Eliminar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
