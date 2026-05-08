"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AppointmentOriginDialog({ open, mode, origen, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <AppointmentOriginDialogContent
      key={`${mode}-${origen?.id || "new"}`}
      mode={mode}
      origen={origen}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function AppointmentOriginDialogContent({ mode, origen, onClose, onSubmit }) {
  const [name, setName] = useState(origen?.name || "");
  const [isActive, setIsActive] = useState(origen?.isActive ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const title = mode === "edit" ? "Editar origen" : "Nuevo origen";

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setError("Ingresa el nombre del origen.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit({ name: cleanName, isActive });
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar el origen.");
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
              Define la fuente u origen de la cita.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="appointment-origin-name">Nombre</Label>
            <Input
              id="appointment-origin-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Facebook"
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
