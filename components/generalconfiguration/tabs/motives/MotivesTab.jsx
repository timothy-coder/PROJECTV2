"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Edit3,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
} from "lucide-react";

import { AppointmentReasonDialog } from "@/components/generalconfiguration/dialogs/AppointmentReasonDialog";
import { DeleteAppointmentReasonDialog } from "@/components/generalconfiguration/dialogs/DeleteAppointmentReasonDialog";
import { canUseAction } from "@/components/generalconfiguration/permissionUtils";
import { Button } from "@/components/ui/button";
import { useAppointmentReasons } from "@/hooks/generalconfiguration/useAppointmentReasons";
import { hasPerm } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function canView(userPermissions, module) {
  return hasPerm(userPermissions, [module, "view"]);
}

function StatCard({ label, value, tone, icon: Icon }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
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

export function MotivesTab({ tab, userPermissions }) {
  const {
    motivos,
    loading,
    error,
    stats,
    createMotivo,
    updateMotivo,
    deleteMotivo,
    createSubmotivo,
    updateSubmotivo,
    deleteSubmotivo,
    reload,
  } = useAppointmentReasons();
  const [expanded, setExpanded] = useState({});
  const [dialog, setDialog] = useState({ mode: null, type: null, item: null, motivoId: null });
  const canViewMotivos = canView(userPermissions, "configuracion_motivos_citas");
  const canViewSubmotivos = canView(userPermissions, "configuracion_submotivos_citas");
  const canCreateMotivo = canUseAction(userPermissions, tab, "createMotivo");
  const canEditMotivo = canUseAction(userPermissions, tab, "editMotivo");
  const canDeleteMotivo = canUseAction(userPermissions, tab, "deleteMotivo");
  const canCreateSubmotivo = canUseAction(userPermissions, tab, "createSubmotivo");
  const canEditSubmotivo = canUseAction(userPermissions, tab, "editSubmotivo");
  const canDeleteSubmotivo = canUseAction(userPermissions, tab, "deleteSubmotivo");

  function closeDialog() {
    setDialog({ mode: null, type: null, item: null, motivoId: null });
  }

  function openCreateMotivo() {
    setDialog({ mode: "create", type: "motivo", item: null, motivoId: null });
  }

  function openEditMotivo(motivo) {
    setDialog({ mode: "edit", type: "motivo", item: motivo, motivoId: null });
  }

  function openDeleteMotivo(motivo) {
    setDialog({ mode: "delete", type: "motivo", item: motivo, motivoId: null });
  }

  function openCreateSubmotivo(motivo) {
    setExpanded((current) => ({ ...current, [motivo.id]: true }));
    setDialog({ mode: "create", type: "submotivo", item: null, motivoId: motivo.id });
  }

  function openEditSubmotivo(submotivo) {
    setDialog({ mode: "edit", type: "submotivo", item: submotivo, motivoId: submotivo.motivoId });
  }

  function openDeleteSubmotivo(submotivo) {
    setDialog({ mode: "delete", type: "submotivo", item: submotivo, motivoId: submotivo.motivoId });
  }

  async function handleSave(payload) {
    if (dialog.type === "motivo") {
      return dialog.mode === "edit"
        ? updateMotivo(dialog.item.id, payload)
        : createMotivo(payload);
    }

    return dialog.mode === "edit"
      ? updateSubmotivo(dialog.item.id, payload)
      : createSubmotivo(payload);
  }

  async function handleDelete() {
    if (dialog.type === "motivo") {
      return deleteMotivo(dialog.item.id);
    }

    return deleteSubmotivo(dialog.item.id);
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid gap-3 px-4 py-4 lg:grid-cols-3">
          <StatCard label="Total de Motivos" value={stats.totalMotivos} tone="blue" icon={ListChecks} />
          <StatCard label="Motivos Activos" value={stats.motivosActivos} tone="green" icon={CheckCircle2} />
          <StatCard label="Total Submotivos" value={stats.totalSubmotivos} tone="purple" icon={RotateCw} />
        </div>

        <div className="px-4 pb-4">
          <div className="overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-blue-500 bg-white">
            <div className="flex flex-col gap-3 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
                  <ListChecks className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-950">Motivos de Citas</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Gestiona los motivos y submotivos de las citas
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={reload} disabled={loading}>
                  <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                  {motivos.length} motivos
                </Button>
                {canCreateMotivo ? (
                  <Button onClick={openCreateMotivo} className="bg-blue-600 text-white hover:bg-blue-700">
                    <Plus className="size-4" />
                    Nuevo Motivo
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
                  Cargando motivos...
                </div>
              ) : canViewMotivos && motivos.length ? (
                motivos.map((motivo) => {
                  const isOpen = Boolean(expanded[motivo.id]);
                  const submotivos = motivo.submotivos || [];

                  return (
                    <div key={motivo.id} className="rounded-lg border border-slate-200 bg-slate-50">
                      <div className="flex min-h-14 items-center justify-between gap-3 px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((current) => ({
                              ...current,
                              [motivo.id]: !current[motivo.id],
                            }))
                          }
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <ChevronRight
                            className={cn(
                              "size-4 shrink-0 text-blue-600 transition",
                              isOpen && "rotate-90"
                            )}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-950">{motivo.nombre}</p>
                            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                              {submotivos.length} submotivos · {motivo.isActive ? "Activo" : "Inactivo"}
                            </p>
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-2">
                          {canCreateSubmotivo && canViewSubmotivos ? (
                            <Button variant="outline" onClick={() => openCreateSubmotivo(motivo)}>
                              <Plus className="size-4" />
                              Sub
                            </Button>
                          ) : null}
                          {canEditMotivo ? (
                            <Button variant="outline" size="icon" onClick={() => openEditMotivo(motivo)} title="Editar motivo">
                              <Edit3 className="size-4 text-orange-600" />
                            </Button>
                          ) : null}
                          {canDeleteMotivo ? (
                            <Button variant="outline" size="icon" onClick={() => openDeleteMotivo(motivo)} title="Eliminar motivo">
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      {isOpen && canViewSubmotivos ? (
                        <div className="space-y-2 border-t border-slate-200 bg-white p-3">
                          {submotivos.length ? (
                            submotivos.map((submotivo) => (
                              <div
                                key={submotivo.id}
                                className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-950">
                                    {submotivo.nombre}
                                  </p>
                                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                                    ID: {submotivo.id} · {submotivo.isActive ? "Activo" : "Inactivo"}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  {canEditSubmotivo ? (
                                    <Button variant="outline" size="icon" onClick={() => openEditSubmotivo(submotivo)} title="Editar submotivo">
                                      <Edit3 className="size-4 text-orange-600" />
                                    </Button>
                                  ) : null}
                                  {canDeleteSubmotivo ? (
                                    <Button variant="outline" size="icon" onClick={() => openDeleteSubmotivo(submotivo)} title="Eliminar submotivo">
                                      <Trash2 className="size-4 text-red-600" />
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-4 text-center text-sm font-medium text-slate-500">
                              No hay submotivos.
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-sm font-medium text-slate-500">
                  No hay motivos registrados.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <AppointmentReasonDialog
        open={dialog.mode === "create" || dialog.mode === "edit"}
        mode={dialog.mode}
        type={dialog.type}
        item={dialog.item}
        motivos={motivos}
        defaultMotivoId={dialog.motivoId}
        onClose={closeDialog}
        onSubmit={handleSave}
      />

      <DeleteAppointmentReasonDialog
        open={dialog.mode === "delete"}
        type={dialog.type}
        item={dialog.item}
        onClose={closeDialog}
        onConfirm={handleDelete}
      />
    </>
  );
}
