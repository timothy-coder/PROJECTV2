"use client";

import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RateDialog({ open, mode, tarifa, tipo, monedas, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <RateDialogContent
      key={`${mode}-${tipo}-${tarifa?.id || "new"}`}
      mode={mode}
      tarifa={tarifa}
      tipo={tipo}
      monedas={monedas}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function RateDialogContent({ mode, tarifa, tipo, monedas, onClose, onSubmit }) {
  const [nombre, setNombre] = useState(tarifa?.nombre || "");
  const [precioHora, setPrecioHora] = useState(String(tarifa?.precioHora ?? ""));
  const [monedaId, setMonedaId] = useState(String(tarifa?.monedaId || ""));
  const [activo, setActivo] = useState(tarifa?.activo ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const title = mode === "edit" ? "Editar tarifa" : "Nueva tarifa";
  const monedaOptions = useMemo(
    () =>
      monedas.map((moneda) => ({
        value: moneda.id,
        label: `${moneda.codigo} - ${moneda.nombre}`,
      })),
    [monedas]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanName = nombre.trim();
    const numericPrice = Number(precioHora);
    const numericCurrency = Number(monedaId);

    if (!cleanName || Number.isNaN(numericPrice) || numericPrice < 0) {
      setError("Nombre y precio/hora valido son obligatorios.");
      return;
    }

    if (!numericCurrency) {
      setError("Selecciona una moneda.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit({
        tipo,
        monedaId: numericCurrency,
        nombre: cleanName,
        precioHora: numericPrice,
        activo,
      });
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar la tarifa.");
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
              Configura la tarifa por hora.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="rate-name">Nombre</Label>
            <Input
              id="rate-name"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder={tipo === "mano_obra" ? "Mano de obra" : "Pano"}
              className="h-9 bg-white text-sm"
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rate-price">Precio/hora</Label>
              <Input
                id="rate-price"
                type="number"
                min="0"
                step="0.01"
                value={precioHora}
                onChange={(event) => setPrecioHora(event.target.value)}
                placeholder="10.00"
                className="h-9 bg-white text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Moneda</Label>
              <SearchableSelect
                value={monedaId}
                options={monedaOptions}
                placeholder="Selecciona moneda"
                searchPlaceholder="Buscar moneda..."
                emptyText="Sin monedas"
                onChange={setMonedaId}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Checkbox checked={activo} onCheckedChange={(checked) => setActivo(Boolean(checked))} />
            Activa
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
