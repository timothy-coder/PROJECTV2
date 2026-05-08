"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CenterDialog({ open, mode, centro, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <CenterDialogContent
      key={`${mode}-${centro?.id || "new"}`}
      mode={mode}
      centro={centro}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function CenterDialogContent({ mode, centro, onClose, onSubmit }) {
  const [nombre, setNombre] = useState(centro?.nombre || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const title = mode === "edit" ? "Editar centro" : "Nuevo centro";

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanName = nombre.trim();

    if (!cleanName) {
      setError("Ingresa el nombre del centro.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit({ nombre: cleanName });
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar el centro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Define el nombre que se usara en la configuracion.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-5 space-y-2">
          <Label htmlFor="centro-nombre">Nombre</Label>
          <Input
            id="centro-nombre"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Ej. Centro principal"
            className="h-10 bg-white text-sm"
            autoFocus
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
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
