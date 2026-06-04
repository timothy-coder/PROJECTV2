"use client";

import { useState } from "react";
import { Calendar, Car, Copy, FileText, Link2, MessageSquare, Pencil, RotateCcw, Save, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePostventaOpportunityDetail } from "@/hooks/postventa/usePostventaOpportunityDetail";
import { usePostventaQuotes } from "@/hooks/postventaquotes/usePostventaQuotes";
import { QuoteForm } from "@/components/postventaquotes/PostventaQuotesPage";

export default function PostventaOpportunityDetailPage({ id }) {
  const { data, loading, save, createAppointment, updateAppointment } = usePostventaOpportunityDetail(id);
  const [activity, setActivity] = useState("");
  const [agenda, setAgenda] = useState({ fechaAgenda: "", horaAgenda: "" });
  const [editingActivity, setEditingActivity] = useState(null);
  const [quoteType, setQuoteType] = useState("taller");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [createdQuote, setCreatedQuote] = useState(null);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const quoteData = usePostventaQuotes(quoteType);

  if (loading || !data) return <div className="p-4">Cargando...</div>;

  const { opportunity, stages, details, activities, appointments = [], appointmentOptions = {}, closings = [], closures = [], currentUser } = data;
  const currentIndex = stages.findIndex((stage) => Number(stage.id) === Number(opportunity.etapaId));
  const progress = Math.round(((Math.max(currentIndex, 0) + 1) / Math.max(stages.length, 1)) * 100);
  const temperature = stages.slice(0, currentIndex + 1).reduce((sum, stage) => sum + Number(stage.temp || 0), 0);
  const newStage = stages.find((stage) => stage.nombre?.toLowerCase() === "nuevo");
  const isClosed = String(opportunity.etapaNombre || "").toLowerCase().includes("cerrad");

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
        <QuoteSection
          canCreate={currentUser.canCreateQuote}
          createdQuote={createdQuote}
          onCopy={copyCreatedQuoteLink}
          onOpen={() => setQuoteOpen(true)}
          quoteType={quoteType}
          setQuoteType={setQuoteType}
        />
        <AgendaSection details={details} agenda={agenda} setAgenda={setAgenda} onSubmit={addAgenda} />
        <AppointmentSection
          appointments={appointments}
          canCreate={Boolean(currentUser.canCreateAppointment)}
          onCreate={() => setAppointmentOpen(true)}
          onEdit={setEditingAppointment}
        />
        <CloseSection
          closures={closures}
          isClosed={isClosed}
          onOpen={() => setCloseOpen(true)}
        />

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

        <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
          <DialogContent className="max-h-[94svh] w-[min(98vw,1180px)] max-w-none overflow-y-auto bg-slate-50 p-0 text-slate-950">
            <QuoteForm
              tipo={quoteType}
              options={quoteData.options}
              currentUser={quoteData.currentUser}
              initial={{
                clienteId: opportunity.clienteId,
                descripcion: `Cotizacion ${quoteType === "pyp" ? "PYP" : "Taller"} para ${opportunity.code} - ${opportunity.vehiculoNombre}`,
              }}
              onCancel={() => setQuoteOpen(false)}
              onSubmit={async (payload) => {
                const result = await quoteData.createQuote({
                  ...payload,
                  clienteId: payload.clienteId || opportunity.clienteId,
                  descripcion: payload.descripcion || `Cotizacion para ${opportunity.code}`,
                });
                const link = result.token ? `${window.location.origin}/cotizacion-posventa/${result.token}` : "";
                setCreatedQuote({ id: result.id, token: result.token, link });
                setQuoteOpen(false);
                if (link) await navigator.clipboard?.writeText(link);
                toast.success(link ? "Cotizacion creada y enlace publico copiado" : "Cotizacion creada");
              }}
            />
          </DialogContent>
        </Dialog>
        {appointmentOpen ? (
          <AppointmentDialog
            opportunity={opportunity}
            options={appointmentOptions}
            onClose={() => setAppointmentOpen(false)}
            onSubmit={async (payload) => {
              const result = await createAppointment(payload);
              setAppointmentOpen(false);
              toast.success("Cita de PostVenta creada");
              if (result?.id) window.location.href = `/citaspv?id=${result.id}`;
            }}
          />
        ) : null}
        {editingAppointment ? (
          <AppointmentDialog
            opportunity={opportunity}
            options={appointmentOptions}
            initial={editingAppointment}
            onClose={() => setEditingAppointment(null)}
            onSubmit={async (payload) => {
              await updateAppointment(editingAppointment.id, payload);
              setEditingAppointment(null);
              toast.success("Cita de PostVenta actualizada");
            }}
          />
        ) : null}
        {closeOpen ? (
          <CloseOpportunityDialog
            options={closings}
            onClose={() => setCloseOpen(false)}
            onSubmit={async (payload) => {
              await save({ action: "close", ...payload });
              setCloseOpen(false);
              toast.success("Oportunidad cerrada");
            }}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );

  async function copyCreatedQuoteLink() {
    if (!createdQuote?.link) return;
    await navigator.clipboard?.writeText(createdQuote.link);
    toast.success("Enlace publico copiado");
  }
}

function CloseSection({ closures, isClosed, onOpen }) {
  return (
    <section className="mb-4 rounded-lg border border-red-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-red-800"><XCircle className="size-5" />Cierre de oportunidad</h2>
          <p className="text-sm text-slate-500">Registra el motivo de cierre y mueve la etapa a Cerrada.</p>
        </div>
        <Button type="button" variant={isClosed ? "outline" : "destructive"} onClick={onOpen}>
          {isClosed ? "Agregar cierre" : "Cerrar oportunidad"}
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {closures.map((item) => (
          <div key={item.id} className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm">
            <p className="font-bold text-red-800">{item.detalle || item.motivo || "Cierre registrado"}</p>
            {item.motivo ? <p className="text-xs text-red-700">Motivo: {item.motivo}</p> : null}
            <p className="mt-1 text-xs text-slate-500">{item.userName} - {new Date(item.createdAt).toLocaleString("es-PE")}</p>
          </div>
        ))}
        {!closures.length ? <div className="rounded-lg border border-dashed p-4 text-center text-sm text-slate-500">No hay cierre registrado.</div> : null}
      </div>
    </section>
  );
}

function CloseOpportunityDialog({ options, onClose, onSubmit }) {
  const [form, setForm] = useState({ cierreDetalleId: "", detalle: "" });
  const closeOptions = options.map((item) => ({ value: item.id, label: item.detalle }));
  const selected = options.find((item) => String(item.id) === String(form.cierreDetalleId));
  const canSave = Boolean(form.cierreDetalleId || form.detalle.trim());
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>Cerrar oportunidad</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Motivo de cierre">
            <SearchableSelect
              value={form.cierreDetalleId}
              options={closeOptions}
              placeholder="Seleccionar motivo"
              onChange={(cierreDetalleId) => {
                const nextSelected = options.find((item) => String(item.id) === String(cierreDetalleId));
                setForm((current) => ({ ...current, cierreDetalleId, detalle: current.detalle || nextSelected?.detalle || "" }));
              }}
            />
          </Field>
          <Field label="Detalle">
            <Textarea
              className="min-h-24"
              value={form.detalle}
              placeholder={selected?.detalle || "Describe el motivo de cierre..."}
              onChange={(event) => setForm((current) => ({ ...current, detalle: event.target.value }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!canSave} onClick={() => onSubmit({ ...form, detalle: form.detalle.trim() || selected?.detalle || "Cierre registrado" })}>Aplicar cierre</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuoteSection({ canCreate, createdQuote, onCopy, onOpen, quoteType, setQuoteType }) {
  return (
    <section className="mb-4 rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><FileText className="size-5" />Cotizacion de PostVenta</h2>
          <p className="text-sm text-slate-500">Crea una cotizacion de taller o PYP para este cliente y genera su enlace publico.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={quoteType}
            onChange={(event) => setQuoteType(event.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
          >
            <option value="taller">Taller</option>
            <option value="pyp">PYP</option>
          </select>
          {canCreate ? (
            <Button type="button" className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={onOpen}>
              <FileText className="size-4" />
              Agregar cotizacion
            </Button>
          ) : null}
        </div>
      </div>
      {!canCreate ? <p className="mt-3 rounded-md border border-dashed p-3 text-sm text-slate-500">No tienes permiso para crear cotizaciones.</p> : null}
      {createdQuote?.link ? (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm sm:flex-row sm:items-center">
          <Link2 className="size-4 text-emerald-700" />
          <a href={createdQuote.link} target="_blank" className="min-w-0 flex-1 truncate font-bold text-emerald-800">
            {createdQuote.link}
          </a>
          <Button type="button" variant="outline" onClick={onCopy}>
            <Copy className="size-4" />
            Copiar
          </Button>
        </div>
      ) : null}
    </section>
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

function AppointmentSection({ appointments, canCreate, onCreate, onEdit }) {
  return (
    <section className="mb-4 rounded-lg border border-violet-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex gap-2 text-lg font-bold"><Calendar className="size-5" />Citas de PostVenta</h2>
          <p className="text-sm text-slate-500">Crea o revisa la cita vinculada a esta oportunidad.</p>
        </div>
        {canCreate ? <Button type="button" className="bg-violet-700 text-white hover:bg-violet-800" onClick={onCreate}>Crear cita</Button> : null}
      </div>
      <div className="space-y-2">
        {appointments.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
            <div>
              <p className="font-bold">{item.startDate} {item.startTime} - {item.endTime}</p>
              <p className="text-xs text-slate-600">{item.centroNombre} {item.tallerNombre ? `- ${item.tallerNombre}` : ""} - {item.tipoServicio}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-violet-700">{item.estado}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => onEdit(item)}>Editar</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { window.location.href = `/citaspv?id=${item.id}`; }}>Ir a cita</Button>
            </div>
          </div>
        ))}
        {!appointments.length ? <div className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">No hay citas registradas.</div> : null}
      </div>
    </section>
  );
}

function AppointmentDialog({ opportunity, options, initial, onClose, onSubmit }) {
  const defaultCenterId = initial?.centroId || options.centers?.[0]?.id || "";
  const defaultWorkshopId = initial?.tallerId || firstWorkshopForCenter(options.workshops || [], defaultCenterId);
  const [form, setForm] = useState({
    centroId: defaultCenterId ? String(defaultCenterId) : "",
    tallerId: defaultWorkshopId ? String(defaultWorkshopId) : "",
    asesorId: initial?.asesorId ? String(initial.asesorId) : "",
    origenId: initial?.origenId || opportunity.origenId ? String(initial?.origenId || opportunity.origenId) : "",
    startDate: initial?.startDate || "",
    startTime: initial?.startTime || "",
    estado: initial?.estado || "pendiente",
    tipoServicio: initial?.tipoServicio || "TALLER",
    kilometrajeTaller: initial?.kilometrajeTaller || "",
    notaCliente: initial?.notaCliente || "",
    notaInterna: initial?.notaInterna || "",
  });
  const centerOptions = (options.centers || []).map((item) => ({ value: item.id, label: item.nombre }));
  const workshopOptions = (options.workshops || []).filter((item) => !form.centroId || Number(item.centroId) === Number(form.centroId)).map((item) => ({ value: item.id, label: item.nombre }));
  const userOptions = [{ value: "", label: "Sin asesor" }, ...(options.users || []).map((item) => ({ value: item.id, label: item.fullname }))];
  const originOptions = [{ value: "", label: "Sin origen" }, ...(options.origins || []).map((item) => ({ value: item.id, label: item.name }))];
  const isFinalized = isFinalizedStatus(form.estado);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-[min(96vw,760px)] overflow-y-auto bg-white text-slate-950">
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
          <DialogHeader>
            <DialogTitle>{initial ? "Editar cita" : "Crear cita"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Cliente"><Input disabled value={opportunity.clienteNombre || ""} /></Field>
            <Field label="Vehiculo"><Input disabled value={opportunity.vehiculoNombre || ""} /></Field>
            <Field label="Centro *"><SearchableSelect value={form.centroId} options={centerOptions} onChange={(centroId) => setForm((current) => ({ ...current, centroId, tallerId: firstWorkshopForCenter(options.workshops || [], centroId) }))} /></Field>
            <Field label="Taller"><SearchableSelect value={form.tallerId} options={workshopOptions} onChange={(tallerId) => setForm((current) => ({ ...current, tallerId }))} /></Field>
            <Field label="Asesor"><SearchableSelect value={form.asesorId} options={userOptions} onChange={(asesorId) => setForm((current) => ({ ...current, asesorId }))} /></Field>
            <Field label="Origen"><SearchableSelect value={form.origenId} options={originOptions} onChange={(origenId) => setForm((current) => ({ ...current, origenId }))} /></Field>
            <Field label="Fecha inicio *"><Input required type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} /></Field>
            <Field label="Hora inicio *"><Input required type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} /></Field>
            <Field label="Tipo servicio *"><NativeSelect value={form.tipoServicio} onChange={(event) => setForm((current) => ({ ...current, tipoServicio: event.target.value }))} options={[["TALLER", "Taller"], ["PLANCHADO_PINTURA", "Planchado y pintura"]]} /></Field>
            <Field label="Estado"><NativeSelect value={form.estado} onChange={(event) => setForm((current) => ({ ...current, estado: event.target.value }))} options={[["pendiente", "Pendiente"], ["confirmada", "Confirmada"], ["reprogramada", "Reprogramada"], ["cancelada", "Cancelada"], ["finalizada", "Finalizada"], ["orden creada", "Orden creada"], ["clientenollego", "Cliente no llego"]]} /></Field>
            {isFinalized ? <Field label="KM taller *"><Input required type="number" min="0" value={form.kilometrajeTaller} onChange={(event) => setForm((current) => ({ ...current, kilometrajeTaller: event.target.value }))} /></Field> : null}
          </div>
          <Field label="Nota cliente"><Textarea value={form.notaCliente} onChange={(event) => setForm((current) => ({ ...current, notaCliente: event.target.value }))} /></Field>
          <Field label="Nota interna"><Textarea value={form.notaInterna} onChange={(event) => setForm((current) => ({ ...current, notaInterna: event.target.value }))} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">{initial ? "Guardar cambios" : "Crear cita"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function firstWorkshopForCenter(workshops, centerId) {
  const item = workshops.find((workshop) => !centerId || Number(workshop.centroId) === Number(centerId));
  return item?.id ? String(item.id) : "";
}

function isFinalizedStatus(value) {
  return String(value || "").toLowerCase().startsWith("finalizad");
}

function NativeSelect({ value, onChange, options }) {
  return <select value={value} onChange={onChange} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400">{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>;
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
