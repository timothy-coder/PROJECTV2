"use client";

import { useState } from "react";
import { Calendar, Copy, Eye, FileText, Gift, Link, MessageSquare, MoreVertical, Package, Pencil, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useOpportunityDetail } from "@/hooks/opportunities/useOpportunityDetail";
import { hasPerm } from "@/lib/permissions";

export default function OpportunityDetailPage({ id }) {
  const { data, loading, save } = useOpportunityDetail(id);
  const [dialog, setDialog] = useState({ type: "", item: null });
  const [activity, setActivity] = useState("");
  if (loading || !data) return <div className="p-4">Cargando...</div>;
  const { opportunity, stages, details, activities, interest, quotes, testDrives, closures, reservations, options, currentUser } = data;
  const currentIndex = stages.findIndex((stage) => stage.id === opportunity.etapaId);
  const progress = Math.round(((currentIndex + 1) / Math.max(stages.length, 1)) * 100);
  const temperature = stages.slice(0, currentIndex + 1).reduce((sum, stage) => sum + Number(stage.temp || 0), 0);
  const newStage = stages.find((stage) => stage.nombre.toLowerCase() === "nuevo");
  return (
    <TooltipProvider>
      <div className="min-h-full bg-slate-50 p-3 text-slate-950 sm:p-4">
        <header className="sticky top-0 z-40 mb-4 border-b border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex justify-between"><div><h1 className="text-3xl font-bold">{opportunity.clienteNombre}</h1><p className="text-sm text-slate-500">{opportunity.code}</p></div><Button variant="ghost" size="icon" onClick={() => history.back()}>×</Button></div>
          <div className="flex min-w-0 overflow-x-auto pb-2">{stages.map((stage, index) => <div key={stage.id} className="flex items-center"><span className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold ${index <= currentIndex ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{index <= currentIndex ? "✓ " : ""}{stage.nombre}</span>{index < stages.length - 1 ? <span className={`h-0.5 w-8 ${index < currentIndex ? "bg-emerald-400" : "bg-slate-300"}`} /> : null}</div>)}</div>
        </header>
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-bold">Temperatura</h2><p className="text-4xl font-bold">{temperature}%</p><div className="mt-3 h-8 rounded-lg bg-orange-500 text-center text-sm font-bold leading-8 text-white">Caliente</div></section>
          <section className="rounded-lg bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-bold">Progreso</h2><div className="h-3 rounded-full bg-slate-200"><div className="h-3 rounded-full bg-blue-600" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-right font-bold">{progress}%</p>{currentUser.canViewAll && newStage ? <Button variant="outline" className="mt-3 w-full border-orange-400 text-orange-600" onClick={() => save({ action: "stage", etapaId: newStage.id, skipAutoAttention: true })}><RotateCcw className="size-4" />Devolver al Inicio</Button> : null}</section>
        </div>
        <InfoSection opportunity={opportunity} />
        <AgendaSection details={details} />
        <section className="my-4 rounded-lg border border-blue-200 bg-blue-50 p-4"><h2 className="mb-3 flex gap-2 font-bold"><MessageSquare className="size-5" />Registrar nueva actividad</h2><Textarea value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Describe que accion se realizo..." /><Button className="mt-3 w-full" onClick={async () => { if (activity) { await save({ action: "activity", detalle: activity }); setActivity(""); } }}>Guardar actividad</Button></section>
        <History activities={activities} />
        <InterestSection items={interest} onOpen={(item) => setDialog({ type: "interest", item })} onQuote={(item) => setDialog({ type: "quote", item })} onDelete={(item) => save({ action: "interest", deleteId: item.id })} />
        <QuotesSection items={quotes} options={options} userPermissions={currentUser.permissions || {}} onOpen={() => setDialog({ type: "quote", item: null })} onEdit={(item) => setDialog({ type: "quote", item })} onAction={save} />
        <ReservationsSection items={reservations || []} onDelete={(item) => save({ action: "reservation-delete", reservaId: item.id })} />
        <TestDriveSection items={testDrives} onOpen={() => setDialog({ type: "testdrive", item: null })} />
        <ClosureSection items={closures} onOpen={() => setDialog({ type: "closure", item: null })} />
        {dialog.type === "interest" ? <InterestDialog state={dialog} clientId={opportunity.clienteId} options={options} onClose={() => setDialog({ type: "", item: null })} onSubmit={(payload) => save({ action: "interest", ...payload })} /> : null}
        {dialog.type === "quote" ? <QuoteDialog state={dialog} options={options} onClose={() => setDialog({ type: "", item: null })} onSubmit={(payload) => save({ action: "quote", ...payload })} /> : null}
        {dialog.type === "testdrive" ? <TestDriveDialog options={options} onClose={() => setDialog({ type: "", item: null })} onSubmit={(payload) => save({ action: "testdrive", ...payload })} /> : null}
        {dialog.type === "closure" ? <ClosureDialog options={options} onClose={() => setDialog({ type: "", item: null })} onSubmit={(payload) => save({ action: "closure", ...payload })} /> : null}
      </div>
    </TooltipProvider>
  );
}

function InfoSection({ opportunity }) {
  const rows = [["CLIENTE", opportunity.clienteNombre], ["CODIGO", opportunity.code], ["ORIGEN", opportunity.origenNombre], ["SUBORIGEN", opportunity.suborigenNombre || "-"], ["ASIGNADO A", opportunity.asignadoNombre], ["CORREO", opportunity.email || "-"], ["TELEFONO", opportunity.telefono || "-"], ["CELULAR", opportunity.celular || "-"], ["DNI", opportunity.dni || "-"]];
  return <section className="mb-4 rounded-lg bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-bold">Informacion General</h2><div className="grid gap-4 md:grid-cols-3">{rows.map(([k, v]) => <div key={k}><p className="text-xs font-bold text-slate-500">{k}</p><p>{v}</p></div>)}</div></section>;
}
function AgendaSection({ details }) { return <section className="mb-4 rounded-lg bg-white p-5 shadow-sm"><h2 className="mb-4 flex gap-2 text-lg font-bold"><Calendar className="size-5" />Detalles de Agenda</h2><div className="space-y-2">{details.map((d) => <div key={d.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="font-bold">{d.fechaAgenda}</p><p>{d.horaAgenda}</p></div>)}</div></section>; }
function History({ activities }) { return <section className="mb-4 rounded-lg bg-white p-5 shadow-sm"><h2 className="mb-3 font-bold">Historial ({activities.length})</h2><div className="space-y-2">{activities.length ? activities.map((a) => <Tooltip key={a.id}><TooltipTrigger className="w-full"><div className="w-full rounded border bg-white p-3 text-left">{a.detalle}</div></TooltipTrigger><TooltipContent>{a.userName} - {new Date(a.createdAt).toLocaleString("es-PE")}</TooltipContent></Tooltip>) : <div className="w-full rounded border border-dashed p-6 text-center text-slate-500">No hay actividades</div>}</div></section>; }
function InterestSection({ items, onOpen, onQuote, onDelete }) { return <section className="mb-4 rounded-lg bg-white p-5 shadow-sm"><div className="mb-4 flex justify-between"><h2 className="text-lg font-bold">Vehiculos de Interes</h2><Button onClick={() => onOpen(null)}><Plus className="size-4" />Agregar</Button></div>{items.map((item) => <div key={item.id} className="flex justify-between rounded-lg border p-3"><div><p className="font-bold">{item.marca} {item.modelo}</p><p className="text-sm text-slate-500">{item.anio_interes || "-"}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => onQuote(item)}>Cotizar</Button><Button variant="outline" onClick={() => onOpen(item)}>Editar</Button><Button variant="destructive" onClick={() => onDelete(item)}><Trash2 className="size-4" /></Button></div></div>)}</section>; }

function ReservationsSection({ items, onDelete }) {
  return (
    <section className="mb-4 rounded-lg bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><FileText className="size-5" />Reservas</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div>
              <p className="font-bold text-emerald-800">Reserva creada el {new Date(item.createdAt).toLocaleDateString("es-PE")}</p>
              <p className="text-xs font-medium text-emerald-700">ID: {item.id} - {item.estado}</p>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="outline" className="border-emerald-300 text-emerald-700" onClick={() => window.open(`/reservas/${item.id}`, "_blank")}><Eye className="size-4" /></Button>
              <Button size="icon" variant="destructive" onClick={() => onDelete(item)}><Trash2 className="size-4" /></Button>
            </div>
          </div>
        ))}
        {!items.length ? <div className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">No hay reservas creadas.</div> : null}
      </div>
    </section>
  );
}

function QuotesSection({ items, options, userPermissions, onOpen, onEdit, onAction }) {
  const [actionMenu, setActionMenu] = useState(null);
  const [itemsDialog, setItemsDialog] = useState(null);
  const [viewsDialog, setViewsDialog] = useState(null);
  const [tcDialog, setTcDialog] = useState(null);
  const [tcValue, setTcValue] = useState("");
  const canFord = hasPerm(userPermissions, ["cotizacion_ford", "view"]);
  const canOther = hasPerm(userPermissions, ["cotizacion_otros", "view"]);
  function downloadQuotePdf(quote, full = false, format = "ford", tc = "") {
    const link = document.createElement("a");
    const params = new URLSearchParams();
    if (full) params.set("full", "1");
    if (format === "otros") params.set("format", "otros");
    if (format === "otros" && tc) params.set("tc", tc);
    link.href = `/api/cotizacion-preview/${quote.id}/ford-pdf${params.toString() ? `?${params.toString()}` : ""}`;
    link.download = `${format === "otros" ? "cotizacion-otros" : "cotizacion"}${full ? "-completa" : ""}-${quote.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  function requestOtherPdf(quote, full = false) {
    setTcValue("");
    setTcDialog({ quote, full });
  }
  function confirmOtherPdf() {
    if (!tcValue.trim()) return;
    downloadQuotePdf(tcDialog.quote, tcDialog.full, "otros", tcValue.trim());
    setTcDialog(null);
  }
  async function publicLink(quote) {
    if (!quote.publicUrl) await onAction({ action: "quote-public-link", cotizacionId: quote.id });
    else window.open(quote.publicUrl, "_blank", "noopener,noreferrer");
  }
  async function copyLink(quote) {
    if (quote.publicUrl) await navigator.clipboard.writeText(`${window.location.origin}${quote.publicUrl}`);
  }
  return (
    <section className="mb-4 rounded-lg bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex gap-2 text-lg font-bold"><FileText className="size-5" />Cotizaciones</h2>
        <Button onClick={onOpen}><Plus className="size-4" />Agregar</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-600">
            <tr>
              <th className="px-3 py-3">Numero</th>
              <th>Marca Modelo y Version</th>
              <th>Estado</th>
              <th>Fecha de creacion</th>
              <th>Vistas</th>
              <th>Previsualizacion</th>
              <th>Enlace Publico</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((q) => (
              <tr key={q.id} className={q.estado === "enviada" ? "bg-emerald-50" : "bg-white"}>
                <td className="px-3 py-3 font-bold text-blue-700">{q.number || `Q-${String(q.id).padStart(6, "0")}`}</td>
                <td>{q.marca} {q.modelo} {q.version}</td>
                <td><span className="rounded-full border bg-slate-50 px-2 py-1 text-xs font-bold">{q.estado}</span></td>
                <td>{new Date(q.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td><Button size="sm" variant="ghost" onClick={() => setViewsDialog(q)}><Eye className="size-4" />{q.totalViews || 0} vistas</Button></td>
                <td><Button size="icon" variant="ghost" onClick={() => window.open(`/cotizacion-preview/${q.id}`, "_blank")}><Eye className="size-4 text-violet-700" /></Button></td>
                <td>{q.publicUrl ? <Button size="sm" variant="ghost" onClick={() => publicLink(q)}><Link className="size-4 text-emerald-700" />Abrir</Button> : <Button size="sm" variant="outline" onClick={() => publicLink(q)}>Generar enlace</Button>}</td>
                <td className="px-3 py-3 text-right">
                  <Button size="icon" variant="outline" onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setActionMenu({ quote: q, top: Math.min(rect.bottom + 6, window.innerHeight - 360), left: Math.max(rect.right - 230, 8) });
                  }}><MoreVertical className="size-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {actionMenu ? (
        <QuoteActionsMenu
          state={actionMenu}
          onClose={() => setActionMenu(null)}
          onEdit={() => onEdit(actionMenu.quote)}
          onAccessory={() => setItemsDialog({ type: "accessory", quote: actionMenu.quote })}
          onGift={() => setItemsDialog({ type: "gift", quote: actionMenu.quote })}
          onReserve={() => onAction({ action: "quote-reserve", cotizacionId: actionMenu.quote.id })}
          onDuplicate={() => onAction({ action: "quote-duplicate", cotizacionId: actionMenu.quote.id })}
          onPreview={() => window.open(`/cotizacion-preview/${actionMenu.quote.id}`, "_blank")}
          canFord={canFord}
          canOther={canOther}
          onPdf={() => downloadQuotePdf(actionMenu.quote)}
          onFullPdf={() => downloadQuotePdf(actionMenu.quote, true)}
          onOtherPdf={() => requestOtherPdf(actionMenu.quote, false)}
          onOtherFullPdf={() => requestOtherPdf(actionMenu.quote, true)}
          onLink={() => actionMenu.quote.publicUrl ? copyLink(actionMenu.quote) : publicLink(actionMenu.quote)}
          onCancel={() => onAction({ action: "quote-cancel", cotizacionId: actionMenu.quote.id })}
        />
      ) : null}
      {itemsDialog ? (
        <QuoteItemsDialog
          state={itemsDialog}
          options={options}
          onClose={() => setItemsDialog(null)}
          onSubmit={(payload) => onAction(payload)}
        />
      ) : null}
      {viewsDialog ? <QuoteViewsDialog quote={viewsDialog} onClose={() => setViewsDialog(null)} /> : null}
      <Dialog open={Boolean(tcDialog)} onOpenChange={(open) => !open && setTcDialog(null)}>
        <DialogContent className="max-w-sm bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Tipo de cambio</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="opportunity-quote-tc">TC para cotizacion otros</Label>
            <Input id="opportunity-quote-tc" value={tcValue} onChange={(event) => setTcValue(event.target.value)} placeholder="3.55" autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTcDialog(null)}>Cancelar</Button>
            <Button type="button" disabled={!tcValue.trim()} onClick={confirmOtherPdf}>Descargar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function QuoteViewsDialog({ quote, onClose }) {
  const views = quote.viewHistory || [];
  const lastView = views[0];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Historial de Aperturas</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-bold text-blue-700">Total de Aperturas</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-3xl font-bold text-blue-900">{views.length}</p>
              <Eye className="size-10 text-blue-200" />
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold text-emerald-700">Ultima Apertura</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-emerald-900">{lastView ? formatDateTime(lastView.fechaHora) : "-"}</p>
              <Calendar className="size-10 text-emerald-200" />
            </div>
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-bold">Detalles de aperturas:</h3>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {views.map((view, index) => (
              <div key={`${view.fechaHora}-${index}`} className={`rounded-lg border bg-white p-3 ${index % 2 === 0 ? "border-violet-200 bg-violet-50" : "border-slate-200"}`}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold text-slate-500">Fecha y Hora</p>
                    <p className="text-sm font-medium">{formatDateTime(view.fechaHora)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">Dispositivo</p>
                    <p className="text-sm font-medium">{deviceLabel(view.userAgent)}</p>
                    {view.ipAddress ? <p className="text-xs text-slate-500">IP: {view.ipAddress}</p> : null}
                  </div>
                </div>
              </div>
            ))}
            {!views.length ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">Sin aperturas registradas.</div> : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deviceLabel(userAgent = "") {
  const ua = String(userAgent);
  const browser = ua.includes("Edg/") ? "Edge" : ua.includes("Firefox/") ? "Firefox" : ua.includes("Chrome/") ? "Chrome" : ua.includes("Safari/") ? "Safari" : "Navegador";
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "Movil" : "Escritorio";
  return `${device} - ${browser}`;
}

function QuoteActionsMenu({ state, onClose, onEdit, onAccessory, onGift, onReserve, onDuplicate, onPreview, canFord, canOther, onPdf, onFullPdf, onOtherPdf, onOtherFullPdf, onLink, onCancel }) {
  const quote = state.quote;
  function run(action) {
    action();
    onClose();
  }
  return (
    <>
      <button type="button" aria-label="Cerrar menu" className="fixed inset-0 z-[90] cursor-default" onClick={onClose} />
      <div className="fixed z-[100] max-h-[min(340px,calc(100svh-1rem))] w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white text-slate-950 shadow-xl" style={{ top: state.top, left: state.left }}>
        <ActionButton icon={Pencil} label="Modificar" onClick={() => run(onEdit)} />
        <ActionButton icon={Package} label="Agregar Accesorios" onClick={() => run(onAccessory)} />
        <ActionButton icon={Gift} label="Agregar Regalos" onClick={() => run(onGift)} />
        <ActionButton icon={Send} label="Enviar Nota de Pedido" onClick={() => run(onReserve)} />
        <ActionButton icon={Copy} label="Duplicar" onClick={() => run(onDuplicate)} />
        <ActionButton icon={Eye} label="Ver cotizacion" onClick={() => run(onPreview)} />
        {canFord ? <ActionButton icon={FileText} label="Descargar PDF" onClick={() => run(onPdf)} /> : null}
        {canFord ? <ActionButton icon={FileText} label="Cotizacion + ficha tecnica" onClick={() => run(onFullPdf)} /> : null}
        {canOther ? <ActionButton icon={FileText} label="Descargar PDF" onClick={() => run(onOtherPdf)} /> : null}
        {canOther ? <ActionButton icon={FileText} label="Cotizacion + ficha tecnica" onClick={() => run(onOtherFullPdf)} /> : null}
        <ActionButton icon={Link} label={quote.publicUrl ? "Compartir enlace" : "Generar enlace publico"} onClick={() => run(onLink)} />
        <ActionButton icon={Trash2} label="Cancelar" danger onClick={() => run(onCancel)} />
      </div>
    </>
  );
}

function ActionButton({ icon: Icon, label, danger, onClick }) {
  return <button type="button" className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-100 ${danger ? "text-red-600" : "text-slate-700"}`} onClick={onClick}><Icon className="size-4" />{label}</button>;
}

function QuotePreview({ quote, onClose }) {
  const vehicleDiscount = Number(quote.descuento_vehículo || 0) + (Number(quote.precio_base || 0) * Number(quote.descuento_vehículo_porcentaje || 0) / 100);
  const finalVehicle = Number(quote.precio_base || 0) - vehicleDiscount;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-5xl overflow-y-auto bg-white text-slate-950">
        <DialogHeader><DialogTitle>Resumen de Cotizacion</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <section className="rounded-lg border border-violet-200 bg-violet-50 p-4">
            <h3 className="mb-3 font-bold text-violet-700">Informacion General - Vehiculo</h3>
            <div className="grid gap-4 md:grid-cols-4"><Info label="Marca" value={quote.marca} /><Info label="Modelo" value={quote.modelo} /><Info label="Version" value={quote.version} /><Info label="Anio" value={quote.anio || "-"} /><Info label="Color Ext." value={quote.color_externo || "-"} /><Info label="Color Int." value={quote.color_interno || "-"} /><Info label="SKU" value={quote.sku || "N/A"} /><Info label="Estado" value={quote.estado} /></div>
          </section>
          <section className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <h3 className="mb-3 font-bold text-orange-800">Precio del Vehiculo</h3>
            <div className="grid gap-3 md:grid-cols-3"><Info label="Modelo/Version" value={`${quote.modelo} ${quote.version}`} /><Info label="Precio" value={`$${Number(quote.precio_base || 0).toFixed(2)}`} /><Info label="Precio final" value={`$${finalVehicle.toFixed(2)}`} /></div>
          </section>
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="mb-3 font-bold text-emerald-800">Resumen General</h3>
            <p className="text-4xl font-bold text-emerald-700">${finalVehicle.toFixed(2)}</p>
          </section>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cerrar</Button><Button onClick={() => window.print()}>Descargar PDF</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }) {
  return <div><p className="text-xs font-bold text-slate-500">{label}</p><p className="font-bold">{value}</p></div>;
}

function QuoteItemsDialog({ state, options, onClose, onSubmit }) {
  const isAccessory = state.type === "accessory";
  const quote = state.quote;
  const rows = isAccessory
    ? (options.accessories || []).filter((item) => Number(item.marca_id) === Number(quote.marca_id) && Number(item.modelo_id) === Number(quote.modelo_id))
    : (options.gifts || []);
  const [selected, setSelected] = useState({});
  const totalSelected = Object.values(selected).filter((row) => row.checked).length;
  const title = isAccessory ? "Gestionar Accesorios" : "Gestionar Regalos";
  async function submit() {
    const rowsToSave = Object.values(selected).filter((row) => row.checked);
    for (const row of rowsToSave) {
      await onSubmit({
        action: isAccessory ? "quote-add-accessory" : "quote-add-gift",
        cotizacionId: quote.id,
        [isAccessory ? "accesorioId" : "regaloId"]: row.id,
        cantidad: row.cantidad || 1,
        descuentoMonto: row.descuentoMonto || 0,
      });
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-5xl overflow-y-auto bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>{title} - Cotizacion {quote.number}</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-bold text-slate-600">Vehiculo</p>
          <p className="font-bold">{quote.marca} {quote.modelo} {quote.version}</p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-3">Sel.</th>
                <th>Detalle</th>
                <th>{isAccessory ? "N Parte" : "Lote"}</th>
                <th>Precio Unit.</th>
                <th>Cant.</th>
                <th>Descuento</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const current = selected[row.id] || {};
                const unit = Number((isAccessory ? row.precio_venta ?? row.precio : row.precio_venta ?? row.precio_compra) || 0);
                const qty = Number(current.cantidad || 1);
                const discount = Number(current.descuentoMonto || 0);
                const total = Math.max(unit * qty - discount, 0);
                return (
                  <tr key={row.id}>
                    <td className="px-3 py-3"><Input className="size-4" type="checkbox" checked={Boolean(current.checked)} onChange={(e) => setSelected((old) => ({ ...old, [row.id]: { ...current, id: row.id, checked: e.target.checked } }))} /></td>
                    <td className="font-bold">{row.detalle}</td>
                    <td>{isAccessory ? row.numero_parte : row.lote || "-"}</td>
                    <td>${unit.toFixed(2)}</td>
                    <td><Input className="w-20" type="number" min="1" value={current.cantidad || 1} onChange={(e) => setSelected((old) => ({ ...old, [row.id]: { ...current, id: row.id, cantidad: e.target.value, checked: current.checked ?? true } }))} /></td>
                    <td><Input className="w-24" type="number" min="0" value={current.descuentoMonto || 0} onChange={(e) => setSelected((old) => ({ ...old, [row.id]: { ...current, id: row.id, descuentoMonto: e.target.value, checked: current.checked ?? true } }))} /></td>
                    <td className="font-bold text-blue-700">${total.toFixed(2)}</td>
                  </tr>
                );
              })}
              {!rows.length ? <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={7}>No hay registros disponibles.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
          <Button disabled={!totalSelected} onClick={async () => { await submit(); onClose(); }}>Agregar {totalSelected} {isAccessory ? "Accesorio(s)" : "Regalo(s)"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestDriveSection({ items, onOpen }) { return <section className="mb-4 rounded-lg bg-white p-5 shadow-sm"><div className="mb-4 flex justify-between"><h2 className="text-lg font-bold">Test Drive</h2><Button onClick={onOpen}><Plus className="size-4" />Programar</Button></div>{items.map((t) => <div key={t.id} className="rounded border p-3">{t.fecha_testdrive} {t.hora_inicio} - {t.modelo || ""} ({t.estado})</div>)}</section>; }
function ClosureSection({ items, onOpen }) { return <section className="mb-4 rounded-lg bg-white p-5 shadow-sm"><div className="mb-4 flex justify-between"><h2 className="text-lg font-bold">Cierres</h2><Button variant="destructive" onClick={onOpen}><Plus className="size-4" />Registrar cierre</Button></div>{items.map((c) => <div key={c.id} className="rounded border p-3">{c.detalle}</div>)}</section>; }

function InterestDialog({ state, clientId, options, onClose, onSubmit }) { const [form, setForm] = useState({ id: state.item?.id, clientId, marcaId: state.item?.marca_id || "", modeloId: state.item?.modelo_id || "", anioInteres: state.item?.anio_interes || "" }); const brands = options.brands.map((b) => ({ value: b.id, label: b.name })); const models = options.models.filter((m) => !form.marcaId || m.marca_id === Number(form.marcaId)).map((m) => ({ value: m.id, label: m.name })); return <BaseDialog title="Vehiculo de interes" onClose={onClose} onSubmit={() => onSubmit(form)}><Field label="Marca"><SearchableSelect value={form.marcaId} options={brands} onChange={(v) => setForm((f) => ({ ...f, marcaId: v, modeloId: "" }))} /></Field><Field label="Modelo"><SearchableSelect value={form.modeloId} options={models} onChange={(v) => setForm((f) => ({ ...f, modeloId: v }))} /></Field><Field label="Año"><Input value={form.anioInteres} onChange={(e) => setForm((f) => ({ ...f, anioInteres: e.target.value }))} /></Field></BaseDialog>; }
function QuoteDialog({ options, onClose, onSubmit, state }) { const item = state?.item; const isQuote = Boolean(item?.precio_id || item?.precio_base); const [form, setForm] = useState({ id: isQuote ? item.id : undefined, marcaId: item?.marca_id ? String(item.marca_id) : "", modeloId: item?.modelo_id ? String(item.modelo_id) : "", precioId: item?.precio_id ? String(item.precio_id) : "", anio: item?.anio_interes || item?.anio || "", sku: item?.sku || "", colorExterno: item?.color_externo || "", colorInterno: item?.color_interno || "", discountMode: Number(item?.descuento_vehículo || 0) > 0 ? "amount" : "percentage", descuentoVehiculo: item?.descuento_vehículo || 0, descuentoVehiculoPorcentaje: item?.descuento_vehículo_porcentaje || 0 }); const brandOptions = [...new Map(options.prices.map((p) => [p.marca_id, { value: p.marca_id, label: p.marca }])).values()]; const modelOptions = [...new Map(options.prices.filter((p) => !form.marcaId || p.marca_id === Number(form.marcaId)).map((p) => [p.modelo_id, { value: p.modelo_id, label: p.modelo }])).values()]; const versionOptions = options.prices.filter((p) => (!form.marcaId || p.marca_id === Number(form.marcaId)) && (!form.modeloId || p.modelo_id === Number(form.modeloId))).map((p) => ({ value: p.id, label: p.version })); const payload = { ...form, descuentoVehiculo: form.discountMode === "amount" ? form.descuentoVehiculo : 0, descuentoVehiculoPorcentaje: form.discountMode === "percentage" ? form.descuentoVehiculoPorcentaje : 0 }; return <BaseDialog title={isQuote ? "Modificar cotizacion" : "Nueva cotizacion"} wide onClose={onClose} onSubmit={() => onSubmit(payload)}><div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4"><div className="grid gap-4 md:grid-cols-[1fr_1fr_180px]"><div className="space-y-3"><h3 className="font-bold">Selecciona un vehiculo</h3><Field label="Marca"><SearchableSelect value={form.marcaId} options={brandOptions} onChange={(v) => setForm((f) => ({ ...f, marcaId: v, modeloId: "", precioId: "" }))} /></Field><Field label="Modelo"><SearchableSelect value={form.modeloId} options={modelOptions} onChange={(v) => setForm((f) => ({ ...f, modeloId: v, precioId: "" }))} /></Field><Field label="Año"><Input value={form.anio} onChange={(e) => setForm((f) => ({ ...f, anio: e.target.value }))} /></Field><Field label="Version"><SearchableSelect value={form.precioId} options={versionOptions} onChange={(v) => setForm((f) => ({ ...f, precioId: v }))} /></Field></div><div className="space-y-3"><h3 className="font-bold">Detalles</h3><Field label="SKU"><Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} /></Field><Field label="Color externo"><Input value={form.colorExterno} onChange={(e) => setForm((f) => ({ ...f, colorExterno: e.target.value }))} /></Field><Field label="Color interno"><Input value={form.colorInterno} onChange={(e) => setForm((f) => ({ ...f, colorInterno: e.target.value }))} /></Field></div><div className="flex min-h-56 items-center justify-center rounded-xl bg-slate-100 p-5 text-center font-bold text-slate-700">Vista<br />previa</div></div></div><div className="mt-5 border-t pt-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Descuento del vehiculo</h3><label className="flex items-center gap-2 text-sm"><span>%</span><Switch checked={form.discountMode === "amount"} onCheckedChange={(checked) => setForm((f) => ({ ...f, discountMode: checked ? "amount" : "percentage" }))} /><span>{form.discountMode === "amount" ? "Monto ($)" : "Porcentaje (%)"}</span></label></div>{form.discountMode === "amount" ? <Field label="Descuento en monto ($)"><Input type="number" value={form.descuentoVehiculo} onChange={(e) => setForm((f) => ({ ...f, descuentoVehiculo: e.target.value }))} /></Field> : <Field label="Descuento en porcentaje (%)"><Input type="number" value={form.descuentoVehiculoPorcentaje} onChange={(e) => setForm((f) => ({ ...f, descuentoVehiculoPorcentaje: e.target.value }))} /></Field>}</div></BaseDialog>; }
function TestDriveDialog({ options, onClose, onSubmit }) { const [form, setForm] = useState({ fechaTestdrive: "", horaInicio: "", horaFin: "", modeloId: "", vin: "", placa: "", descripcion: "", estado: "programado" }); const models = options.models.map((m) => ({ value: m.id, label: m.name })); return <BaseDialog title="Programar Test Drive" onClose={onClose} onSubmit={() => onSubmit(form)}><Field label="Fecha"><Input type="date" value={form.fechaTestdrive} onChange={(e) => setForm((f) => ({ ...f, fechaTestdrive: e.target.value }))} /></Field><Field label="Hora inicio"><Input type="time" value={form.horaInicio} onChange={(e) => setForm((f) => ({ ...f, horaInicio: e.target.value }))} /></Field><Field label="Hora fin"><Input type="time" value={form.horaFin} onChange={(e) => setForm((f) => ({ ...f, horaFin: e.target.value }))} /></Field><Field label="Modelo"><SearchableSelect value={form.modeloId} options={models} onChange={(v) => setForm((f) => ({ ...f, modeloId: v }))} /></Field><Field label="Placa"><Input value={form.placa} onChange={(e) => setForm((f) => ({ ...f, placa: e.target.value }))} /></Field><Field label="VIN"><Input value={form.vin} onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))} /></Field><Field label="Descripcion"><Textarea value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></Field></BaseDialog>; }
function ClosureDialog({ options, onClose, onSubmit }) { const [form, setForm] = useState({ detalle: "", cierreDetalleId: "" }); const opts = [{ value: "", label: "Sin clasificacion" }, ...options.closeOptions.map((o) => ({ value: o.id, label: o.detalle }))]; return <BaseDialog title="Registrar Cierre" onClose={onClose} onSubmit={() => onSubmit(form)}><Field label="Detalle del cierre"><Textarea value={form.detalle} onChange={(e) => setForm((f) => ({ ...f, detalle: e.target.value }))} /></Field><Field label="Clasificacion"><SearchableSelect value={form.cierreDetalleId} options={opts} onChange={(v) => setForm((f) => ({ ...f, cierreDetalleId: v }))} /></Field></BaseDialog>; }
function BaseDialog({ title, children, onClose, onSubmit, wide }) { return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className={`${wide ? "max-w-4xl" : "max-w-lg"} max-h-[92svh] overflow-y-auto bg-white text-slate-950`}><form onSubmit={(e) => { e.preventDefault(); onSubmit(); onClose(); }} className="space-y-3"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>{children}<DialogFooter className="sticky bottom-0 border-t bg-white pt-3"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Guardar</Button></DialogFooter></form></DialogContent></Dialog>; }
function Field({ label, children }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }
