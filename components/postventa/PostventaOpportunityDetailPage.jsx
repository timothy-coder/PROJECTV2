"use client";

import { useState } from "react";
import { Calendar, Car, MessageSquare, Pencil, RotateCcw, Save, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePostventaOpportunityDetail } from "@/hooks/postventa/usePostventaOpportunityDetail";

export default function PostventaOpportunityDetailPage({ id }) {
  const { data, loading, save } = usePostventaOpportunityDetail(id);
  const [activity, setActivity] = useState("");
  const [agenda, setAgenda] = useState({ fechaAgenda: "", horaAgenda: "" });
  const [editingActivity, setEditingActivity] = useState(null);

  if (loading || !data) return <div className="p-4">Cargando...</div>;

  const { opportunity, stages, details, activities, currentUser } = data;
  const currentIndex = stages.findIndex((stage) => Number(stage.id) === Number(opportunity.etapaId));
  const progress = Math.round(((Math.max(currentIndex, 0) + 1) / Math.max(stages.length, 1)) * 100);
  const temperature = stages.slice(0, currentIndex + 1).reduce((sum, stage) => sum + Number(stage.temp || 0), 0);
  const newStage = stages.find((stage) => stage.nombre?.toLowerCase() === "nuevo");

  async function addActivity() {
    if (!activity.trim()) return;
    await save({ action: "activity", detalle: activity });
    setActivity("");
  }

  async function addAgenda(event) {
    event.preventDefault();
    await save({ action: "agenda", ...agenda });
    setAgenda({ fechaAgenda: "", horaAgenda: "" });
  }

  return (
    <TooltipProvider>
      <div className="min-h-full bg-slate-50 p-3 text-slate-950 sm:p-4">
        <header className="sticky top-0 z-40 mb-4 border-b border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">{opportunity.clienteNombre}</h1>
              <p className="text-sm text-slate-500">{opportunity.code} - {opportunity.vehiculoNombre}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => history.back()}>x</Button>
          </div>
          <div className="flex min-w-0 overflow-x-auto pb-2">
            {stages.map((stage, index) => (
              <button
                key={stage.id}
                type="button"
                className="flex items-center"
                onClick={() => save({ action: "stage", etapaId: stage.id, detalle: `Cambio de etapa a ${stage.nombre}` })}
              >
                <span className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold ${index <= currentIndex ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {index <= currentIndex ? "✓ " : ""}{stage.nombre}
                </span>
                {index < stages.length - 1 ? <span className={`h-0.5 w-8 ${index < currentIndex ? "bg-emerald-400" : "bg-slate-300"}`} /> : null}
              </button>
            ))}
          </div>
        </header>

        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Temperatura</h2>
            <p className="text-4xl font-bold">{temperature}%</p>
            <div className="mt-3 h-8 rounded-lg bg-orange-500 text-center text-sm font-bold leading-8 text-white">PostVenta</div>
          </section>
          <section className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Progreso</h2>
            <div className="h-3 rounded-full bg-slate-200"><div className="h-3 rounded-full bg-blue-600" style={{ width: `${progress}%` }} /></div>
            <p className="mt-2 text-right font-bold">{progress}%</p>
            {currentUser.canViewAll && newStage ? (
              <Button variant="outline" className="mt-3 w-full border-orange-400 text-orange-600" onClick={() => save({ action: "stage", etapaId: newStage.id, detalle: "Devolver al inicio" })}>
                <RotateCcw className="size-4" />Devolver al Inicio
              </Button>
            ) : null}
          </section>
        </div>

        <InfoSection opportunity={opportunity} />
        <AgendaSection details={details} agenda={agenda} setAgenda={setAgenda} onSubmit={addAgenda} />

        <section className="my-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-3 flex gap-2 font-bold"><MessageSquare className="size-5" />Registrar nueva actividad</h2>
          <Textarea value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="Describe que accion se realizo..." />
          <Button className="mt-3 w-full" onClick={addActivity}><Save className="size-4" />Guardar actividad</Button>
        </section>

        <History activities={activities} onEdit={setEditingActivity} />

        {editingActivity ? (
          <ActivityDialog
            item={editingActivity}
            onClose={() => setEditingActivity(null)}
            onSubmit={async (payload) => {
              await save({ action: "activity-update", ...payload });
              setEditingActivity(null);
            }}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function InfoSection({ opportunity }) {
  const clientRows = [
    ["CLIENTE", opportunity.clienteNombre],
    ["CODIGO", opportunity.code],
    ["ORIGEN", opportunity.origenNombre],
    ["SUBORIGEN", opportunity.suborigenNombre || "-"],
    ["ASIGNADO A", opportunity.asignadoNombre],
    ["CORREO", opportunity.email || "-"],
    ["CELULAR", opportunity.celular || "-"],
    ["DNI", opportunity.dni || "-"],
  ];
  const vehicleRows = [
    ["VEHICULO", opportunity.vehiculoNombre],
    ["PLACA", opportunity.placa || "-"],
    ["VIN", opportunity.vin || "-"],
    ["ANIO", opportunity.anio || "-"],
    ["COLOR", opportunity.color || "-"],
    ["CREADO POR", opportunity.creadoNombre || "-"],
  ];

  return (
    <section className="mb-4 grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><UserRound className="size-5" />Informacion del Cliente</h2>
        <div className="grid gap-4 sm:grid-cols-2">{clientRows.map(([key, value]) => <InfoItem key={key} label={key} value={value} />)}</div>
      </div>
      <div className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Car className="size-5" />Informacion del Vehiculo</h2>
        <div className="grid gap-4 sm:grid-cols-2">{vehicleRows.map(([key, value]) => <InfoItem key={key} label={key} value={value} />)}</div>
      </div>
    </section>
  );
}

function InfoItem({ label, value }) {
  return <div><p className="text-xs font-bold text-slate-500">{label}</p><p>{value}</p></div>;
}

function AgendaSection({ details, agenda, setAgenda, onSubmit }) {
  return (
    <section className="mb-4 rounded-lg bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex gap-2 text-lg font-bold"><Calendar className="size-5" />Detalles de Agenda</h2>
      </div>
      <form onSubmit={onSubmit} className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Field label="Fecha"><Input required type="date" value={agenda.fechaAgenda} onChange={(event) => setAgenda((current) => ({ ...current, fechaAgenda: event.target.value }))} /></Field>
        <Field label="Hora"><Input required type="time" value={agenda.horaAgenda} onChange={(event) => setAgenda((current) => ({ ...current, horaAgenda: event.target.value }))} /></Field>
        <div className="flex items-end"><Button type="submit" className="w-full">Agregar</Button></div>
      </form>
      <div className="space-y-2">
        {details.map((detail) => (
          <div key={detail.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="font-bold">{detail.fechaAgenda || "-"}</p>
            <p>{detail.horaAgenda || "-"}</p>
          </div>
        ))}
        {!details.length ? <div className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">No hay agendas registradas.</div> : null}
      </div>
    </section>
  );
}

function History({ activities, onEdit }) {
  return (
    <section className="mb-4 rounded-lg bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-bold">Historial ({activities.length})</h2>
      <div className="space-y-2">
        {activities.length ? activities.map((activity) => (
          <Tooltip key={activity.id}>
            <TooltipTrigger className="w-full">
              <div className="flex w-full items-start justify-between gap-3 rounded border bg-white p-3 text-left">
                <div>
                  <p className="whitespace-pre-wrap">{activity.detalle}</p>
                  <p className="mt-2 text-xs font-bold text-slate-500">{activity.etapaNombre || "Sin etapa"}</p>
                </div>
                <Button type="button" size="icon" variant="outline" onClick={(event) => { event.preventDefault(); onEdit(activity); }}>
                  <Pencil className="size-4" />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>{activity.userName} - {new Date(activity.createdAt).toLocaleString("es-PE")}</TooltipContent>
          </Tooltip>
        )) : <div className="w-full rounded border border-dashed p-6 text-center text-slate-500">No hay actividades</div>}
      </div>
    </section>
  );
}

function ActivityDialog({ item, onClose, onSubmit }) {
  const [detalle, setDetalle] = useState(item.detalle || "");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>Editar actividad</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Detalle</Label>
          <Textarea className="min-h-36" value={detalle} onChange={(event) => setDetalle(event.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={() => onSubmit({ activityId: item.id, detalle })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1"><Label className="text-xs font-bold text-slate-700">{label}</Label>{children}</div>;
}
