"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

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
    activityText: "",
    activities: [],
    asignadoA: canViewAll ? "" : String(currentUser?.id || ""),
    details: [],
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
      details: form.details,
      activities: form.activities,
      asignadoA: form.asignadoA,
      etapaId: defaultStage?.id,
    });
  }

  function addDetail() {
    if (!form.fechaAgenda || !form.horaAgenda) return;
    setForm((current) => ({
      ...current,
      details: [...current.details, { fechaAgenda: current.fechaAgenda, horaAgenda: current.horaAgenda }],
      fechaAgenda: "",
      horaAgenda: "",
    }));
  }

  function addActivity() {
    const detalle = form.activityText.trim();
    if (!detalle) return;
    setForm((current) => ({
      ...current,
      activities: [...current.activities, { detalle }],
      activityText: "",
    }));
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
            <Field label="Etapa"><Input disabled value={defaultStage?.nombre || "Nuevo"} /></Field>
            <Field label="Asignado a"><SearchableSelect disabled={!canViewAll} value={form.asignadoA} options={userOptions} placeholder="Seleccionar usuario" onChange={(value) => setForm((current) => ({ ...current, asignadoA: value }))} /></Field>
          </div>
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <h3 className="mb-3 text-sm font-bold text-emerald-800">Agendas de la oportunidad</h3>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <Field label="Fecha agenda"><Input type="date" value={form.fechaAgenda} onChange={(event) => setForm((current) => ({ ...current, fechaAgenda: event.target.value }))} /></Field>
              <Field label="Hora agenda"><Input type="time" value={form.horaAgenda} onChange={(event) => setForm((current) => ({ ...current, horaAgenda: event.target.value }))} /></Field>
              <div className="flex items-end"><Button type="button" variant="outline" className="w-full" onClick={addDetail}><Plus className="size-4" />Agregar</Button></div>
            </div>
            <div className="mt-3 space-y-2">
              {form.details.map((detail, index) => (
                <div key={`${detail.fechaAgenda}-${detail.horaAgenda}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-white p-2 text-sm">
                  <span className="font-semibold">{detail.fechaAgenda || "-"} {detail.horaAgenda || "-"}</span>
                  <Button type="button" size="icon" variant="ghost" onClick={() => setForm((current) => ({ ...current, details: current.details.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="size-4 text-red-600" /></Button>
                </div>
              ))}
              {!form.details.length ? <p className="rounded-lg border border-dashed border-emerald-300 bg-white p-3 text-center text-sm text-slate-500">Agrega al menos una agenda.</p> : null}
            </div>
          </section>
          <section className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <h3 className="mb-3 text-sm font-bold text-blue-800">Actividades de la oportunidad</h3>
            <Textarea className="min-h-24 bg-white" value={form.activityText} placeholder="Describe la actividad..." onChange={(event) => setForm((current) => ({ ...current, activityText: event.target.value }))} />
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={addActivity}><Plus className="size-4" />Agregar actividad</Button>
            <div className="mt-3 space-y-2">
              {form.activities.map((activity, index) => (
                <div key={`${activity.detalle}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-white p-2 text-sm">
                  <span className="whitespace-pre-wrap font-semibold">{activity.detalle}</span>
                  <Button type="button" size="icon" variant="ghost" onClick={() => setForm((current) => ({ ...current, activities: current.activities.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="size-4 text-red-600" /></Button>
                </div>
              ))}
              {!form.activities.length ? <p className="rounded-lg border border-dashed border-blue-300 bg-white p-3 text-center text-sm text-slate-500">Puedes agregar una o varias actividades.</p> : null}
            </div>
          </section>
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
