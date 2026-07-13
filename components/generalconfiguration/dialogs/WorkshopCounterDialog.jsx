"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const labels = {
  taller: {
    create: "Nuevo almacen",
    edit: "Editar almacen",
    name: "Nombre del almacen",
    placeholder: "Ej. Almacen principal",
  },
  mostrador: {
    create: "Nuevo mostrador",
    edit: "Editar mostrador",
    name: "Nombre del mostrador",
    placeholder: "Ej. Mostrador repuestos",
  },
};

export function WorkshopCounterDialog({
  open,
  mode,
  type,
  item,
  centros,
  defaultCentroId,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  return (
    <WorkshopCounterDialogContent
      key={`${type}-${mode}-${item?.id || "new"}-${defaultCentroId || "none"}`}
      mode={mode}
      type={type}
      item={item}
      centros={centros}
      defaultCentroId={defaultCentroId}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function WorkshopCounterDialogContent({
  mode,
  type,
  item,
  centros,
  defaultCentroId,
  onClose,
  onSubmit,
}) {
  const copy = labels[type];
  const [centroId, setCentroId] = useState(String(item?.centroId || defaultCentroId || ""));
  const [nombre, setNombre] = useState(item?.nombre || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const centroOptions = centros.map((centro) => ({
    value: centro.id,
    label: centro.nombre,
  }));

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanName = nombre.trim();
    const numericCentroId = Number(centroId);

    if (!numericCentroId) {
      setError("Selecciona un grupo.");
      return;
    }

    if (!cleanName) {
      setError(copy.name);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit({ centroId: numericCentroId, nombre: cleanName });
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar la informacion.");
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
            <h2 className="text-lg font-bold text-slate-950">{copy[mode]}</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Selecciona el grupo y define el nombre.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label>Grupo</Label>
            <SearchableSelect
              value={centroId}
              options={centroOptions}
              placeholder="Selecciona un grupo"
              searchPlaceholder="Buscar grupo..."
              emptyText="Sin grupos"
              onChange={setCentroId}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workshop-counter-name">{copy.name}</Label>
            <Input
              id="workshop-counter-name"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder={copy.placeholder}
              className="h-10 bg-white text-sm"
              autoFocus
            />
          </div>
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
