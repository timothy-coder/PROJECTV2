"use client";

import { useState } from "react";
import { Calendar, Copy, FileText, Link2, MessageSquare, Pencil, RotateCcw, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VehicleDialog } from "@/components/clients/VehicleDialog";
import { usePostventaOpportunityDetail } from "@/hooks/postventa/usePostventaOpportunityDetail";
import { usePostventaQuotes } from "@/hooks/postventaquotes/usePostventaQuotes";
import { QuoteForm } from "@/components/postventaquotes/PostventaQuotesPage";

export default function PostventaOpportunityDetailPage({ id }) {
  const { data, loading, save, createAppointment, updateAppointment, updateClientData, updateVehicleData } = usePostventaOpportunityDetail(id);
  const [activity, setActivity] = useState("");
  const [agenda, setAgenda] = useState({ fechaAgenda: "", horaAgenda: "" });
  const [maintenance, setMaintenance] = useState({ fechaVisitaTaller: todayInputDate(), kilometrajeTaller: "" });
  const [editingActivity, setEditingActivity] = useState(null);
  const [quoteType, setQuoteType] = useState("taller");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [createdQuote, setCreatedQuote] = useState(null);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [clientEditOpen, setClientEditOpen] = useState(false);
  const [vehicleEditOpen, setVehicleEditOpen] = useState(false);
  const quoteData = usePostventaQuotes(quoteType);

  if (loading || !data) return <div className="p-4">Cargando...</div>;

  const { opportunity, stages, details, activities, appointments = [], appointmentOptions = {}, vehicleOptions = {}, closings = [], closures = [], currentUser } = data;
  const currentIndex = stages.findIndex((stage) => Number(stage.id) === Number(opportunity.etapaId));
  const temperature = stages.slice(0, currentIndex + 1).reduce((sum, stage) => sum + Number(stage.temp || 0), 0);
  const newStage = stages.find((stage) => stage.nombre?.toLowerCase() === "nuevo");
  const isClosed = String(opportunity.etapaNombre || "").toLowerCase().includes("cerrad");

  async function addActivity() {
    if (!activity.trim()) return;
    await save({ action: "activity", detalle: activity });
    setActivity("");
  }

  async function addAgenda() {
    if (!agenda.fechaAgenda || !agenda.horaAgenda) return;
    await save({ action: "agenda", ...agenda });
    setAgenda({ fechaAgenda: "", horaAgenda: "" });
  }

  async function addMaintenance() {
    if (!maintenance.fechaVisitaTaller || maintenance.kilometrajeTaller === "") {
      toast.error("Completa la fecha y el kilometraje del mantenimiento.");
      return;
    }
    await save({ action: "maintenance", ...maintenance });
    setMaintenance({ fechaVisitaTaller: todayInputDate(), kilometrajeTaller: "" });
    toast.success("Mantenimiento registrado, etapa actualizada a Cita efectiva y proximo mantenimiento recalculado");
  }

  return (
    <TooltipProvider>
      <div className="min-h-full bg-slate-50 p-3 text-slate-950 sm:p-4">
        <header className="sticky top-0 z-40 mb-3 border-b border-slate-200 bg-white p-3 shadow-sm sm:mb-4 sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-sm font-bold leading-tight sm:text-base">{opportunity.clienteNombre}</h1>
                <span className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-700">Temp. {temperature}%</span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{opportunity.code} - {opportunity.vehiculoNombre}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {currentUser.canViewAll && newStage ? (
                <Button variant="outline" size="sm" className="hidden border-orange-300 text-xs text-orange-600 sm:inline-flex" onClick={() => save({ action: "stage", etapaId: newStage.id, detalle: "Devolver al inicio" })}>
                  <RotateCcw className="size-3.5" />Inicio
                </Button>
              ) : null}
              <Button variant="ghost" size="icon" onClick={() => history.back()}>x</Button>
            </div>
          </div>
          {currentUser.canViewAll && newStage ? (
            <Button variant="outline" size="sm" className="mb-3 w-full border-orange-300 text-xs text-orange-600 sm:hidden" onClick={() => save({ action: "stage", etapaId: newStage.id, detalle: "Devolver al inicio" })}>
              <RotateCcw className="size-3.5" />Devolver al inicio
            </Button>
          ) : null}
          <div className="-mx-1 flex min-w-0 overflow-x-auto px-1 pb-1 sm:overflow-visible">
            {stages.map((stage, index) => (
              <button
                key={stage.id}
                type="button"
                className="flex shrink-0 items-center sm:flex-1 sm:shrink"
                onClick={() => save({ action: "stage", etapaId: stage.id, detalle: `Cambio de etapa a ${stage.nombre}` })}
              >
                <span className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-bold sm:w-full sm:text-center ${index <= currentIndex ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {stage.nombre}
                </span>
                {index < stages.length - 1 ? <span className={`h-0.5 w-5 shrink-0 sm:w-6 ${index < currentIndex ? "bg-emerald-400" : "bg-slate-300"}`} /> : null}
              </button>
            ))}
          </div>
        </header>

        <InfoSection
          opportunity={opportunity}
          canEdit={Boolean(currentUser.canEditOpportunity)}
          onEditClient={() => setClientEditOpen(true)}
          onEditVehicle={() => setVehicleEditOpen(true)}
        />
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <ActivitySection activity={activity} setActivity={setActivity} activities={activities} onSubmit={addActivity} onEdit={setEditingActivity} />
          <AgendaSection details={details} agenda={agenda} setAgenda={setAgenda} onSubmit={addAgenda} />
        </div>
        <MaintenanceSection maintenance={maintenance} setMaintenance={setMaintenance} onSubmit={addMaintenance} />
        <QuoteSection
          canCreate={currentUser.canCreateQuote}
          createdQuote={createdQuote}
          onCopy={copyCreatedQuoteLink}
          onOpen={() => setQuoteOpen(true)}
          quoteType={quoteType}
          setQuoteType={setQuoteType}
        />
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
                  oportunidadId: opportunity.id,
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
        {clientEditOpen ? (
          <ClientDataDialog
            opportunity={opportunity}
            onClose={() => setClientEditOpen(false)}
            onSubmit={async (payload) => {
              await updateClientData(payload);
              setClientEditOpen(false);
              toast.success("Datos del cliente actualizados");
            }}
          />
        ) : null}
        <VehicleDialog
          open={vehicleEditOpen}
          mode="edit"
          client={{
            id: opportunity.clienteId,
            nombre: opportunity.clienteNombreRaw,
            apellido: opportunity.clienteApellido,
          }}
          vehicle={{
            id: opportunity.vehiculoId,
            clienteId: opportunity.clienteId,
            placas: opportunity.placa,
            vin: opportunity.vin,
            marcaId: opportunity.marcaId,
            modeloId: opportunity.modeloId,
            anio: opportunity.anio,
            color: opportunity.color,
            kilometraje: opportunity.kilometraje,
            fechaUltimaVisita: opportunity.fechaUltimaVisita,
          }}
          options={vehicleOptions}
          onClose={() => setVehicleEditOpen(false)}
          onSubmit={async (payload) => {
            await updateVehicleData(payload);
            toast.success("Datos del vehiculo actualizados");
          }}
        />
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

function InfoSection({ opportunity, canEdit, onEditClient, onEditVehicle }) {
  const clientRows = [
    ["CLIENTE", opportunity.clienteNombre],
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
    ["KM", opportunity.kilometraje || "-"],
  ];
  const opportunityRows = [
    ["CODIGO", opportunity.code],
    ["ORIGEN", opportunity.origenNombre],
    ["SUBORIGEN", opportunity.suborigenNombre || "-"],
    ["ASIGNADO A", opportunity.asignadoNombre],
    ["CREADO POR", opportunity.creadoNombre || "-"],
  ];

  return (
    <section className="mb-3 rounded-lg bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-bold sm:text-base">Informacion General</h2>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEditClient}>
              <Pencil className="size-3.5" />Editar cliente
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onEditVehicle}>
              <Pencil className="size-3.5" />Editar vehiculo
            </Button>
          </div>
        ) : null}
      </div>
      <InfoGroup title="Datos del cliente" rows={clientRows} />
      <InfoGroup title="Datos del vehiculo" rows={vehicleRows} />
      <InfoGroup title="Datos de oportunidad" rows={opportunityRows} />
    </section>
  );
}

function InfoGroup({ title, rows }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map(([key, value]) => <InfoItem key={key} label={key} value={value} />)}
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className="truncate text-xs font-semibold text-slate-900 sm:text-sm">{value}</p>
    </div>
  );
}

function ClientDataDialog({ opportunity, onClose, onSubmit }) {
  const [form, setForm] = useState({
    nombre: opportunity.clienteNombreRaw || "",
    apellido: opportunity.clienteApellido || "",
    email: opportunity.email || "",
    celular: opportunity.celular || "",
    tipoIdentificacion: opportunity.tipoIdentificacion || "DNI",
    identificacionFiscal: opportunity.dni || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message || "No se pudo actualizar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(96vw,640px)] bg-white text-slate-950">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-violet-700">Editar datos del cliente</DialogTitle>
          </DialogHeader>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Nombre *"><Input value={form.nombre} onChange={(event) => update("nombre", event.target.value)} /></Field>
            <Field label="Apellido"><Input value={form.apellido} onChange={(event) => update("apellido", event.target.value)} /></Field>
            <Field label="Correo"><Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></Field>
            <Field label="Celular"><Input value={form.celular} onChange={(event) => update("celular", event.target.value)} /></Field>
            <Field label="Tipo documento">
              <NativeSelect
                value={form.tipoIdentificacion}
                onChange={(event) => update("tipoIdentificacion", event.target.value)}
                options={[["DNI", "DNI"], ["RUC", "RUC"], ["CE", "CE"], ["PASAPORTE", "Pasaporte"]]}
              />
            </Field>
            <Field label="Documento"><Input value={form.identificacionFiscal} onChange={(event) => update("identificacionFiscal", event.target.value)} /></Field>
          </div>
          {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActivitySection({ activity, setActivity, activities, onSubmit, onEdit }) {
  const rows = [...activities].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50 p-3 sm:p-4">
      <h2 className="mb-2 flex gap-2 text-sm font-bold text-blue-900 sm:text-base"><MessageSquare className="size-4" />Registrar nueva actividad</h2>
      <Textarea className="min-h-24 bg-white text-sm" value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="Describe que accion se realizo..." />
      <Button className="mt-2 w-full" disabled={!activity.trim()} onClick={onSubmit}>Guardar actividad</Button>
      <div className="mt-3 border-t border-blue-200 pt-3">
        <h3 className="mb-2 text-xs font-bold text-blue-900">Historial de actividades ({rows.length})</h3>
        <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
          {rows.length ? rows.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger className="w-full">
                <div className="flex w-full items-start justify-between gap-2 rounded border bg-white p-3 text-left text-sm">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap">{item.detalle}</p>
                  <Button type="button" size="icon" variant="outline" className="size-8 shrink-0" onClick={(event) => { event.preventDefault(); onEdit(item); }}>
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>{item.userName} - {formatDateTimeEs(item.createdAt)}</TooltipContent>
            </Tooltip>
          )) : <div className="w-full rounded border border-dashed bg-white p-5 text-center text-sm text-slate-500">No hay actividades</div>}
        </div>
      </div>
    </section>
  );
}

function AgendaSection({ details, agenda, setAgenda, onSubmit }) {
  const rows = [...details].sort((a, b) => new Date(b.createdAt || b.fechaAgenda || 0) - new Date(a.createdAt || a.fechaAgenda || 0));
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
      <h2 className="mb-2 flex gap-2 text-sm font-bold text-emerald-900 sm:text-base"><Calendar className="size-4" />Registrar nueva agenda</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Fecha de agenda"><Input type="date" value={agenda.fechaAgenda} onChange={(event) => setAgenda((current) => ({ ...current, fechaAgenda: event.target.value }))} /></Field>
        <Field label="Hora de agenda"><Input type="time" value={agenda.horaAgenda} onChange={(event) => setAgenda((current) => ({ ...current, horaAgenda: event.target.value }))} /></Field>
      </div>
      <Button className="mt-2 w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={!agenda.fechaAgenda || !agenda.horaAgenda} onClick={onSubmit}>Guardar agenda</Button>
      <div className="mt-3 border-t border-emerald-200 pt-3">
        <h3 className="mb-2 text-xs font-bold text-emerald-900">Historial de agenda ({rows.length})</h3>
        <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
          {rows.map((detail) => (
            <div key={detail.id} className="rounded-lg border border-emerald-200 bg-white p-3 text-sm">
              <p className="font-bold">{formatDateEs(detail.fechaAgenda)} - {formatTimeEs(detail.horaAgenda)}</p>
            </div>
          ))}
          {!rows.length ? <div className="rounded border border-dashed bg-white p-5 text-center text-sm text-slate-500">No hay agendas registradas</div> : null}
        </div>
      </div>
    </section>
  );
}

function MaintenanceSection({ maintenance, setMaintenance, onSubmit }) {
  return (
    <section className="mb-4 rounded-lg border border-amber-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900 sm:text-base">
          <Wrench className="size-4" />Agregar mantenimiento
        </h2>
        <p className="text-xs font-medium text-slate-500">
          Al guardar se marca como cita efectiva y se recalcula el proximo mantenimiento del vehiculo.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Fecha de mantenimiento *">
          <Input
            type="date"
            required
            value={maintenance.fechaVisitaTaller}
            onChange={(event) => setMaintenance((current) => ({ ...current, fechaVisitaTaller: event.target.value }))}
          />
        </Field>
        <Field label="Kilometraje *">
          <Input
            type="number"
            min="0"
            step="1"
            required
            value={maintenance.kilometrajeTaller}
            onChange={(event) => setMaintenance((current) => ({ ...current, kilometrajeTaller: event.target.value }))}
            placeholder="Ingrese kilometraje"
          />
        </Field>
        <Button type="button" className="bg-amber-600 text-white hover:bg-amber-700" disabled={!maintenance.fechaVisitaTaller || maintenance.kilometrajeTaller === ""} onClick={onSubmit}>
          <Wrench className="size-4" />Guardar
        </Button>
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

function formatDateEs(value) {
  if (!value) return "-";
  const rawValue = String(value);
  const raw = rawValue.match(/\d{4}-\d{2}-\d{2}/)?.[0] || rawValue.slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw || "-";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTimeEs(value) {
  if (!value) return "-";
  return String(value).slice(0, 5);
}

function formatDateTimeEs(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function todayInputDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
