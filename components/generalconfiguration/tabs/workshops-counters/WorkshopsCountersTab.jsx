"use client";

import { useMemo, useState } from "react";
import { BarChart3, Building2, Edit3, Factory, Loader2, Plus, Trash2, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeleteWorkshopCounterDialog } from "@/components/generalconfiguration/dialogs/DeleteWorkshopCounterDialog";
import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { WorkshopCounterDialog } from "@/components/generalconfiguration/dialogs/WorkshopCounterDialog";
import { canUseAction } from "@/components/generalconfiguration/permissionUtils";
import { useConfigurationCenters } from "@/hooks/generalconfiguration/useConfigurationCenters";
import { useWorkshopsCounters } from "@/hooks/generalconfiguration/useWorkshopsCounters";
import { hasPerm } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function canView(userPermissions, module) {
  return hasPerm(userPermissions, [module, "view"]);
}

function SummaryCard({ label, value, tone, icon: Icon }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
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

function ItemPanel({
  title,
  subtitle,
  tone,
  icon: Icon,
  items,
  loading,
  canCreate,
  canEdit,
  canDelete,
  onCreate,
  onEdit,
  onDelete,
}) {
  const tones = {
    blue: {
      border: "border-l-blue-500",
      header: "bg-blue-50",
      icon: "bg-blue-600 text-white",
      bullet: "bg-blue-500",
      button: "bg-blue-600 hover:bg-blue-700",
    },
    purple: {
      border: "border-l-purple-500",
      header: "bg-purple-50",
      icon: "bg-purple-600 text-white",
      bullet: "bg-purple-500",
      button: "bg-purple-600 hover:bg-purple-700",
    },
  };
  const palette = tones[tone];

  return (
    <section className={cn("overflow-hidden rounded-lg border border-slate-200 border-l-4 bg-white", palette.border)}>
      <div className={cn("flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4", palette.header)}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", palette.icon)}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-950">{title}</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
          </div>
        </div>

        {canCreate ? (
          <Button onClick={onCreate} className={cn("w-full text-white sm:w-auto", palette.button)}>
            <Plus className="size-4" />
            Nuevo
          </Button>
        ) : null}
      </div>

      <div className="space-y-2 p-2 sm:p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Cargando...
          </div>
        ) : items.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 sm:gap-3 sm:px-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("size-2 shrink-0 rounded-full", palette.bullet)} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{item.nombre}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">ID: {item.id}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {canEdit ? (
                  <Button variant="outline" size="icon" onClick={() => onEdit(item)} title={`Editar ${title}`}>
                    <Edit3 className="size-4 text-orange-600" />
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button variant="outline" size="icon" onClick={() => onDelete(item)} title={`Eliminar ${title}`}>
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-sm font-medium text-slate-500">
            No hay registros para este centro.
          </div>
        )}
      </div>
    </section>
  );
}

export function WorkshopsCountersTab({ tab, userPermissions }) {
  const { centros, loading: loadingCentros } = useConfigurationCenters();
  const [selectedCentroId, setSelectedCentroId] = useState("");
  const currentCentroId = selectedCentroId || String(centros[0]?.id || "");
  const numericCentroId = Number(currentCentroId);
  const {
    talleres,
    mostradores,
    loading,
    error,
    stats,
    createTaller,
    updateTaller,
    deleteTaller,
    createMostrador,
    updateMostrador,
    deleteMostrador,
  } = useWorkshopsCounters(numericCentroId);
  const [dialog, setDialog] = useState({ mode: null, type: null, item: null });

  const selectedCentro = useMemo(
    () => centros.find((centro) => String(centro.id) === currentCentroId) || null,
    [centros, currentCentroId]
  );
  const centroOptions = useMemo(
    () => centros.map((centro) => ({ value: centro.id, label: centro.nombre })),
    [centros]
  );
  const canViewTalleres = canView(userPermissions, "configuracion_talleres");
  const canViewMostradores = canView(userPermissions, "configuracion_mostradores");
  const canCreateTaller = canUseAction(userPermissions, tab, "createTaller");
  const canEditTaller = canUseAction(userPermissions, tab, "editTaller");
  const canDeleteTaller = canUseAction(userPermissions, tab, "deleteTaller");
  const canCreateMostrador = canUseAction(userPermissions, tab, "createMostrador");
  const canEditMostrador = canUseAction(userPermissions, tab, "editMostrador");
  const canDeleteMostrador = canUseAction(userPermissions, tab, "deleteMostrador");

  function openCreate(type) {
    setDialog({ mode: "create", type, item: null });
  }

  function openEdit(type, item) {
    setDialog({ mode: "edit", type, item });
  }

  function openDelete(type, item) {
    setDialog({ mode: "delete", type, item });
  }

  function closeDialog() {
    setDialog({ mode: null, type: null, item: null });
  }

  async function handleSave(payload) {
    if (dialog.type === "taller") {
      return dialog.mode === "edit"
        ? updateTaller(dialog.item.id, payload)
        : createTaller(payload);
    }

    return dialog.mode === "edit"
      ? updateMostrador(dialog.item.id, payload)
      : createMostrador(payload);
  }

  async function handleDelete() {
    if (dialog.type === "taller") {
      return deleteTaller(dialog.item.id);
    }

    return deleteMostrador(dialog.item.id);
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
              <Building2 className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold leading-tight text-slate-950 sm:text-xl">
                Talleres y Mostradores
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Gestiona los talleres y mostradores de cada centro
              </p>
            </div>
          </div>
        </div>

        <div className="mx-4 border-t border-slate-200" />

        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <label className="text-xs font-semibold text-slate-700">
              Centro
            </label>
            <div className="mt-2 max-w-none sm:max-w-xs">
              <SearchableSelect
              value={currentCentroId}
              options={centroOptions}
              placeholder="Selecciona un centro"
              searchPlaceholder="Buscar centro..."
              emptyText="Sin centros"
              disabled={loadingCentros || !centros.length}
              onChange={setSelectedCentroId}
            />
            </div>
          </div>
        </div>

        {error ? (
          <div className="mx-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4">
          {canViewTalleres ? (
            <SummaryCard label="Total Talleres" value={stats.talleres} tone="blue" icon={Wrench} />
          ) : null}
          {canViewMostradores ? (
            <SummaryCard label="Total Mostradores" value={stats.mostradores} tone="purple" icon={BarChart3} />
          ) : null}
        </div>

        <div className="grid gap-4 px-4 pb-4 xl:grid-cols-2">
          {canViewTalleres ? (
            <ItemPanel
              title="Talleres"
              subtitle={`${talleres.length} registrados${selectedCentro ? ` en ${selectedCentro.nombre}` : ""}`}
              tone="blue"
              icon={Wrench}
              items={talleres}
              loading={loading}
              canCreate={canCreateTaller && Boolean(numericCentroId)}
              canEdit={canEditTaller}
              canDelete={canDeleteTaller}
              onCreate={() => openCreate("taller")}
              onEdit={(item) => openEdit("taller", item)}
              onDelete={(item) => openDelete("taller", item)}
            />
          ) : null}

          {canViewMostradores ? (
            <ItemPanel
              title="Mostradores"
              subtitle={`${mostradores.length} registrados${selectedCentro ? ` en ${selectedCentro.nombre}` : ""}`}
              tone="purple"
              icon={BarChart3}
              items={mostradores}
              loading={loading}
              canCreate={canCreateMostrador && Boolean(numericCentroId)}
              canEdit={canEditMostrador}
              canDelete={canDeleteMostrador}
              onCreate={() => openCreate("mostrador")}
              onEdit={(item) => openEdit("mostrador", item)}
              onDelete={(item) => openDelete("mostrador", item)}
            />
          ) : null}
        </div>
      </section>

      <WorkshopCounterDialog
        open={dialog.mode === "create" || dialog.mode === "edit"}
        mode={dialog.mode}
        type={dialog.type}
        item={dialog.item}
        centros={centros}
        defaultCentroId={numericCentroId}
        onClose={closeDialog}
        onSubmit={handleSave}
      />

      <DeleteWorkshopCounterDialog
        open={dialog.mode === "delete"}
        type={dialog.type}
        item={dialog.item}
        onClose={closeDialog}
        onConfirm={handleDelete}
      />
    </>
  );
}
