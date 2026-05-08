"use client";

import { useMemo, useState } from "react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PostventaOpportunityDialog({ open, vehicle, options, currentUser, canViewAll, onClose, onSubmit }) {
  const defaultStage = options.stages.find((item) => item.nombre?.toLowerCase() === "nuevo") || options.stages[0];
  const [form, setForm] = useState({
    origenId: "",
    suborigenId: "",
    fechaAgenda: vehicle?.proximoMantenimiento || "",
    horaAgenda: "",
    asignadoA: canViewAll ? "" : String(currentUser?.id || ""),
    detalle: "",
  });
  const originOptions = options.origins.map((item) => ({ value: item.id, label: item.name }));
  const suboriginOptions = useMemo(() => {
    return options.suborigins.filter((item) => !form.origenId || Number(item.origenId) === Number(form.origenId)).map((item) => ({ value: item.id, label: item.name }));
  }, [form.origenId, options.suborigins]);
  const userOptions = [{ value: "", label: "Sin asignar" }, ...options.users.map((item) => ({ value: item.id, label: item.fullname }))];

  async function submit(event) {
    event.preventDefault();
    await onSubmit({
      clienteId: vehicle.clienteId,
      vehiculoId: vehicle.id,
      origenId: form.origenId,
      suborigenId: form.suborigenId,
      fechaAgenda: form.fechaAgenda,
      horaAgenda: form.horaAgenda,
      asignadoA: form.asignadoA,
      etapaId: defaultStage?.id,
      detalle: form.detalle,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-[min(96vw,760px)] bg-white text-slate-950">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Nueva oportunidad</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cliente *"><Input disabled value={vehicle?.clienteNombre || ""} /></Field>
            <Field label="Creado por"><Input disabled value={currentUser?.fullname || ""} /></Field>
            <Field label="Vehiculo *"><Input disabled value={vehicle?.placa || vehicle?.vehiculo || ""} /></Field>
            <Field label="Vehiculo seleccionado"><Input disabled value={vehicle?.vehiculo || ""} /></Field>
            <Field label="Origen *"><SearchableSelect value={form.origenId} options={originOptions} placeholder="Seleccionar origen" onChange={(value) => setForm((current) => ({ ...current, origenId: value, suborigenId: "" }))} /></Field>
            <Field label="Suborigen"><SearchableSelect value={form.suborigenId} options={suboriginOptions} placeholder="Seleccionar suborigen" onChange={(value) => setForm((current) => ({ ...current, suborigenId: value }))} /></Field>
            <Field label="Fecha agenda *"><Input type="date" value={form.fechaAgenda} onChange={(event) => setForm((current) => ({ ...current, fechaAgenda: event.target.value }))} /></Field>
            <Field label="Hora agenda *"><Input type="time" value={form.horaAgenda} onChange={(event) => setForm((current) => ({ ...current, horaAgenda: event.target.value }))} /></Field>
            <Field label="Etapa"><Input disabled value={defaultStage?.nombre || "Nuevo"} /></Field>
            <Field label="Asignado a"><SearchableSelect disabled={!canViewAll} value={form.asignadoA} options={userOptions} placeholder="Seleccionar usuario" onChange={(value) => setForm((current) => ({ ...current, asignadoA: value }))} /></Field>
          </div>
          <Field label="Detalle"><Textarea className="min-h-28" value={form.detalle} placeholder="Detalle de oportunidad" onChange={(event) => setForm((current) => ({ ...current, detalle: event.target.value }))} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-slate-950 text-white hover:bg-slate-800">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1"><Label className="text-xs font-bold text-slate-700">{label}</Label>{children}</div>;
}
