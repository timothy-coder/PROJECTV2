"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CurrencyDialog({ open, mode, moneda, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <CurrencyDialogContent
      key={`${mode}-${moneda?.id || "new"}`}
      mode={mode}
      moneda={moneda}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function CurrencyDialogContent({ mode, moneda, onClose, onSubmit }) {
  const [codigo, setCodigo] = useState(moneda?.codigo || "");
  const [nombre, setNombre] = useState(moneda?.nombre || "");
  const [simbolo, setSimbolo] = useState(moneda?.simbolo || "");
  const [isActive, setIsActive] = useState(moneda?.isActive ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const title = mode === "edit" ? "Editar moneda" : "Nueva moneda";

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanCodigo = codigo.trim().toUpperCase();
    const cleanNombre = nombre.trim();
    const cleanSimbolo = simbolo.trim();

    if (!cleanCodigo || !cleanNombre || !cleanSimbolo) {
      setError("Codigo, nombre y simbolo son obligatorios.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit({
        codigo: cleanCodigo,
        nombre: cleanNombre,
        simbolo: cleanSimbolo,
        isActive,
      });
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar la moneda.");
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
              Configura codigo, nombre y simbolo.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currency-code">Codigo</Label>
            <Input
              id="currency-code"
              value={codigo}
              onChange={(event) => setCodigo(event.target.value.toUpperCase())}
              placeholder="PEN"
              className="h-9 bg-white text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency-symbol">Simbolo</Label>
            <Input
              id="currency-symbol"
              value={simbolo}
              onChange={(event) => setSimbolo(event.target.value)}
              placeholder="S/"
              className="h-9 bg-white text-sm"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="currency-name">Nombre</Label>
            <Input
              id="currency-name"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Sol Peruano"
              className="h-9 bg-white text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
            <Checkbox checked={isActive} onCheckedChange={(checked) => setIsActive(Boolean(checked))} />
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
