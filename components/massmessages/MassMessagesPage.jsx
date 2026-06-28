"use client";

import { useMemo, useState } from "react";
import { Check, Circle, RefreshCw, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const campaigns = [
  { name: "dfsf", type: "Postventa", start: "Inmediato", end: "15/03/2026, 11:22 p. m.", sent: 1 },
  { name: "dsad", type: "Postventa", start: "Inmediato", end: "15/03/2026, 11:06 p. m.", sent: 1 },
  { name: "asdasd", type: "Postventa", start: "Inmediato", end: "15/03/2026, 10:10 p. m.", sent: 2 },
  { name: "sad", type: "Postventa", start: "Inmediato", end: "15/03/2026, 10:10 p. m.", sent: 1 },
  { name: "envio imagen 5", type: "Postventa", start: "Inmediato", end: "15/03/2026, 09:54 p. m.", sent: 1 },
  { name: "envio con imagen 4", type: "Postventa", start: "Inmediato", end: "15/03/2026, 09:29 p. m.", sent: 3 },
];

const brands = ["Audi", "BMW", "CHERY", "Chevrolet", "DONGFENG", "FIAT", "FORD", "MG"];
const models = ["A4", "ARRIZO 3", "ARRIZO 5", "FULWIN", "HIMLA", "M7", "RANGER", "TERRITORY"];

export default function MassMessagesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-950 sm:p-4">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-4xl">
          <h1 className="text-xl font-black leading-tight text-slate-950 sm:text-2xl">Envios masivos WhatsApp</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Campanas de WhatsApp para ventas y postventa con programacion y seguimiento.</p>
          <p className="mt-1 text-xs font-medium text-slate-500">Atenciones CTA: interacciones de clientes sobre botones de campana (contacto o detener promociones).</p>
          <p className="mt-2 text-xs font-medium text-slate-500">El boton &quot;Sincronizar intereses ventas&quot; carga/actualiza intereses desde oportunidades para que el filtro de campanas de ventas impacte al publico correcto.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="bg-white font-bold">Sincronizar intereses ventas</Button>
          <Button variant="outline" className="bg-white font-bold"><RefreshCw className="size-4" />Actualizar</Button>
          <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => setCreateOpen(true)}>Nuevo envio masivo</Button>
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-slate-950">Lista de envios masivos</h2>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[980px] table-fixed text-left text-sm">
            <thead className="border-b border-slate-200 text-xs font-black uppercase text-slate-500">
              <tr>
                <th className="w-[180px] px-3 py-3">Nombre</th>
                <th className="w-[100px]">Tipo</th>
                <th className="w-[180px]">Fecha de envio</th>
                <th className="w-[210px]">Fecha de termino</th>
                <th className="w-[170px]">Indicadores</th>
                <th className="w-[130px]">Estatus</th>
                <th className="w-[100px] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {campaigns.map((item) => (
                <tr key={item.name}>
                  <td className="px-3 py-5 font-bold">{item.name}</td>
                  <td>{item.type}</td>
                  <td>{item.start}</td>
                  <td>{item.end}</td>
                  <td className="leading-6">
                    <p>Enviados: {item.sent}</p>
                    <p>Entregados: 0</p>
                    <p>Respondieron: 0</p>
                    <p>Contacto CTA: 0</p>
                    <p>Baja CTA: 0</p>
                  </td>
                  <td>Finalizado</td>
                  <td className="text-right">
                    <Button variant="outline" className="bg-white font-bold" onClick={() => setDetailItem(item)}>Detalle</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 sm:hidden">
          {campaigns.map((item) => (
            <article key={item.name} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.type} - {item.start}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">Finalizado</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Enviados: {item.sent} - Entregados: 0 - Respondieron: 0</p>
              <Button variant="outline" className="mt-3 w-full bg-white font-bold" onClick={() => setDetailItem(item)}>Detalle</Button>
            </article>
          ))}
        </div>
      </section>

      {createOpen ? <CreateMassMessageDialog open={createOpen} onClose={() => setCreateOpen(false)} /> : null}
      {detailItem ? <DetailDialog item={detailItem} onClose={() => setDetailItem(null)} /> : null}
    </main>
  );
}

function StepHeader({ step }) {
  const items = ["Reglas de envio", "Plantilla de WhatsApp", "Vista preliminar"];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        {items.map((item, index) => {
          const number = index + 1;
          const done = step > number;
          const active = step === number;
          return (
            <div key={item} className={cn("flex items-center gap-2 text-xs font-bold", active ? "text-blue-700" : done ? "text-emerald-700" : "text-slate-500")}>
              <span className={cn("grid size-5 place-items-center rounded-full", done ? "bg-emerald-600 text-white" : active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500")}>
                {done ? <Check className="size-3" /> : active ? <Check className="size-3" /> : <Circle className="size-3" />}
              </span>
              <span className="truncate">{item}</span>
            </div>
          );
        })}
      </div>
      <div className="h-1 rounded-full bg-slate-200">
        <div className="h-1 rounded-full bg-emerald-500 transition-all" style={{ width: `${(step / 3) * 100}%` }} />
      </div>
    </div>
  );
}

function CreateMassMessageDialog({ open, onClose }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    campaignType: "postventa",
    sendType: "personalizado",
    now: true,
    templateType: "text",
    start: "Hola, [Nombre de cliente]",
    body: "Tenemos una promocion especial para su proximo servicio de mantenimiento.",
    end: "¡Estamos listos para atenderle!",
    cta: true,
  });
  const title = step === 1 ? "Reglas de envio" : step === 2 ? "Plantilla de WhatsApp" : "Vista preliminar";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[96svh] max-w-[min(96vw,980px)] overflow-hidden bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-black">Nuevo envio masivo</DialogTitle>
              <DialogDescription>{title}</DialogDescription>
            </div>
            <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}><X className="size-5" /></button>
          </div>
          <StepHeader step={step} />
        </DialogHeader>

        <div className="max-h-[calc(96svh-155px)] overflow-y-auto p-6">
          {step === 1 ? <RulesStep form={form} setForm={setForm} /> : null}
          {step === 2 ? <TemplateStep form={form} setForm={setForm} /> : null}
          {step === 3 ? <PreviewStep form={form} /> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {step > 1 ? <Button variant="outline" className="bg-white" onClick={() => setStep((current) => current - 1)}>Regresar</Button> : <Button variant="outline" className="bg-white" onClick={onClose}>Cancelar</Button>}
          {step < 3 ? (
            <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => setStep((current) => current + 1)}>Continuar</Button>
          ) : (
            <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={onClose}><Send className="size-4" />Crear envio</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RulesStep({ form, setForm }) {
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Nombre del envio *" className="md:col-span-1">
          <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ingresa el nombre de tu nuevo envio masivo" />
        </Field>
        <Field label="Tipo de campana *">
          <Select value={form.campaignType} onValueChange={(value) => setForm((current) => ({ ...current, campaignType: value }))}>
            <SelectTrigger className="w-full bg-white"><span>{form.campaignType === "postventa" ? "Postventa" : "Ventas"}</span></SelectTrigger>
            <SelectContent><SelectItem value="postventa">Postventa</SelectItem><SelectItem value="ventas">Ventas</SelectItem></SelectContent>
          </Select>
        </Field>
        <div className="flex items-end justify-end">
          <label className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium">
            <Checkbox checked={form.now} onCheckedChange={(checked) => setForm((current) => ({ ...current, now: Boolean(checked) }))} />
            Activar envio inmediato
          </label>
        </div>
        <Field label="Tipo de envio *"><Input value="Personalizado" readOnly className="text-blue-700" /></Field>
        <Field label="Canal"><Input value="WhatsApp" readOnly /></Field>
        <Field label="Ano del vehiculo"><Input placeholder="Todos los anos" /></Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <CheckList title="Marca del vehiculo (multiple)" items={brands} />
        <CheckList title="Modelo del vehiculo (multiple)" items={models} />
        <div className="rounded-lg border border-dashed bg-slate-50 p-4 text-xs text-slate-500">
          <p className="font-bold text-slate-700">Parque vehicular postventa</p>
          <p className="mt-1">Se filtra sobre vehiculos del cliente por marca/modelo/ano para mantenimiento y servicio.</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="font-bold">Clientes impactados</p>
        <p className="mt-1 text-sm text-slate-500">Total deduplicado: 6</p>
        <p className="mt-2 text-xs text-slate-500">Muestra: MICHAEL JUNIOR TOVAR MEDINA, JHONNY FERNANDEZ TORIBIO, Andre Pariona, Paul Rivera, Juan ti</p>
      </div>
    </section>
  );
}

function TemplateStep({ form, setForm }) {
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <Field label="Tipo de plantilla *">
        <div className="flex gap-4 text-sm">
          <label className="inline-flex items-center gap-2"><input type="radio" checked={form.templateType === "text"} onChange={() => setForm((current) => ({ ...current, templateType: "text" }))} />Texto</label>
          <label className="inline-flex items-center gap-2"><input type="radio" checked={form.templateType === "image"} onChange={() => setForm((current) => ({ ...current, templateType: "image" }))} />Imagen y texto</label>
        </div>
      </Field>
      <Field label="Inicio del mensaje"><Textarea rows={3} value={form.start} onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))} /></Field>
      <Field label="Texto principal *"><Textarea rows={3} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} /></Field>
      <Field label="Final del mensaje"><Textarea rows={3} value={form.end} onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))} /></Field>
      <label className="mt-4 inline-flex items-center gap-2 text-sm">
        <Checkbox checked={form.cta} onCheckedChange={(checked) => setForm((current) => ({ ...current, cta: Boolean(checked) }))} />
        Incluir botones de CTA (contacto y detener promociones)
      </label>
    </section>
  );
}

function PreviewStep({ form }) {
  const summary = useMemo(() => ({
    name: form.name || "asd",
    type: form.campaignType,
    sendType: form.sendType,
    date: form.now ? "Inmediato" : "Programado",
    impacted: 0,
  }), [form]);

  return (
    <section className="grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-2">
      <div>
        <h3 className="mb-4 font-bold">Resumen de envio</h3>
        <div className="rounded-lg border border-slate-200 p-4 text-sm">
          <p><b>Nombre:</b> {summary.name}</p>
          <p><b>Tipo:</b> {summary.type}</p>
          <p><b>Tipo de envio:</b> {summary.sendType}</p>
          <p><b>Fecha envio:</b> {summary.date}</p>
          <p><b>Impactados:</b> {summary.impacted}</p>
        </div>
      </div>
      <div>
        <h3 className="mb-4 font-bold">Vista WhatsApp</h3>
        <div className="rounded-lg border border-slate-200 bg-[#f2eee8] p-4">
          <div className="mx-auto max-w-sm rounded-lg bg-white p-4 text-xs leading-6 text-slate-700 shadow">
            <p>{form.start}</p>
            <p className="mt-4 whitespace-pre-wrap">{form.body}</p>
            <p className="mt-4">{form.end}</p>
            {form.cta ? (
              <div className="mt-4 space-y-2">
                <button type="button" className="h-7 w-full rounded border text-[11px] font-bold text-blue-700">QUIERO QUE ME CONTACTEN</button>
                <button type="button" className="h-7 w-full rounded border text-[11px] font-bold text-blue-700">DETENER PROMOCIONES</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailDialog({ item, onClose }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-[min(94vw,900px)] overflow-y-auto bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">Detalle de envio masivo</DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard lines={["Tipo: postventa", "Estado: Finalizado", "Creado por: Super Administrador", `Creado: ${item.end}`]} />
          <InfoCard title="Resumen por estado" lines={["Pendientes: 0", "En cola: 0", "Entregados: 0", "Leidos: 0", "Respondieron: 0", "Fallidos: 0"]} />
          <InfoCard title="Acciones CTA" lines={["Solicitaron contacto: 0", "Detener promociones: 0", "Acciones no mapeadas: 0", "Total acciones: 0"]} />
        </div>
        <DetailTable title="Acciones CTA recientes" headers={["Cliente", "Accion", "Telefono", "Fecha"]} empty="Sin acciones CTA registradas." />
        <DetailTable title="Destinatarios recientes" headers={["Cliente", "Telefono", "Estado", "Respondio"]} row={["Paul Rivera", "+51912528990", "Sent", "-"]} />
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }) {
  return <div className={cn("space-y-1", className)}><Label>{label}</Label>{children}</div>;
}

function CheckList({ title, items }) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold">{title}</p>
      <div className="h-36 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {items.map((item) => <label key={item} className="flex items-center gap-2 py-1 text-sm"><Checkbox />{item}</label>)}
      </div>
    </div>
  );
}

function InfoCard({ title, lines }) {
  return <div className="rounded-lg border border-slate-200 p-4 text-sm">{title ? <p className="mb-2 font-bold">{title}</p> : null}{lines.map((line) => <p key={line}>{line}</p>)}</div>;
}

function DetailTable({ title, headers, empty, row }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
      <h3 className="border-b border-slate-200 px-4 py-3 font-bold">{title}</h3>
      <table className="w-full table-fixed text-left text-sm">
        <thead className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr>
        </thead>
        <tbody>
          {row ? <tr>{row.map((cell) => <td key={cell} className="px-4 py-3">{cell}</td>)}</tr> : <tr><td colSpan={headers.length} className="px-4 py-5 text-slate-500">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
