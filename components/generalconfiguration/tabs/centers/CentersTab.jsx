"use client";

import { useState } from "react";
import { Building2, Edit3, Loader2, MapPin, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CenterDialog } from "@/components/generalconfiguration/dialogs/CenterDialog";
import { DeleteDialog } from "@/components/generalconfiguration/dialogs/DeleteDialog";
import { canUseAction } from "@/components/generalconfiguration/permissionUtils";
import { useConfigurationCenters } from "@/hooks/generalconfiguration/useConfigurationCenters";
import { cn } from "@/lib/utils";

function formatDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function CenterStat({ label, value, tone, icon: Icon }) {
  const tones = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <div className={`flex min-h-24 items-center justify-between rounded-lg border p-4 ${tones[tone]}`}>
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      </div>
      <Icon className="size-9 opacity-25" />
    </div>
  );
}

export function CentersTab({ tab, userPermissions }) {
  const {
    centros,
    loading,
    error,
    stats,
    createCentro,
    updateCentro,
    deleteCentro,
    reload,
  } = useConfigurationCenters();
  const [dialogMode, setDialogMode] = useState(null);
  const [selectedCentro, setSelectedCentro] = useState(null);
  const canCreate = canUseAction(userPermissions, tab, "create");
  const canEdit = canUseAction(userPermissions, tab, "edit");
  const canDelete = canUseAction(userPermissions, tab, "delete");

  function openCreate() {
    setSelectedCentro(null);
    setDialogMode("create");
  }

  function openEdit(centro) {
    setSelectedCentro(centro);
    setDialogMode("edit");
  }

  function openDelete(centro) {
    setSelectedCentro(centro);
    setDialogMode("delete");
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white">
              <Building2 className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold leading-tight text-slate-950">Centros</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Gestiona los centros de atencion disponibles
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canCreate ? (
              <Button onClick={openCreate} className="bg-emerald-600 text-white hover:bg-emerald-700">
                <Plus className="size-4" />
                Nuevo Centro
              </Button>
            ) : null}
            <Button variant="outline" onClick={reload} disabled={loading}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              {centros.length} centros
            </Button>
          </div>
        </div>

        <div className="mx-4 border-t border-slate-200" />

        <div className="grid gap-3 px-4 py-4 lg:grid-cols-2">
          <CenterStat
            label="Total de Centros"
            value={stats.total}
            tone="green"
            icon={Building2}
          />
          <CenterStat
            label="Centros Activos"
            value={stats.activos}
            tone="blue"
            icon={MapPin}
          />
        </div>

        {error ? (
          <div className="mx-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="px-4 pb-4">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-950">Listado de Centros</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700">
                {centros.length} registros
              </span>
            </div>

            <div className="space-y-2 p-3">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando centros...
                </div>
              ) : centros.length ? (
                centros.map((centro) => (
                  <div
                    key={centro.id}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                        <Building2 className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950">{centro.nombre}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                          ID: {centro.id} · Creado: {formatDate(centro.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {canEdit ? (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openEdit(centro)}
                          title="Editar centro"
                        >
                          <Edit3 className="size-4 text-orange-600" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openDelete(centro)}
                          title="Eliminar centro"
                        >
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-sm font-medium text-slate-500">
                  No hay centros registrados.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <CenterDialog
        open={dialogMode === "create" || dialogMode === "edit"}
        mode={dialogMode}
        centro={selectedCentro}
        onClose={() => setDialogMode(null)}
        onSubmit={(payload) =>
          dialogMode === "edit"
            ? updateCentro(selectedCentro.id, payload)
            : createCentro(payload)
        }
      />

      <DeleteDialog
        open={dialogMode === "delete"}
        centro={selectedCentro}
        onClose={() => setDialogMode(null)}
        onConfirm={() => deleteCentro(selectedCentro.id)}
      />
    </>
  );
}
