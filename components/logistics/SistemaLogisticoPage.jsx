"use client";

import { useMemo, useState } from "react";
import { Calculator, Plus, RotateCcw, TableProperties } from "lucide-react";

import { Button } from "@/components/ui/button";
import { calculateLogisticsRow, LOGISTICS_MONTH_KEYS } from "@/lib/logisticsClassification";

const MONTH_KEYS = LOGISTICS_MONTH_KEYS;

function createRow(index) {
  return {
    id: crypto.randomUUID?.() || `${Date.now()}-${index}`,
    producto: `Producto ${String.fromCharCode(65 + index)}`,
    stockActual: "",
    diasAlmacen: "",
    mesActual: "",
    ...Object.fromEntries(MONTH_KEYS.map((key) => [key, ""])),
  };
}

function defaultRows() {
  return Array.from({ length: 6 }, (_, index) => createRow(index));
}

function calculateRow(row) {
  return calculateLogisticsRow(row);
}

export default function SistemaLogisticoPage({ initialRows = [] }) {
  const fallbackRows = useMemo(() => defaultRows(), []);
  const sourceRows = initialRows.length ? initialRows : fallbackRows;
  const [rows, setRows] = useState(sourceRows);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const result = calculateRow(row);
        acc[result.tipo || "sinTipo"] += 1;
        return acc;
      },
      { A: 0, B: 0, C: 0, D: 0, sinTipo: 0 }
    );
  }, [rows]);

  function updateCell(rowId, field, value) {
    setRows((currentRows) => currentRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setRows((currentRows) => [...currentRows, createRow(currentRows.length)]);
  }

  function resetRows() {
    setRows(sourceRows);
  }

  return (
    <div className="min-w-0 bg-slate-50 p-2 text-slate-950 sm:p-3">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md bg-emerald-700 text-white">
          <TableProperties className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight text-slate-950">Sistema Logistico</h1>
          <p className="text-xs font-medium text-slate-500">Matriz de doble entrada para clasificacion de stock</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={addRow}>
            <Plus className="size-4" />
            Fila
          </Button>
          <Button variant="outline" onClick={resetRows}>
            <RotateCcw className="size-4" />
            Reiniciar
          </Button>
        </div>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-5">
        <SummaryCard label="Tipo A" value={totals.A} tone="bg-emerald-50 text-emerald-700 border-emerald-200" />
        <SummaryCard label="Tipo B" value={totals.B} tone="bg-sky-50 text-sky-700 border-sky-200" />
        <SummaryCard label="Tipo C" value={totals.C} tone="bg-amber-50 text-amber-700 border-amber-200" />
        <SummaryCard label="Tipo D" value={totals.D} tone="bg-rose-50 text-rose-700 border-rose-200" />
        <SummaryCard label="Sin tipo" value={totals.sinTipo} tone="bg-slate-50 text-slate-700 border-slate-200" />
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[1500px] border-collapse text-xs">
          <thead>
            <tr className="bg-emerald-50 text-left text-emerald-800">
              <th className="sticky left-0 z-20 min-w-36 border border-emerald-100 bg-emerald-50 px-2 py-2">Producto</th>
              <th className="min-w-28 border border-emerald-100 px-2 py-2 text-center">Stock actual</th>
              <th className="min-w-36 border border-emerald-100 px-2 py-2 text-center">Respuesta final</th>
              <th className="min-w-32 border border-emerald-100 px-2 py-2 text-center">Dias en almacen</th>
              <th className="min-w-28 border border-emerald-100 px-2 py-2 text-center">Mes actual</th>
              {MONTH_KEYS.map((key) => (
                <th key={key} className="min-w-24 border border-emerald-100 px-2 py-2 text-center">
                  M-{key.slice(1)}
                </th>
              ))}
              <th className="min-w-20 border border-emerald-100 px-2 py-2 text-center">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const result = calculateRow(row);
              return (
                <tr key={row.id} className="hover:bg-emerald-50/30">
                  <td className="sticky left-0 z-10 border border-slate-100 bg-white p-1">
                    <CellInput value={row.producto} onChange={(value) => updateCell(row.id, "producto", value)} text />
                  </td>
                  <td className="border border-slate-100 p-1">
                    <CellInput value={row.stockActual} onChange={(value) => updateCell(row.id, "stockActual", value)} />
                  </td>
                  <td className="border border-slate-100 p-1 text-center">
                    <span className="inline-flex h-7 min-w-20 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 font-bold text-slate-800">
                      {result.respuestaFinal || "-"}
                    </span>
                  </td>
                  <td className="border border-slate-100 p-1">
                    <CellInput value={row.diasAlmacen} onChange={(value) => updateCell(row.id, "diasAlmacen", value)} />
                  </td>
                  <td className="border border-slate-100 p-1">
                    <CellInput value={row.mesActual} onChange={(value) => updateCell(row.id, "mesActual", value)} />
                  </td>
                  {MONTH_KEYS.map((key) => (
                    <td key={key} className="border border-slate-100 p-1">
                      <CellInput value={row[key]} onChange={(value) => updateCell(row.id, key, value)} />
                    </td>
                  ))}
                  <td className="border border-slate-100 p-1 text-center">
                    <span className="inline-flex h-7 min-w-10 items-center justify-center rounded-md border border-emerald-100 bg-emerald-50 px-2 font-bold text-emerald-800">
                      {result.tipo || "-"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 text-xs font-medium text-emerald-800">
        <Calculator className="size-4" />
        Los valores se recalculan en pantalla al editar cada celda.
      </div>
    </div>
  );
}

function CellInput({ value, onChange, text = false }) {
  return (
    <input
      type={text ? "text" : "number"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-center text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
    />
  );
}

function SummaryCard({ label, value, tone }) {
  return (
    <div className={`rounded-lg border p-2 ${tone}`}>
      <div className="text-[11px] font-bold uppercase">{label}</div>
      <div className="text-xl font-black leading-tight">{value}</div>
    </div>
  );
}
