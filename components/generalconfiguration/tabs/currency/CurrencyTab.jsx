"use client";

import { CircleDollarSign, Edit3, Globe2, Loader2, Percent, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

import { CurrencyDialog } from "@/components/generalconfiguration/dialogs/CurrencyDialog";
import { DeleteCurrencyDialog } from "@/components/generalconfiguration/dialogs/DeleteCurrencyDialog";
import { DeleteTaxDialog } from "@/components/generalconfiguration/dialogs/DeleteTaxDialog";
import { canUseAction } from "@/components/generalconfiguration/permissionUtils";
import { TaxDialog } from "@/components/generalconfiguration/dialogs/TaxDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrencies } from "@/hooks/generalconfiguration/useCurrencies";
import { useTaxes } from "@/hooks/generalconfiguration/useTaxes";
import { cn } from "@/lib/utils";

export function CurrencyTab({ tab, userPermissions }) {
  const {
    monedas,
    loading,
    error,
    stats,
    createMoneda,
    updateMoneda,
    deleteMoneda,
    reload,
  } = useCurrencies();
  const {
    impuestos,
    loading: loadingTaxes,
    error: taxesError,
    stats: taxesStats,
    createImpuesto,
    updateImpuesto,
    deleteImpuesto,
    reload: reloadTaxes,
  } = useTaxes();
  const [dialogMode, setDialogMode] = useState(null);
  const [selectedMoneda, setSelectedMoneda] = useState(null);
  const [taxDialogMode, setTaxDialogMode] = useState(null);
  const [selectedImpuesto, setSelectedImpuesto] = useState(null);
  const canCreate = canUseAction(userPermissions, tab, "create");
  const canEdit = canUseAction(userPermissions, tab, "edit");
  const canDelete = canUseAction(userPermissions, tab, "delete");
  const canCreateTax = canUseAction(userPermissions, tab, "createImpuesto");
  const canEditTax = canUseAction(userPermissions, tab, "editImpuesto");
  const canDeleteTax = canUseAction(userPermissions, tab, "deleteImpuesto");

  function openCreate() {
    setSelectedMoneda(null);
    setDialogMode("create");
  }

  function openEdit(moneda) {
    setSelectedMoneda(moneda);
    setDialogMode("edit");
  }

  function openDelete(moneda) {
    setSelectedMoneda(moneda);
    setDialogMode("delete");
  }

  async function toggleActive(moneda) {
    await updateMoneda(moneda.id, {
      codigo: moneda.codigo,
      nombre: moneda.nombre,
      simbolo: moneda.simbolo,
      isActive: !moneda.isActive,
    });
  }

  async function toggleTaxActive(impuesto) {
    await updateImpuesto(impuesto.id, {
      nombre: impuesto.nombre,
      porcentaje: impuesto.porcentaje,
      isActive: !impuesto.isActive,
    });
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
              <CircleDollarSign className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold leading-tight text-slate-950 sm:text-xl">Monedas e Impuestos</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Configura las monedas y tasas de impuesto para tus operaciones
              </p>
            </div>
          </div>
        </div>

        <div className="mx-4 border-t border-slate-200" />

        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <div className="overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-blue-500 bg-white">
            <div className="flex flex-col gap-3 bg-blue-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
                  <Globe2 className="size-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-950">Monedas</h3>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Gestiona las monedas disponibles en el sistema
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Button variant="outline" className="w-full sm:w-auto" onClick={reload} disabled={loading}>
                  <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                  {stats.total} total
                </Button>
                <span className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 sm:h-auto sm:rounded-full sm:px-3 sm:py-1">
                  {stats.activos} activas
                </span>
                {canCreate ? (
                  <Button onClick={openCreate} className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">
                    <Plus className="size-4" />
                    Nueva Moneda
                  </Button>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <div className="p-2 sm:p-4">
              <div className="hidden overflow-x-auto rounded-lg border border-slate-200 sm:block">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5">ID</th>
                      <th className="px-3 py-2.5">Codigo</th>
                      <th className="px-3 py-2.5">Nombre</th>
                      <th className="px-3 py-2.5">Simbolo</th>
                      <th className="px-3 py-2.5">Activo</th>
                      <th className="px-3 py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            Cargando monedas...
                          </span>
                        </td>
                      </tr>
                    ) : monedas.length ? (
                      monedas.map((moneda) => (
                        <tr key={moneda.id} className="text-slate-800">
                          <td className="px-3 py-2.5">
                            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-semibold">
                              {moneda.id}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-bold">{moneda.codigo}</td>
                          <td className="px-3 py-2.5 font-medium">{moneda.nombre}</td>
                          <td className="px-3 py-2.5 font-bold text-slate-950">{moneda.simbolo}</td>
                          <td className="px-3 py-2.5">
                            <Checkbox
                              checked={moneda.isActive}
                              disabled={!canEdit}
                              onCheckedChange={() => toggleActive(moneda)}
                              className="data-checked:border-blue-600 data-checked:bg-blue-600"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end gap-2">
                              {canEdit ? (
                                <Button variant="outline" size="icon" onClick={() => openEdit(moneda)} title="Editar moneda">
                                  <Edit3 className="size-4 text-orange-600" />
                                </Button>
                              ) : null}
                              {canDelete ? (
                                <Button variant="outline" size="icon" onClick={() => openDelete(moneda)} title="Eliminar moneda">
                                  <Trash2 className="size-4 text-red-600" />
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                          No hay monedas registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 sm:hidden">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                    <Loader2 className="size-4 animate-spin" />Cargando monedas...
                  </div>
                ) : monedas.length ? (
                  monedas.map((moneda) => (
                    <div key={moneda.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-950">{moneda.codigo} · {moneda.nombre}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">ID: {moneda.id} · Simbolo: {moneda.simbolo}</p>
                        </div>
                        <Checkbox checked={moneda.isActive} disabled={!canEdit} onCheckedChange={() => toggleActive(moneda)} className="data-checked:border-blue-600 data-checked:bg-blue-600" />
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        {canEdit ? <Button variant="outline" size="icon" onClick={() => openEdit(moneda)} title="Editar moneda"><Edit3 className="size-4 text-orange-600" /></Button> : null}
                        {canDelete ? <Button variant="outline" size="icon" onClick={() => openDelete(moneda)} title="Eliminar moneda"><Trash2 className="size-4 text-red-600" /></Button> : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500">No hay monedas registradas.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="overflow-hidden rounded-lg border border-purple-200 border-l-4 border-l-purple-500 bg-white">
            <div className="flex flex-col gap-3 bg-purple-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-purple-600 text-white">
                  <Percent className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950">Impuestos</h3>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Configura las tasas de impuesto aplicables
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Button variant="outline" className="w-full sm:w-auto" onClick={reloadTaxes} disabled={loadingTaxes}>
                  <RefreshCw className={cn("size-4", loadingTaxes && "animate-spin")} />
                  {taxesStats.total} total
                </Button>
                <span className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 sm:h-auto sm:rounded-full sm:px-3 sm:py-1">
                  {taxesStats.activos} activos
                </span>
                {canCreateTax ? (
                  <Button onClick={() => setTaxDialogMode("create")} className="w-full bg-purple-600 text-white hover:bg-purple-700 sm:w-auto">
                    <Plus className="size-4" />
                    Nuevo Impuesto
                  </Button>
                ) : null}
              </div>
            </div>

            {taxesError ? (
              <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {taxesError}
              </div>
            ) : null}

            <div className="p-2 sm:p-4">
              <div className="hidden overflow-x-auto rounded-lg border border-slate-200 sm:block">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5">ID</th>
                      <th className="px-3 py-2.5">Nombre</th>
                      <th className="px-3 py-2.5">Porcentaje</th>
                      <th className="px-3 py-2.5">Activo</th>
                      <th className="px-3 py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {loadingTaxes ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            Cargando impuestos...
                          </span>
                        </td>
                      </tr>
                    ) : impuestos.length ? (
                      impuestos.map((impuesto) => (
                        <tr key={impuesto.id} className="text-slate-800">
                          <td className="px-3 py-2.5">
                            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-semibold">
                              {impuesto.id}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-bold">{impuesto.nombre}</td>
                          <td className="px-3 py-2.5 font-bold text-slate-950">
                            {Number(impuesto.porcentaje).toFixed(2)}%
                          </td>
                          <td className="px-3 py-2.5">
                            <Checkbox
                              checked={impuesto.isActive}
                              disabled={!canEditTax}
                              onCheckedChange={() => toggleTaxActive(impuesto)}
                              className="data-checked:border-purple-600 data-checked:bg-purple-600"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end gap-2">
                              {canEditTax ? (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedImpuesto(impuesto);
                                    setTaxDialogMode("edit");
                                  }}
                                  title="Editar impuesto"
                                >
                                  <Edit3 className="size-4 text-orange-600" />
                                </Button>
                              ) : null}
                              {canDeleteTax ? (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedImpuesto(impuesto);
                                    setTaxDialogMode("delete");
                                  }}
                                  title="Eliminar impuesto"
                                >
                                  <Trash2 className="size-4 text-red-600" />
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                          No hay impuestos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 sm:hidden">
                {loadingTaxes ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                    <Loader2 className="size-4 animate-spin" />Cargando impuestos...
                  </div>
                ) : impuestos.length ? (
                  impuestos.map((impuesto) => (
                    <div key={impuesto.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-950">{impuesto.nombre}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">ID: {impuesto.id} · {Number(impuesto.porcentaje).toFixed(2)}%</p>
                        </div>
                        <Checkbox checked={impuesto.isActive} disabled={!canEditTax} onCheckedChange={() => toggleTaxActive(impuesto)} className="data-checked:border-purple-600 data-checked:bg-purple-600" />
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        {canEditTax ? <Button variant="outline" size="icon" onClick={() => { setSelectedImpuesto(impuesto); setTaxDialogMode("edit"); }} title="Editar impuesto"><Edit3 className="size-4 text-orange-600" /></Button> : null}
                        {canDeleteTax ? <Button variant="outline" size="icon" onClick={() => { setSelectedImpuesto(impuesto); setTaxDialogMode("delete"); }} title="Eliminar impuesto"><Trash2 className="size-4 text-red-600" /></Button> : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500">No hay impuestos registrados.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <CurrencyDialog
        open={dialogMode === "create" || dialogMode === "edit"}
        mode={dialogMode}
        moneda={selectedMoneda}
        onClose={() => setDialogMode(null)}
        onSubmit={(payload) =>
          dialogMode === "edit"
            ? updateMoneda(selectedMoneda.id, payload)
            : createMoneda(payload)
        }
      />

      <DeleteCurrencyDialog
        open={dialogMode === "delete"}
        moneda={selectedMoneda}
        onClose={() => setDialogMode(null)}
        onConfirm={() => deleteMoneda(selectedMoneda.id)}
      />

      <TaxDialog
        open={taxDialogMode === "create" || taxDialogMode === "edit"}
        mode={taxDialogMode}
        impuesto={selectedImpuesto}
        onClose={() => setTaxDialogMode(null)}
        onSubmit={(payload) =>
          taxDialogMode === "edit"
            ? updateImpuesto(selectedImpuesto.id, payload)
            : createImpuesto(payload)
        }
      />

      <DeleteTaxDialog
        open={taxDialogMode === "delete"}
        impuesto={selectedImpuesto}
        onClose={() => setTaxDialogMode(null)}
        onConfirm={() => deleteImpuesto(selectedImpuesto.id)}
      />
    </>
  );
}
