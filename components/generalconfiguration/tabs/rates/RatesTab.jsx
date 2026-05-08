"use client";

import { AlertTriangle, CheckCircle2, Clock3, DollarSign, Edit3, Loader2, Package, Plus, Trash2, Wrench } from "lucide-react";
import { useState } from "react";

import { DeleteRateDialog } from "@/components/generalconfiguration/dialogs/DeleteRateDialog";
import { RateDialog } from "@/components/generalconfiguration/dialogs/RateDialog";
import { canUseAction } from "@/components/generalconfiguration/permissionUtils";
import { Button } from "@/components/ui/button";
import { useCurrencies } from "@/hooks/generalconfiguration/useCurrencies";
import { useRates } from "@/hooks/generalconfiguration/useRates";
import { cn } from "@/lib/utils";

const configByType = {
  mano_obra: {
    title: "Tarifas de Mano de Obra",
    description: "Configure las tarifas por hora que se usaran en cotizaciones",
    icon: Wrench,
    tone: "blue",
    border: "border-l-blue-500",
    header: "bg-blue-50",
    button: "bg-blue-600 hover:bg-blue-700",
  },
  panos: {
    title: "Tarifas de Panos",
    description: "Configure las tarifas por hora que se usaran en cotizaciones",
    icon: Package,
    tone: "purple",
    border: "border-l-purple-500",
    header: "bg-purple-50",
    button: "bg-purple-600 hover:bg-purple-700",
  },
};

function StatCard({ label, value, tone, icon: Icon }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
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

export function RatesTab({ tab, userPermissions }) {
  const tipo = tab.tariffType;
  const view = configByType[tipo];
  const Icon = view.icon;
  const { monedas } = useCurrencies();
  const {
    tarifas,
    loading,
    error,
    stats,
    createTarifa,
    updateTarifa,
    deleteTarifa,
    reload,
  } = useRates(tipo);
  const [dialogMode, setDialogMode] = useState(null);
  const [selectedTarifa, setSelectedTarifa] = useState(null);
  const canCreate = canUseAction(userPermissions, tab, "create");
  const canEdit = canUseAction(userPermissions, tab, "edit");
  const canDelete = canUseAction(userPermissions, tab, "delete");

  function openCreate() {
    setSelectedTarifa(null);
    setDialogMode("create");
  }

  function openEdit(tarifa) {
    setSelectedTarifa(tarifa);
    setDialogMode("edit");
  }

  function openDelete(tarifa) {
    setSelectedTarifa(tarifa);
    setDialogMode("delete");
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid gap-3 px-4 py-4 lg:grid-cols-4">
          <StatCard label="Total" value={stats.total} tone="blue" icon={CheckCircle2} />
          <StatCard label="Activas" value={stats.activas} tone="green" icon={Clock3} />
          <StatCard label="Inactivas" value={stats.inactivas} tone="slate" icon={AlertTriangle} />
          <StatCard label="Promedio" value={stats.promedio.toFixed(2)} tone="orange" icon={DollarSign} />
        </div>

        <div className="px-4 pb-4">
          <div className={cn("overflow-hidden rounded-lg border border-slate-200 border-l-4 bg-white", view.border)}>
            <div className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between", view.header)}>
              <div className="flex min-w-0 items-center gap-3">
                <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md text-white", view.button)}>
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-950">{view.title}</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">{view.description}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canCreate ? (
                  <Button onClick={openCreate} className={cn("text-white", view.button)}>
                    <Plus className="size-4" />
                    Nueva Tarifa
                  </Button>
                ) : null}
                <Button variant="outline" onClick={reload} disabled={loading}>
                  {tarifas.length} tarifas
                </Button>
              </div>
            </div>

            {error ? (
              <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <div className="p-4">
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5">Nombre</th>
                      <th className="px-3 py-2.5">Precio/hora</th>
                      <th className="px-3 py-2.5">Moneda</th>
                      <th className="px-3 py-2.5">Estado</th>
                      <th className="px-3 py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            Cargando tarifas...
                          </span>
                        </td>
                      </tr>
                    ) : tarifas.length ? (
                      tarifas.map((tarifa) => (
                        <tr key={tarifa.id} className="text-slate-800">
                          <td className="px-3 py-2.5 font-bold">{tarifa.nombre}</td>
                          <td className="px-3 py-2.5 font-semibold">{Number(tarifa.precioHora).toFixed(2)}</td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                              {tarifa.monedaSimbolo || "-"} {tarifa.monedaCodigo}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs font-semibold",
                                tarifa.activo
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-600"
                              )}
                            >
                              {tarifa.activo ? "Activa" : "Inactiva"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end gap-2">
                              {canEdit ? (
                                <Button variant="outline" size="icon" onClick={() => openEdit(tarifa)} title="Editar tarifa">
                                  <Edit3 className="size-4 text-orange-600" />
                                </Button>
                              ) : null}
                              {canDelete ? (
                                <Button variant="outline" size="icon" onClick={() => openDelete(tarifa)} title="Eliminar tarifa">
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
                          No hay tarifas registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700">
            <p className="text-sm font-bold">Informacion importante:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-medium">
              <li>Solo las tarifas activas se pueden usar en cotizaciones</li>
              <li>Cada tarifa debe tener una moneda asociada</li>
              <li>El promedio mostrado se recalcula automaticamente</li>
            </ul>
          </div>
        </div>
      </section>

      <RateDialog
        open={dialogMode === "create" || dialogMode === "edit"}
        mode={dialogMode}
        tarifa={selectedTarifa}
        tipo={tipo}
        monedas={monedas}
        onClose={() => setDialogMode(null)}
        onSubmit={(payload) =>
          dialogMode === "edit"
            ? updateTarifa(selectedTarifa.id, payload)
            : createTarifa(payload)
        }
      />

      <DeleteRateDialog
        open={dialogMode === "delete"}
        tarifa={selectedTarifa}
        onClose={() => setDialogMode(null)}
        onConfirm={() => deleteTarifa(selectedTarifa.id)}
      />
    </>
  );
}
