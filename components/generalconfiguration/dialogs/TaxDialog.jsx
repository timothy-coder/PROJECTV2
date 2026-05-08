"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TaxDialog({ open, mode, impuesto, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <TaxDialogContent
      key={`${mode}-${impuesto?.id || "new"}`}
      mode={mode}
      impuesto={impuesto}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function TaxDialogContent({ mode, impuesto, onClose, onSubmit }) {
  const [nombre, setNombre] = useState(impuesto?.nombre || "");
  const [porcentaje, setPorcentaje] = useState(String(impuesto?.porcentaje ?? ""));
  const [isActive, setIsActive] = useState(impuesto?.isActive ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const title = mode === "edit" ? "Editar impuesto" : "Nuevo impuesto";

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanName = nombre.trim();
    const numericPercent = Number(porcentaje);

    if (!cleanName || Number.isNaN(numericPercent) || numericPercent < 0) {
      setError("Nombre y porcentaje valido son obligatorios.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit({ nombre: cleanName, porcentaje: numericPercent, isActive });
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar el impuesto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{title}</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Configura la tasa aplicable.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tax-name">Nombre</Label>
            <Input
              id="tax-name"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="IGV"
              className="h-9 bg-white text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax-percent">Porcentaje</Label>
            <Input
              id="tax-percent"
              type="number"
              min="0"
              step="0.01"
              value={porcentaje}
              onChange={(event) => setPorcentaje(event.target.value)}
              placeholder="18.00"
              className="h-9 bg-white text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
            <Checkbox checked={isActive} onCheckedChange={(checked) => setIsActive(Boolean(checked))} />
            Activo
          </label>
        </div>

        {error ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving} className="bg-purple-600 text-white hover:bg-purple-700">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </form>
    </div>
  );
}
