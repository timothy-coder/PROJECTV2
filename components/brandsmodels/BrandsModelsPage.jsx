"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Calendar,
  Car,
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";

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
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useBrandsModels } from "@/hooks/brandsmodels/useBrandsModels";
import { hasPerm } from "@/lib/permissions";

const emptyBrand = { name: "", imageUrl: "" };
const emptyModel = { marcaId: "", claseId: "", name: "", anios: "" };
const emptyMaintenance = { marcaId: "", modeloId: "", kilometraje: "", meses: "", anios: "" };
const operatorOptions = [
  { value: "<=", label: "≤" },
  { value: ">=", label: "≥" },
];

function can(userPermissions, module, action) {
  return hasPerm(userPermissions, [module, action]);
}

export default function BrandsModelsPage({ userPermissions }) {
  const data = useBrandsModels();
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [brandDialog, setBrandDialog] = useState({ open: false, item: null, readonly: false });
  const [modelDialog, setModelDialog] = useState({ open: false, item: null, brand: null, readonly: false });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, title: "", description: "", onConfirm: null });
  const [classesOpen, setClassesOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [brandActionsOpenId, setBrandActionsOpenId] = useState(null);

  const canViewBrands = can(userPermissions, "marcas", "view");
  const canCreateBrand = can(userPermissions, "marcas", "create");
  const canEditBrand = can(userPermissions, "marcas", "edit");
  const canDeleteBrand = can(userPermissions, "marcas", "delete");
  const canCreateModel = can(userPermissions, "modelos", "create");
  const canEditModel = can(userPermissions, "modelos", "edit");
  const canDeleteModel = can(userPermissions, "modelos", "delete");
  const canViewClasses = can(userPermissions, "clases", "view");
  const canViewMaintenance = can(userPermissions, "algoritmo_visita", "view");

  const filteredBrands = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return data.brands;
    return data.brands.filter((brand) =>
      brand.name.toLowerCase().includes(clean) ||
      brand.models.some((model) => model.name.toLowerCase().includes(clean))
    );
  }, [data.brands, query]);

  function askDelete({ title, description, onConfirm }) {
    setDeleteDialog({ open: true, title, description, onConfirm });
  }

  if (!canViewBrands) {
    return (
      <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700 shadow-sm">
        No tienes permiso para ver marcas y modelos.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 p-3 text-slate-950 md:h-svh sm:p-4">
      <PageHeader />

      <div className="mb-3 grid grid-cols-3 shrink-0 gap-2">
        <Stat label="Total de Marcas" shortLabel="Marcas" value={data.stats.brands} tone="blue" icon={Car} />
        <Stat label="Total de Modelos" shortLabel="Modelos" value={data.stats.models} tone="purple" icon={Layers} />
        <Stat label="Total de Clases" shortLabel="Clases" value={data.stats.classes} tone="green" icon={Layers} />
      </div>

      {canViewClasses || canViewMaintenance ? (
        <section className="mb-3 shrink-0 rounded-lg border border-slate-200 border-l-4 border-l-violet-600 bg-white shadow-sm">
          <div className="grid grid-cols-3 gap-2 px-3 py-3 sm:flex sm:flex-wrap sm:px-4">
            <Button variant="outline" onClick={data.reload} disabled={data.loading} className="h-10 px-2 text-xs sm:px-4 sm:text-sm">
              <RefreshCw className="size-4" />
              <span className="hidden sm:inline">Recargar</span>
            </Button>
            {canViewClasses ? (
              <Button variant="outline" onClick={() => setClassesOpen(true)} className="h-10 border-emerald-300 px-2 text-xs text-emerald-700 sm:px-4 sm:text-sm">
                <Layers className="size-4" />
                Clases
              </Button>
            ) : null}
            {canViewMaintenance ? (
              <Button variant="outline" onClick={() => setMaintenanceOpen(true)} className="h-10 border-orange-300 px-2 text-xs text-orange-700 sm:px-4 sm:text-sm">
                <Wrench className="size-4" />
                <span className="sm:hidden">Mant.</span>
                <span className="hidden sm:inline">F. de mantenimiento</span>
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-violet-600 bg-white shadow-sm">
        <div className="flex shrink-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar marca o modelo..."
              className="h-10 bg-white pl-9 text-slate-950"
            />
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            {canCreateBrand ? (
              <Button onClick={() => setBrandDialog({ open: true, item: null, readonly: false })} className="h-10 bg-violet-700 text-white hover:bg-violet-800">
                <Plus className="size-4" />
                Nueva Marca
              </Button>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto border-t border-slate-200">
          <table className="w-full border-collapse text-left text-sm sm:min-w-[760px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="w-10 px-3 py-2.5" />
                <th className="px-3 py-2.5">Marca</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Logo</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Modelos</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    <Loader2 className="mr-2 inline size-4 animate-spin" />
                    Cargando...
                  </td>
                </tr>
              ) : filteredBrands.length ? (
                filteredBrands.map((brand) => {
                  const actionsOpen = brandActionsOpenId === brand.id;

                  return (
                  <Fragment key={brand.id}>
                    <tr className="bg-white">
                      <td className="px-3 py-2.5">
                        <Button variant="ghost" size="icon-sm" onClick={() => setExpandedId(expandedId === brand.id ? null : brand.id)}>
                          {expandedId === brand.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </Button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {brand.imageUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={brand.imageUrl} alt={brand.name} className="h-7 w-10 shrink-0 object-contain sm:hidden" />
                            </>
                          ) : (
                            <span className="hidden rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 sm:hidden">Sin imagen</span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">{brand.name}</p>
                            <span className="mt-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 sm:hidden">
                              {brand.models.length} modelos
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 sm:table-cell">
                        {brand.imageUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={brand.imageUrl} alt={brand.name} className="h-6 max-w-20 object-contain" />
                          </>
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">Sin imagen</span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2.5 sm:table-cell">
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">{brand.models.length}</span>
                      </td>
                      <td className="relative px-3 py-2.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setBrandActionsOpenId(actionsOpen ? null : brand.id)}
                          className="ml-auto flex h-8 gap-1 px-2 sm:hidden"
                        >
                          Acciones
                          <ChevronDown className={`size-4 transition ${actionsOpen ? "rotate-180" : ""}`} />
                        </Button>

                        {actionsOpen ? (
                          <div className="absolute right-3 top-11 z-20 w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg sm:hidden">
                            <MobileMenuItem icon={Eye} label="Ver marca" onClick={() => setBrandDialog({ open: true, item: brand, readonly: true })} close={() => setBrandActionsOpenId(null)} />
                            {canEditBrand ? (
                              <MobileMenuItem icon={Edit3} label="Editar marca" onClick={() => setBrandDialog({ open: true, item: brand, readonly: false })} close={() => setBrandActionsOpenId(null)} />
                            ) : null}
                            {canCreateModel ? (
                              <MobileMenuItem icon={Plus} label="Nuevo modelo" onClick={() => setModelDialog({ open: true, item: null, brand, readonly: false })} close={() => setBrandActionsOpenId(null)} />
                            ) : null}
                            {canDeleteBrand ? (
                              <MobileMenuItem
                                icon={Trash2}
                                label="Eliminar marca"
                                onClick={() => askDelete({
                                  title: "Eliminar marca",
                                  description: `Se eliminara la marca ${brand.name} y sus modelos asociados.`,
                                  onConfirm: () => data.deleteBrand(brand.id),
                                })}
                                close={() => setBrandActionsOpenId(null)}
                                className="text-red-600 hover:bg-red-50"
                              />
                            ) : null}
                          </div>
                        ) : null}

                        <div className="hidden justify-end gap-2 sm:flex">
                          <Button variant="ghost" size="icon" onClick={() => setBrandDialog({ open: true, item: brand, readonly: true })}>
                            <Eye className="size-4" />
                          </Button>
                          {canEditBrand ? (
                            <Button variant="ghost" size="icon" onClick={() => setBrandDialog({ open: true, item: brand, readonly: false })}>
                              <Edit3 className="size-4" />
                            </Button>
                          ) : null}
                          {canDeleteBrand ? (
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => askDelete({
                                title: "Eliminar marca",
                                description: `Se eliminara la marca ${brand.name} y sus modelos asociados.`,
                                onConfirm: () => data.deleteBrand(brand.id),
                              })}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                          {canCreateModel ? (
                            <Button onClick={() => setModelDialog({ open: true, item: null, brand, readonly: false })} className="bg-violet-700 text-white hover:bg-violet-800">
                              <Plus className="size-4" />
                              Modelo
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {expandedId === brand.id ? (
                      <tr>
                        <td colSpan={5} className="bg-slate-50 px-4 py-3">
                          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-violet-700">
                            <Layers className="size-4" />
                            Modelos de {brand.name}
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs">{brand.models.length}</span>
                          </div>
                          <ModelsTable
                            models={brand.models}
                            onEdit={(model) => setModelDialog({ open: true, item: model, brand, readonly: false })}
                            onView={(model) => setModelDialog({ open: true, item: model, brand, readonly: true })}
                            onDelete={(model) => askDelete({
                              title: "Eliminar modelo",
                              description: `Se eliminara el modelo ${model.name}.`,
                              onConfirm: () => data.deleteModel(model.id),
                            })}
                            canEdit={canEditModel}
                            canDelete={canDeleteModel}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">No hay marcas registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          <span className="font-medium">Pagina 1 de 1</span>
          <span className="text-center font-medium">{filteredBrands.length} de {data.brands.length} registros</span>
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

      {brandDialog.open ? (
        <BrandDialog
          key={`${brandDialog.item?.id || "new"}-${brandDialog.readonly}`}
          state={brandDialog}
          onClose={() => setBrandDialog({ open: false, item: null, readonly: false })}
          onSubmit={async (payload) => {
            if (brandDialog.item) await data.updateBrand(brandDialog.item.id, payload);
            else await data.createBrand(payload);
            setBrandDialog({ open: false, item: null, readonly: false });
          }}
        />
      ) : null}
      {modelDialog.open ? (
        <ModelDialog
          key={`${modelDialog.item?.id || "new"}-${modelDialog.brand?.id || "none"}-${modelDialog.readonly}`}
          state={modelDialog}
          brands={data.brands}
          classes={data.classes}
          onClose={() => setModelDialog({ open: false, item: null, brand: null, readonly: false })}
          onSubmit={async (payload) => {
            if (modelDialog.item) await data.updateModel(modelDialog.item.id, payload);
            else await data.createModel(payload);
            setModelDialog({ open: false, item: null, brand: null, readonly: false });
          }}
        />
      ) : null}
      <ConfirmDeleteDialog state={deleteDialog} onClose={() => setDeleteDialog({ open: false, title: "", description: "", onConfirm: null })} />
      <ClassesSheet open={classesOpen} onOpenChange={setClassesOpen} data={data} userPermissions={userPermissions} askDelete={askDelete} />
      <MaintenanceSheet open={maintenanceOpen} onOpenChange={setMaintenanceOpen} data={data} userPermissions={userPermissions} askDelete={askDelete} />
    </div>
  );
}

function PageHeader() {
  return (
    <div className="mb-3 shrink-0 border-b border-slate-200 pb-3">
      <div className="flex items-center gap-3">
        <IconBox icon={Car} />
        <div>
          <h1 className="text-base font-bold leading-tight text-violet-700">Marcas & Modelos</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">Gestiona marcas, modelos y clases</p>
        </div>
      </div>
    </div>
  );
}

function IconBox({ icon: Icon }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
      <Icon className="size-5" />
    </div>
  );
}

function Stat({ label, shortLabel, value, tone, icon: Icon }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div className={`flex items-center justify-between rounded-lg border px-2 py-2 sm:px-3 ${tones[tone]}`}>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold leading-4 sm:text-[11px]">
          <span className="sm:hidden">{shortLabel || label}</span>
          <span className="hidden sm:inline">{label}</span>
        </p>
        <p className="mt-0.5 text-xl font-bold leading-6 text-slate-950">{value}</p>
      </div>
      <Icon className="hidden size-5 shrink-0 opacity-50 sm:block" />
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
      className={[
        "flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50",
        className,
      ].join(" ")}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {label}
    </button>
  );
}

function ModelsTable({ models, onView, onEdit, onDelete, canEdit, canDelete }) {
  const [openActionId, setOpenActionId] = useState(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm sm:min-w-[520px]">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">Modelo</th>
            <th className="hidden px-3 py-2 text-left sm:table-cell">Clase</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {models.length ? (
            models.map((model) => {
              const actionsOpen = openActionId === model.id;

              return (
              <tr key={model.id}>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-950">{model.name}</div>
                  <div className="mt-1 text-xs text-slate-500 sm:hidden">{model.claseName || "Sin clase"}</div>
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  {model.claseName ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full bg-violet-500" />
                      {model.claseName}
                    </span>
                  ) : (
                    "Sin clase"
                  )}
                </td>
                <td className="relative px-3 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenActionId(actionsOpen ? null : model.id)}
                    className="ml-auto flex h-8 gap-1 px-2 sm:hidden"
                  >
                    Acciones
                    <ChevronDown className={`size-4 transition ${actionsOpen ? "rotate-180" : ""}`} />
                  </Button>

                  {actionsOpen ? (
                    <div className="absolute right-3 top-11 z-20 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg sm:hidden">
                      <MobileMenuItem icon={Eye} label="Ver modelo" onClick={() => onView(model)} close={() => setOpenActionId(null)} />
                      {canEdit ? (
                        <MobileMenuItem icon={Edit3} label="Editar modelo" onClick={() => onEdit(model)} close={() => setOpenActionId(null)} />
                      ) : null}
                      {canDelete ? (
                        <MobileMenuItem icon={Trash2} label="Eliminar modelo" onClick={() => onDelete(model)} close={() => setOpenActionId(null)} className="text-red-600 hover:bg-red-50" />
                      ) : null}
                    </div>
                  ) : null}

                  <div className="hidden justify-end gap-2 sm:flex">
                    <Button variant="ghost" size="icon" onClick={() => onView(model)}>
                      <Eye className="size-4" />
                    </Button>
                    {canEdit ? (
                      <Button variant="ghost" size="icon" onClick={() => onEdit(model)}>
                        <Edit3 className="size-4" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button variant="destructive" size="icon" onClick={() => onDelete(model)}>
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={3} className="px-3 py-8 text-center text-slate-500">Esta marca no tiene modelos.</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">Total: {models.length} modelo(s)</div>
    </div>
  );
}

function BrandDialog({ state, onClose, onSubmit }) {
  const [form, setForm] = useState(state.item ? { name: state.item.name || "", imageUrl: state.item.imageUrl || "" } : emptyBrand);
  const [saving, setSaving] = useState(false);
  const readonly = state.readonly;

  async function submit(event) {
    event.preventDefault();
    if (readonly) return onClose();
    setSaving(true);
    await onSubmit({ name: form.name.trim(), imageUrl: form.imageUrl.trim() });
    setSaving(false);
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-white text-slate-950">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-violet-700">{readonly ? "Detalle de marca" : state.item ? "Editar marca" : "Nueva marca"}</DialogTitle>
            <DialogDescription>Completa los datos de la marca.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Nombre">
              <Input value={form.name} disabled={readonly} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </Field>
            <Field label="URL de logo">
              <Input value={form.imageUrl} disabled={readonly} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            {!readonly ? <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">{saving ? "Guardando..." : "Guardar"}</Button> : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModelDialog({ state, brands, classes, onClose, onSubmit }) {
  const [form, setForm] = useState(state.item ? {
    marcaId: state.item.marcaId || "",
    claseId: state.item.claseId || "",
    name: state.item.name || "",
    anios: Array.isArray(state.item.anios) ? state.item.anios.join(", ") : "",
  } : { ...emptyModel, marcaId: state.brand?.id || "" });
  const [saving, setSaving] = useState(false);
  const readonly = state.readonly;
  const brandOptions = brands.map((item) => ({ value: item.id, label: item.name }));
  const classOptions = classes.map((item) => ({ value: item.id, label: item.name }));

  async function submit(event) {
    event.preventDefault();
    if (readonly) return onClose();
    setSaving(true);
    await onSubmit({
      marcaId: Number(form.marcaId),
      claseId: form.claseId ? Number(form.claseId) : null,
      name: form.name.trim(),
      anios: parseList(form.anios),
    });
    setSaving(false);
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-white text-slate-950">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-violet-700">{readonly ? "Detalle de modelo" : state.item ? "Editar modelo" : "Nuevo modelo"}</DialogTitle>
            <DialogDescription>Asocia el modelo a una marca y clase.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Marca">
              <SearchableSelect value={String(form.marcaId)} options={brandOptions} disabled={readonly} placeholder="Seleccionar marca" onChange={(value) => setForm((current) => ({ ...current, marcaId: value }))} />
            </Field>
            <Field label="Nombre del modelo">
              <Input value={form.name} disabled={readonly} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </Field>
            <Field label="Clase">
              <SearchableSelect value={String(form.claseId)} options={classOptions} disabled={readonly} placeholder="Seleccionar clase" onChange={(value) => setForm((current) => ({ ...current, claseId: value }))} />
            </Field>
            <Field label="Años">
              <Input value={form.anios} disabled={readonly} placeholder="Ej: 2022, 2023, 2024" onChange={(event) => setForm((current) => ({ ...current, anios: event.target.value }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            {!readonly ? <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">{saving ? "Guardando..." : "Guardar"}</Button> : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClassesSheet({ open, onOpenChange, data, userPermissions, askDelete }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const canCreate = can(userPermissions, "clases", "create");
  const canEdit = can(userPermissions, "clases", "edit");
  const canDelete = can(userPermissions, "clases", "delete");

  async function save() {
    if (!name.trim()) return;
    if (editing) await data.updateClass(editing.id, { name: name.trim() });
    else await data.createClass({ name: name.trim() });
    setEditing(null);
    setName("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[94vw] bg-white text-slate-950 sm:max-w-[390px]">
        <SheetHeader className="border-b border-slate-200 p-4">
          <SheetTitle className="flex items-center gap-2 text-lg font-bold text-slate-950">
            <Layers className="size-5 text-violet-700" />
            Clases de Vehiculos
          </SheetTitle>
          <p className="text-xs font-medium text-slate-500">Gestiona las clases de vehiculos</p>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex gap-2">
            <Button variant="outline" onClick={data.reload}>
              <RefreshCw className="size-4" />
              Recargar
            </Button>
            {canCreate ? (
              <Button onClick={() => { setEditing(null); setName(""); }} className="ml-auto bg-violet-700 text-white hover:bg-violet-800">
                <Plus className="size-4" />
                Nueva clase
              </Button>
            ) : null}
          </div>
          {(canCreate || editing) ? (
            <div className="mb-3 flex gap-2 rounded-lg border border-slate-200 p-2">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre de clase" />
              <Button onClick={save} disabled={!name.trim()}>{editing ? "Actualizar" : "Guardar"}</Button>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Nombre de Clase</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.classes.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        {canEdit ? (
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(item); setName(item.name); }}>
                            <Edit3 className="size-4" />
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => askDelete({
                              title: "Eliminar clase",
                              description: `Se eliminara la clase ${item.name}.`,
                              onConfirm: () => data.deleteClass(item.id),
                            })}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">Total: {data.classes.length} clase(s)</div>
        </div>
        <SheetFooter className="border-t border-slate-200 p-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function MaintenanceSheet({ open, onOpenChange, data, userPermissions, askDelete }) {
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [openActionId, setOpenActionId] = useState(null);
  const canCreate = can(userPermissions, "algoritmo_visita", "create");
  const canEdit = can(userPermissions, "algoritmo_visita", "edit");
  const canDelete = can(userPermissions, "algoritmo_visita", "delete");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[96vw] bg-white text-slate-950 sm:max-w-[430px]">
        <SheetHeader className="border-b border-slate-200 p-4">
          <SheetTitle className="flex items-center gap-2 text-lg font-bold text-slate-950">
            <Wrench className="size-5 text-violet-700" />
            Tiempo de Mantenimiento
          </SheetTitle>
          <p className="text-xs font-medium text-slate-500">Configura los intervalos de mantenimiento por modelo</p>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex gap-2">
            <Button variant="outline" onClick={data.reload}>
              <RefreshCw className="size-4" />
              Recargar
            </Button>
            {canCreate ? (
              <Button onClick={() => setDialog({ open: true, item: null })} className="ml-auto bg-violet-700 text-white hover:bg-violet-800">
                <Plus className="size-4" />
                Nuevo registro
              </Button>
            ) : null}
          </div>
          <div className="max-h-[58svh] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm sm:min-w-[520px]">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Marca / Modelo</th>
                  <th className="px-3 py-2 text-left">Km / Tiempo</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.maintenance.map((item) => {
                  const actionsOpen = openActionId === item.id;

                  return (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-950">{item.marcaName || "-"}</div>
                      <div className="text-xs font-medium text-slate-500">{item.modeloName || "-"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">{item.kilometraje} km</span>
                        <span className="rounded bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700">{item.meses} m</span>
                      </div>
                    </td>
                    <td className="relative px-3 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenActionId(actionsOpen ? null : item.id)}
                        className="ml-auto flex h-8 gap-1 px-2 sm:hidden"
                      >
                        Acciones
                        <ChevronDown className={`size-4 transition ${actionsOpen ? "rotate-180" : ""}`} />
                      </Button>

                      {actionsOpen ? (
                        <div className="absolute right-3 top-11 z-20 w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg sm:hidden">
                          {canEdit ? (
                            <MobileMenuItem
                              icon={Edit3}
                              label="Editar"
                              onClick={() => setDialog({ open: true, item })}
                              close={() => setOpenActionId(null)}
                            />
                          ) : null}
                          {canDelete ? (
                            <MobileMenuItem
                              icon={Trash2}
                              label="Eliminar"
                              onClick={() => askDelete({
                                title: "Eliminar algoritmo",
                                description: `Se eliminara el algoritmo de ${item.modeloName}.`,
                                onConfirm: () => data.deleteMaintenance(item.id),
                              })}
                              close={() => setOpenActionId(null)}
                              className="text-red-600 hover:bg-red-50"
                            />
                          ) : null}
                        </div>
                      ) : null}

                      <div className="hidden justify-end gap-2 sm:flex">
                        {canEdit ? (
                          <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, item })}>
                            <Edit3 className="size-4" />
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => askDelete({
                              title: "Eliminar algoritmo",
                              description: `Se eliminara el algoritmo de ${item.modeloName}.`,
                              onConfirm: () => data.deleteMaintenance(item.id),
                            })}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span>Total: {data.maintenance.length} registro(s)</span>
            <span>Modelos configurados</span>
          </div>
        </div>
        <SheetFooter className="border-t border-slate-200 p-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </SheetFooter>
        {dialog.open ? (
          <MaintenanceDialog
            key={dialog.item?.id || "new"}
            state={dialog}
            data={data}
            onClose={() => setDialog({ open: false, item: null })}
            onSubmit={async (payload) => {
              if (dialog.item) await data.updateMaintenance(dialog.item.id, payload);
              else await data.createMaintenance(payload);
              setDialog({ open: false, item: null });
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function MaintenanceDialog({ state, data, onClose, onSubmit }) {
  const [form, setForm] = useState(state.item ? {
    marcaId: state.item.marcaId || "",
    modeloId: state.item.modeloId || "",
    kilometraje: state.item.kilometraje || "",
    meses: state.item.meses || "",
    anios: "",
  } : emptyMaintenance);
  const [allYears, setAllYears] = useState(Array.isArray(state.item?.anios) && state.item.anios.includes("000-999"));
  const [ranges, setRanges] = useState(() => parseYearRanges(state.item?.anios));
  const [saving, setSaving] = useState(false);
  const [rangeDeleteDialog, setRangeDeleteDialog] = useState({ open: false, range: null, index: 0 });
  const brandOptions = data.brands.map((item) => ({ value: item.id, label: item.name }));
  const modelOptions = data.models
    .filter((model) => !form.marcaId || Number(model.marcaId) === Number(form.marcaId))
    .map((item) => ({ value: item.id, label: item.name }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    await onSubmit({
      marcaId: Number(form.marcaId),
      modeloId: Number(form.modeloId),
      kilometraje: Number(form.kilometraje),
      meses: Number(form.meses),
      anios: allYears ? ["000-999"] : rangesToJson(ranges),
    });
    setSaving(false);
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-lg overflow-y-auto bg-white text-slate-950">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700">
              <Calendar className="size-5" />
              {state.item ? "Editar Algoritmo de Visita" : "Nuevo Algoritmo de Visita"}
            </DialogTitle>
            <DialogDescription>Configura el intervalo de mantenimiento por modelo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
              <p className="mb-3 text-sm font-bold text-violet-700">1. Vehiculo</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Marca">
                  <SearchableSelect value={String(form.marcaId)} options={brandOptions} placeholder="Seleccionar marca" onChange={(value) => setForm((current) => ({ ...current, marcaId: value, modeloId: "" }))} />
                </Field>
                <Field label="Modelo">
                  <SearchableSelect value={String(form.modeloId)} options={modelOptions} placeholder="Seleccionar modelo" onChange={(value) => setForm((current) => ({ ...current, modeloId: value }))} />
                </Field>
              </div>
            </div>
            <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
              <p className="mb-3 text-sm font-bold text-violet-700">2. Intervalo de Mantenimiento</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Kilometraje">
                  <Input value={form.kilometraje} placeholder="Ej: 10000" onChange={(event) => setForm((current) => ({ ...current, kilometraje: event.target.value }))} required />
                </Field>
                <Field label="Meses">
                  <Input value={form.meses} placeholder="Ej: 12" onChange={(event) => setForm((current) => ({ ...current, meses: event.target.value }))} required />
                </Field>
              </div>
            </div>
            <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
              <p className="mb-3 text-sm font-bold text-violet-700">3. Rango de Años</p>
              <label className="mb-3 flex items-center gap-3 rounded-lg border border-violet-200 bg-white/70 p-3">
                <Switch checked={allYears} onCheckedChange={(checked) => setAllYears(Boolean(checked))} />
                <span>
                  <span className="block text-xs font-bold text-violet-700">Aplica a todos los años</span>
                  <span className="block text-[11px] font-medium text-slate-500">Si esta activado, ignora los rangos especificos</span>
                </span>
              </label>
              <p className="mb-3 text-xs font-medium text-slate-500">Define los rangos de años para aplicar este algoritmo:</p>
              <div className="space-y-3">
                {ranges.map((range, index) => (
                  <YearRangeCard
                    key={range.id}
                    range={range}
                    index={index}
                    disabled={allYears}
                    canRemove={ranges.length > 1}
                    onChange={(field, value) => {
                      setRanges((current) => current.map((item) => (
                        item.id === range.id ? { ...item, [field]: value } : item
                      )));
                    }}
                    onAdd={() => setRanges((current) => [...current, createYearRange()])}
                    onRemove={() => setRangeDeleteDialog({ open: true, range, index })}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">
              {saving ? "Guardando..." : "Guardar Algoritmo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <ConfirmDeleteDialog
        state={{
          open: rangeDeleteDialog.open,
          title: "Eliminar rango",
          description: `Se eliminara el rango ${rangeDeleteDialog.index + 1}.`,
          onConfirm: () => {
            if (!rangeDeleteDialog.range) return;
            setRanges((current) => current.filter((item) => item.id !== rangeDeleteDialog.range.id));
          },
        }}
        onClose={() => setRangeDeleteDialog({ open: false, range: null, index: 0 })}
      />
    </Dialog>
  );
}

function YearRangeCard({ range, index, disabled, canRemove, onChange, onAdd, onRemove }) {
  return (
    <div className="rounded-lg border border-violet-300 bg-white/70 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-violet-700 text-xs font-bold text-white">{index + 1}</span>
        <span className="text-sm font-bold text-violet-700">Rango {index + 1}</span>
      </div>
      <div className="grid grid-cols-[1fr_64px_1fr_64px_1fr] gap-2">
        <CompactField label="Desde">
          <Input
            value={range.from}
            disabled={disabled}
            maxLength={4}
            placeholder="000"
            onChange={(event) => onChange("from", onlyDigits(event.target.value))}
            className="h-8 bg-white text-center"
          />
        </CompactField>
        <CompactField label="Op">
          <SearchableSelect
            value={range.fromOp}
            disabled={disabled}
            options={operatorOptions}
            placeholder="≤"
            onChange={(value) => onChange("fromOp", value)}
          />
        </CompactField>
        <CompactField label="Año">
          <Input disabled value="Anio" className="h-8 bg-white text-center text-slate-500" />
        </CompactField>
        <CompactField label="Op">
          <SearchableSelect
            value={range.toOp}
            disabled={disabled}
            options={operatorOptions}
            placeholder="≤"
            onChange={(value) => onChange("toOp", value)}
          />
        </CompactField>
        <CompactField label="Hasta">
          <Input
            value={range.to}
            disabled={disabled}
            maxLength={4}
            placeholder="999"
            onChange={(event) => onChange("to", onlyDigits(event.target.value))}
            className="h-8 bg-white text-center"
          />
        </CompactField>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="outline" size="icon" disabled={disabled || !canRemove} onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
        <Button type="button" size="icon" disabled={disabled} onClick={onAdd} className="bg-violet-700 text-white hover:bg-violet-800">
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function CompactField({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium text-slate-500">{label}</Label>
      {children}
    </div>
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
          <Button type="button" variant="destructive" onClick={confirm} disabled={saving}>
            {saving ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

function parseList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createYearRange(value = "") {
  const [from = "", to = ""] = String(value).split("-");
  return {
    id: `${Date.now()}-${Math.random()}`,
    from,
    fromOp: "<=",
    toOp: "<=",
    to,
  };
}

function parseYearRanges(values) {
  if (!Array.isArray(values) || !values.length) {
    return [createYearRange(), createYearRange()];
  }

  const ranges = values
    .filter((value) => value !== "000-999")
    .map((value) => createYearRange(value));

  return ranges.length ? ranges : [createYearRange(), createYearRange()];
}

function rangesToJson(ranges) {
  return ranges
    .map((range) => {
      const from = range.from.trim();
      const to = range.to.trim();
      if (!from || !to) return null;
      return `${from}-${to}`;
    })
    .filter(Boolean);
}

function onlyDigits(value) {
  return value.replace(/\D/g, "").slice(0, 4);
}
