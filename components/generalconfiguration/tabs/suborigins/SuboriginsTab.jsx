"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Edit3, GitBranch, Loader2, Plus, RefreshCw, Trash2, Zap } from "lucide-react";

import { AppointmentSuboriginDialog } from "@/components/generalconfiguration/dialogs/AppointmentSuboriginDialog";
import { DeleteAppointmentSuboriginDialog } from "@/components/generalconfiguration/dialogs/DeleteAppointmentSuboriginDialog";
import { canUseAction } from "@/components/generalconfiguration/permissionUtils";
import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { useAppointmentOrigins } from "@/hooks/generalconfiguration/useAppointmentOrigins";
import { useAppointmentSuborigins } from "@/hooks/generalconfiguration/useAppointmentSuborigins";
import { cn } from "@/lib/utils";

function StatCard({ label, value, tone, icon: Icon }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
  };

  return (
    <div className={cn("flex min-h-16 items-center justify-between rounded-lg border p-2 sm:min-h-24 sm:p-4", tones[tone])}>
      <div>
        <p className="truncate text-[10px] font-semibold sm:text-xs">{label}</p>
        <p className="mt-1 text-lg font-bold text-slate-950 sm:mt-3 sm:text-2xl">{value}</p>
      </div>
      <Icon className="hidden size-9 opacity-25 sm:block" />
    </div>
  );
}

export function SuboriginsTab({ tab, userPermissions }) {
  const { origenes, loading: loadingOrigenes } = useAppointmentOrigins();
  const [selectedOrigenId, setSelectedOrigenId] = useState("");
  const {
    suborigenes,
    loading,
    error,
    stats,
    createSuborigen,
    updateSuborigen,
    deleteSuborigen,
    reload,
  } = useAppointmentSuborigins(selectedOrigenId);
  const [dialogMode, setDialogMode] = useState(null);
  const [selectedSuborigen, setSelectedSuborigen] = useState(null);
  const canCreate = canUseAction(userPermissions, tab, "create");
  const canEdit = canUseAction(userPermissions, tab, "edit");
  const canDelete = canUseAction(userPermissions, tab, "delete");
  const origenOptions = useMemo(
    () => [
      { value: "", label: "Todos los origenes" },
      ...origenes.map((origen) => ({ value: origen.id, label: origen.name })),
    ],
    [origenes]
  );

  function openCreate() {
    setSelectedSuborigen(null);
    setDialogMode("create");
  }

  function openEdit(suborigen) {
    setSelectedSuborigen(suborigen);
    setDialogMode("edit");
  }

  function openDelete(suborigen) {
    setSelectedSuborigen(suborigen);
    setDialogMode("delete");
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
              <GitBranch className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold leading-tight text-slate-950 sm:text-xl">Suborigenes de Citas</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Gestiona las subcategorias de origenes de citas
              </p>
            </div>
          </div>
        </div>

        <div className="mx-4 border-t border-slate-200" />

        <div className="grid grid-cols-3 gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4">
          <StatCard label="Total Suborigenes" value={stats.total} tone="blue" icon={GitBranch} />
          <StatCard label="Activos" value={stats.activos} tone="green" icon={CheckCircle2} />
          <StatCard label="Inactivos" value={stats.inactivos} tone="orange" icon={Zap} />
        </div>

        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-blue-500 bg-white">
            <div className="flex flex-col gap-3 bg-blue-50 px-3 py-3 lg:flex-row lg:items-end lg:justify-between lg:px-4">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
                    <GitBranch className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-950">Lista de Suborigenes</h3>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Filtra y gestiona los suborigenes
                    </p>
                  </div>
                </div>

                <div className="mt-3 w-full max-w-none sm:max-w-xs">
                  <SearchableSelect
                    value={selectedOrigenId}
                    options={origenOptions}
                    placeholder="Todos los origenes"
                    searchPlaceholder="Buscar origen..."
                    emptyText="Sin origenes"
                    disabled={loadingOrigenes}
                    onChange={setSelectedOrigenId}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Button variant="outline" className="w-full sm:w-auto" onClick={reload} disabled={loading}>
                  <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                  Recargar
                </Button>
                {canCreate ? (
                  <Button onClick={openCreate} className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">
                    <Plus className="size-4" />
                    Nuevo
                  </Button>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-2 p-2 sm:p-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando suborigenes...
                </div>
              ) : suborigenes.length ? (
                suborigenes.map((suborigen) => (
                  <div
                    key={suborigen.id}
                    className="flex min-h-14 items-center justify-between gap-2 rounded-lg border border-blue-200 bg-white px-2.5 py-2.5 sm:gap-3 sm:px-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="size-2 shrink-0 rounded-full bg-blue-500" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950">{suborigen.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            {suborigen.origenName || `Origen ${suborigen.origenId}`}
                          </span>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              suborigen.isActive
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-orange-200 bg-orange-50 text-orange-700"
                            )}
                          >
                            {suborigen.isActive ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {canEdit ? (
                        <Button variant="outline" size="icon" onClick={() => openEdit(suborigen)} title="Editar suborigen">
                          <Edit3 className="size-4 text-orange-600" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button variant="outline" size="icon" onClick={() => openDelete(suborigen)} title="Eliminar suborigen">
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-sm font-medium text-slate-500">
                  No hay suborigenes registrados.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <AppointmentSuboriginDialog
        open={dialogMode === "create" || dialogMode === "edit"}
        mode={dialogMode}
        suborigen={selectedSuborigen}
        origenes={origenes}
        defaultOrigenId={selectedOrigenId}
        onClose={() => setDialogMode(null)}
        onSubmit={(payload) =>
          dialogMode === "edit"
            ? updateSuborigen(selectedSuborigen.id, payload)
            : createSuborigen(payload)
        }
      />

      <DeleteAppointmentSuboriginDialog
        open={dialogMode === "delete"}
        suborigen={selectedSuborigen}
        onClose={() => setDialogMode(null)}
        onConfirm={() => deleteSuborigen(selectedSuborigen.id)}
      />
    </>
  );
}
