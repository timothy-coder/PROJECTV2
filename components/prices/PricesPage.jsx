"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, Upload, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePrices } from "@/hooks/prices/usePrices";
import { hasPerm } from "@/lib/permissions";

function keyOf(modelId, submantenimientoId) {
  return `${modelId}:${submantenimientoId}`;
}

export default function PricesPage({ userPermissions }) {
  const data = usePrices();
  const [columnModes, setColumnModes] = useState({});
  const canView = hasPerm(userPermissions, ["precios", "view"]);
  const canEdit = hasPerm(userPermissions, ["precios", "edit"]);

  const columns = useMemo(() => data.submaintenances.map((sub) => ({
    ...sub,
    maintenance: data.maintenances.find((item) => item.id === sub.mantenimientoId)?.name || "",
  })), [data.maintenances, data.submaintenances]);

  function updateColumnMode(subId, field, value) {
    setColumnModes((current) => ({
      ...current,
      [subId]: { ...(current[subId] || {}), [field]: value },
    }));
  }

  function saveCell(model, column, rawValue) {
    const value = rawValue === "" ? 0 : Number(rawValue);
    if (Number.isNaN(value)) return;
    const mode = columnModes[column.id] || {};
    const targets = mode.all
      ? data.models
      : mode.class && model.claseId
        ? data.models.filter((item) => item.claseId === model.claseId)
        : [model];

    targets.forEach((target) => {
      data.savePrice({
        mantenimientoId: column.mantenimientoId,
        submantenimientoId: column.id,
        marcaId: target.marcaId,
        modeloId: target.id,
        precio: value,
      });
    });
  }

  if (!canView) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver precios.</div>;
  }

  return (
    <div className="min-w-0 bg-slate-50 p-2 text-slate-950 sm:p-3">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md bg-violet-700 text-white">
          <Wrench className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-tight text-slate-950">Matriz de Precios</h1>
          <p className="text-xs font-medium text-slate-500">Gestiona precios de mantenimiento por modelo</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50/40 p-2">
        <Button variant="outline"><Download className="size-4" />Descargar formato</Button>
        <Button variant="outline"><Download className="size-4" />Descargar precios</Button>
        <Button variant="outline" className="border-violet-600 text-violet-700"><Upload className="size-4" />Cargar Excel</Button>
        <span className="ml-auto text-xs font-medium text-orange-700">Los cambios se guardan automaticamente</span>
      </div>

      <div className="overflow-auto rounded-lg border border-violet-200 bg-white">
        <table className="w-full min-w-[1200px] border-collapse text-xs">
          <thead>
            <tr className="bg-violet-50 text-left text-violet-700">
              <th rowSpan={2} className="sticky left-0 z-20 min-w-32 border border-violet-200 bg-violet-50 px-2 py-2">Marca</th>
              <th rowSpan={2} className="sticky left-32 z-20 min-w-36 border border-violet-200 bg-violet-50 px-2 py-2">Modelo</th>
              <th rowSpan={2} className="min-w-28 border border-violet-200 px-2 py-2">Clase</th>
              {data.maintenances.map((maintenance) => {
                const count = columns.filter((column) => column.mantenimientoId === maintenance.id).length;
                return (
                  <th key={maintenance.id} colSpan={Math.max(count, 1)} className="border border-violet-200 px-2 py-2 text-center">
                    {maintenance.name}
                  </th>
                );
              })}
            </tr>
            <tr className="bg-violet-50 text-violet-700">
              {columns.map((column) => (
                <th key={column.id} className="min-w-32 border border-violet-200 px-2 py-2 text-center">
                  <div className="font-bold">{column.name}</div>
                  <ColumnSwitch label="Todos" checked={Boolean(columnModes[column.id]?.all)} onChange={(checked) => updateColumnMode(column.id, "all", checked)} />
                  <ColumnSwitch label="Clase" checked={Boolean(columnModes[column.id]?.class)} onChange={(checked) => updateColumnMode(column.id, "class", checked)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.loading ? (
              <tr>
                <td colSpan={columns.length + 3} className="py-10 text-center text-slate-500">
                  <Loader2 className="mr-2 inline size-4 animate-spin" />
                  Cargando precios...
                </td>
              </tr>
            ) : (
              data.models.map((model) => (
                <tr key={model.id} className="hover:bg-violet-50/30">
                  <td className="sticky left-0 z-10 border border-violet-100 bg-white px-2 py-1 font-medium text-violet-700">{model.marcaName}</td>
                  <td className="sticky left-32 z-10 border border-violet-100 bg-white px-2 py-1 font-medium text-violet-700">{model.name}</td>
                  <td className="border border-violet-100 px-2 py-1 text-violet-700">{model.claseName}</td>
                  {columns.map((column) => {
                    const value = data.priceMap.get(keyOf(model.id, column.id));
                    const saving = data.savingKey === keyOf(model.id, column.id);
                    return (
                      <td key={column.id} className="border border-violet-100 p-1 text-center">
                        <input
                          disabled={!canEdit}
                          defaultValue={value ?? ""}
                          placeholder="-"
                          onBlur={(event) => saveCell(model, column, event.target.value)}
                          className="h-8 w-full rounded-md border border-violet-100 bg-white px-2 text-center text-xs font-medium text-violet-700 outline-none focus:border-violet-400 disabled:opacity-70"
                        />
                        {saving ? <span className="text-[10px] text-orange-600">Guardando</span> : null}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColumnSwitch({ label, checked, onChange }) {
  return (
    <label className="mt-1 flex items-center justify-center gap-1 text-[10px] font-medium text-violet-700">
      <span>{label}</span>
      <Switch size="sm" checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} />
    </label>
  );
}
