"use client";

import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AppointmentSuboriginDialog({
  open,
  mode,
  suborigen,
  origenes,
  defaultOrigenId,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  return (
    <AppointmentSuboriginDialogContent
      key={`${mode}-${suborigen?.id || "new"}-${defaultOrigenId || "all"}`}
      mode={mode}
      suborigen={suborigen}
      origenes={origenes}
      defaultOrigenId={defaultOrigenId}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function AppointmentSuboriginDialogContent({
  mode,
  suborigen,
  origenes,
  defaultOrigenId,
  onClose,
  onSubmit,
}) {
  const [origenId, setOrigenId] = useState(String(suborigen?.origenId || defaultOrigenId || ""));
  const [name, setName] = useState(suborigen?.name || "");
  const [isActive, setIsActive] = useState(suborigen?.isActive ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const title = mode === "edit" ? "Editar suborigen" : "Nuevo suborigen";
  const origenOptions = useMemo(
    () => origenes.map((origen) => ({ value: origen.id, label: origen.name })),
    [origenes]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    const numericOrigenId = Number(origenId);
    const cleanName = name.trim();

    if (!numericOrigenId) {
      setError("Selecciona un origen.");
      return;
    }

    if (!cleanName) {
      setError("Ingresa el nombre del suborigen.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit({ origenId: numericOrigenId, name: cleanName, isActive });
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar el suborigen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{title}</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Asocia el suborigen a un origen padre.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label>Origen</Label>
            <SearchableSelect
              value={origenId}
              options={origenOptions}
              placeholder="Selecciona un origen"
              searchPlaceholder="Buscar origen..."
              emptyText="Sin origenes"
              onChange={setOrigenId}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointment-suborigin-name">Nombre</Label>
            <Input
              id="appointment-suborigin-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Volanteo Open Plaza"
              className="h-9 bg-white text-sm"
              autoFocus
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
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
          <Button type="submit" disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </form>
    </div>
  );
}
