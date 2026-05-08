"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formFromVehicle(vehicle, client) {
  return {
    clienteId: vehicle?.clienteId || client?.id || "",
    placas: vehicle?.placas || "",
    vin: vehicle?.vin || "",
    marcaId: vehicle?.marcaId || "",
    modeloId: vehicle?.modeloId || "",
    anio: vehicle?.anio || "",
    color: vehicle?.color || "",
    kilometraje: vehicle?.kilometraje || "",
    fechaUltimaVisita: vehicle?.fechaUltimaVisita ? String(vehicle.fechaUltimaVisita).slice(0, 10) : "",
  };
}

export function VehicleDialog({ open, mode, vehicle, client, options, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <VehicleDialogContent
      key={`${mode}-${vehicle?.id || "new"}-${client?.id || "none"}`}
      mode={mode}
      vehicle={vehicle}
      client={client}
      options={options}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function VehicleDialogContent({ mode, vehicle, client, options, onClose, onSubmit }) {
  const [form, setForm] = useState(formFromVehicle(vehicle, client));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  const marcaOptions = useMemo(
    () => (options?.marcas || []).map((item) => ({ value: item.id, label: item.name })),
    [options?.marcas]
  );
  const modeloOptions = useMemo(
    () =>
      (options?.modelos || [])
        .filter((item) => !form.marcaId || Number(form.marcaId) === item.marcaId)
        .map((item) => ({ value: item.id, label: item.name })),
    [form.marcaId, options?.modelos]
  );
  const selectedModelo = (options?.modelos || []).find((item) => String(item.id) === String(form.modeloId));
  const clase = (options?.clases || []).find((item) => item.id === selectedModelo?.claseId);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.clienteId || !form.placas.trim()) {
      setError("Cliente y placa son obligatorios.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar el vehiculo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[min(96vw,640px)] text-slate-950 sm:max-w-[640px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-violet-700">
              {mode === "edit" ? "Editar vehiculo" : "Nuevo vehiculo"}
            </DialogTitle>
            <DialogDescription>
              Cliente: {[client?.nombre, client?.apellido].filter(Boolean).join(" ") || client?.nombreComercial}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Placa" value={form.placas} onChange={(value) => updateField("placas", value.toUpperCase())} />
            <Field label="VIN" value={form.vin} onChange={(value) => updateField("vin", value)} />
            <div className="space-y-2">
              <Label>Marca</Label>
              <SearchableSelect
                value={form.marcaId}
                options={marcaOptions}
                placeholder="Selecciona marca"
                searchPlaceholder="Buscar marca..."
                emptyText="Sin marcas"
                onChange={(value) => {
                  updateField("marcaId", value);
                  updateField("modeloId", "");
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <SearchableSelect
                value={form.modeloId}
                options={modeloOptions}
                placeholder="Selecciona modelo"
                searchPlaceholder="Buscar modelo..."
                emptyText="Sin modelos"
                disabled={!form.marcaId}
                onChange={(value) => updateField("modeloId", value)}
              />
              {clase ? <p className="text-xs font-medium text-slate-500">Clase: {clase.name}</p> : null}
            </div>
            <Field label="Año" value={form.anio} onChange={(value) => updateField("anio", value)} />
            <Field label="Color" value={form.color} onChange={(value) => updateField("color", value)} />
            <Field label="Kilometraje" value={form.kilometraje} onChange={(value) => updateField("kilometraje", value)} />
            <Field type="date" label="Ultima visita" value={form.fechaUltimaVisita} onChange={(value) => updateField("fechaUltimaVisita", value)} />
          </div>
          {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} className="h-9 bg-white" />
    </div>
  );
}
