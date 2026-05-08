"use client";

import { Check, Edit3, Loader2, MapPin, Plus, RefreshCw, Trash2 } from "lucide-react";

import { AppointmentOriginDialog } from "@/components/generalconfiguration/dialogs/AppointmentOriginDialog";
import { DeleteAppointmentOriginDialog } from "@/components/generalconfiguration/dialogs/DeleteAppointmentOriginDialog";
import { canUseAction } from "@/components/generalconfiguration/permissionUtils";
import { Button } from "@/components/ui/button";
import { useAppointmentOrigins } from "@/hooks/generalconfiguration/useAppointmentOrigins";
import { cn } from "@/lib/utils";
import { useState } from "react";

function StatCard({ label, value, tone, icon: Icon }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
  };

  return (
    <div className={cn("flex min-h-24 items-center justify-between rounded-lg border p-4", tones[tone])}>
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      </div>
      <Icon className="size-9 opacity-25" />
    </div>
  );
}

export function OriginsTab({ tab, userPermissions }) {
  const {
    origenes,
    loading,
    error,
    stats,
    createOrigen,
    updateOrigen,
    deleteOrigen,
    reload,
  } = useAppointmentOrigins();
  const [dialogMode, setDialogMode] = useState(null);
  const [selectedOrigen, setSelectedOrigen] = useState(null);
  const canCreate = canUseAction(userPermissions, tab, "create");
  const canEdit = canUseAction(userPermissions, tab, "edit");
  const canDelete = canUseAction(userPermissions, tab, "delete");

  function openCreate() {
    setSelectedOrigen(null);
    setDialogMode("create");
  }

  function openEdit(origen) {
    setSelectedOrigen(origen);
    setDialogMode("edit");
  }

  function openDelete(origen) {
    setSelectedOrigen(origen);
    setDialogMode("delete");
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid gap-3 px-4 py-4 lg:grid-cols-2">
          <StatCard label="Total de Origenes" value={stats.total} tone="blue" icon={Check} />
          <StatCard label="Activos" value={stats.activos} tone="purple" icon={MapPin} />
        </div>

        <div className="px-4 pb-4">
          <div className="overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-blue-500 bg-white">
            <div className="flex flex-col gap-3 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
                  <MapPin className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-950">Origenes de Citas</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Gestiona los origenes o fuentes de las citas
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={reload} disabled={loading}>
                  <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                  {origenes.length} origenes
                </Button>
                {canCreate ? (
                  <Button onClick={openCreate} className="bg-blue-600 text-white hover:bg-blue-700">
                    <Plus className="size-4" />
                    Nuevo Origen
                  </Button>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-2 p-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando origenes...
                </div>
              ) : origenes.length ? (
                origenes.map((origen) => (
                  <div
                    key={origen.id}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-blue-200 bg-white px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="size-2 shrink-0 rounded-full bg-blue-500" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950">{origen.name}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                          ID: {origen.id} · {origen.isActive ? "Activo" : "Inactivo"}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {canEdit ? (
                        <Button variant="outline" size="icon" onClick={() => openEdit(origen)} title="Editar origen">
                          <Edit3 className="size-4 text-orange-600" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button variant="outline" size="icon" onClick={() => openDelete(origen)} title="Eliminar origen">
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-sm font-medium text-slate-500">
                  No hay origenes registrados.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <AppointmentOriginDialog
        open={dialogMode === "create" || dialogMode === "edit"}
        mode={dialogMode}
        origen={selectedOrigen}
        onClose={() => setDialogMode(null)}
        onSubmit={(payload) =>
          dialogMode === "edit"
            ? updateOrigen(selectedOrigen.id, payload)
            : createOrigen(payload)
        }
      />

      <DeleteAppointmentOriginDialog
        open={dialogMode === "delete"}
        origen={selectedOrigen}
        onClose={() => setDialogMode(null)}
        onConfirm={() => deleteOrigen(selectedOrigen.id)}
      />
    </>
  );
}
