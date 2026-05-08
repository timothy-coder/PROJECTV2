"use client";

import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const copyByType = {
  motivo: {
    create: "Nuevo motivo",
    edit: "Editar motivo",
    name: "Nombre del motivo",
    placeholder: "Ej. Mantenimiento",
  },
  submotivo: {
    create: "Nuevo submotivo",
    edit: "Editar submotivo",
    name: "Nombre del submotivo",
    placeholder: "Ej. Cambio de aceite",
  },
};

export function AppointmentReasonDialog({
  open,
  mode,
  type,
  item,
  motivos,
  defaultMotivoId,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  return (
    <AppointmentReasonDialogContent
      key={`${type}-${mode}-${item?.id || "new"}-${defaultMotivoId || "none"}`}
      mode={mode}
      type={type}
      item={item}
      motivos={motivos}
      defaultMotivoId={defaultMotivoId}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function AppointmentReasonDialogContent({
  mode,
  type,
  item,
  motivos,
  defaultMotivoId,
  onClose,
  onSubmit,
}) {
  const copy = copyByType[type];
  const [nombre, setNombre] = useState(item?.nombre || "");
  const [motivoId, setMotivoId] = useState(String(item?.motivoId || defaultMotivoId || ""));
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const motivoOptions = useMemo(
    () => motivos.map((motivo) => ({ value: motivo.id, label: motivo.nombre })),
    [motivos]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanName = nombre.trim();
    const payload = { nombre: cleanName, isActive };

    if (!cleanName) {
      setError(copy.name);
      return;
    }

    if (type === "submotivo") {
      const numericMotivoId = Number(motivoId);

      if (!numericMotivoId) {
        setError("Selecciona un motivo.");
        return;
      }

      payload.motivoId = numericMotivoId;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit(payload);
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
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{copy[mode]}</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Completa la informacion requerida.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {type === "submotivo" ? (
            <div className="space-y-2">
              <Label>Motivo</Label>
              <SearchableSelect
                value={motivoId}
                options={motivoOptions}
                placeholder="Selecciona un motivo"
                searchPlaceholder="Buscar motivo..."
                emptyText="Sin motivos"
                onChange={setMotivoId}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="appointment-reason-name">{copy.name}</Label>
            <Input
              id="appointment-reason-name"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder={copy.placeholder}
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
