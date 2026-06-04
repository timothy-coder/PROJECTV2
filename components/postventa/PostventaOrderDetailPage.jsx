"use client";

import { useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Clock3,
  Download,
  FolderOpen,
  Grid3X3,
  Image as ImageIcon,
  List,
  Menu,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { hasPerm } from "@/lib/permissions";

export default function PostventaOrderDetailPage({ id, userPermissions }) {
  const [activeTab, setActiveTab] = useState("general");
  const canView = Boolean(hasPerm(userPermissions, ["ordenespv", "view"]) || hasPerm(userPermissions, ["ordenespv", "viewall"]));

  if (!canView) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver el detalle de orden.</div>;
  }

  return (
    <div className="min-h-full bg-[#f7f7f8] text-slate-700">
      <TopBar id={id} />
      <div className="bg-amber-400 px-6 py-4 text-center text-[11px] font-bold text-white">
        Su cuenta tiene un saldo vencido. Envie su comprobante a <span className="underline">cobranza@clearcheck.us</span> para evitar que su cuenta sea suspendida. Obtenga hasta 20% de descuento con pago anticipado anual.
      </div>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1210px] items-center justify-between">
          <nav className="flex h-[44px] items-center gap-8 text-xs font-bold">
            <DetailTab active={activeTab === "general"} onClick={() => setActiveTab("general")}>Informacion general</DetailTab>
            <DetailTab active={activeTab === "quote"} onClick={() => setActiveTab("quote")}>Cotizacion</DetailTab>
            <DetailTab active={activeTab === "evidence"} onClick={() => setActiveTab("evidence")}>Evidencia</DetailTab>
          </nav>
          <div className="flex items-center gap-3">
            <ActionIcon icon={FolderOpen} />
            <ActionIcon icon={RotateCcw} />
            <ActionIcon icon={Printer} />
            <Button className="h-8 rounded-full border border-blue-600 bg-white px-5 text-xs font-bold text-blue-600 hover:bg-blue-50">
              <MessageSquare className="size-4" />
              Enviar
              <ChevronDown className="size-3" />
            </Button>
            <Button className="h-8 rounded-full border border-blue-600 bg-white px-5 text-xs font-bold text-blue-600 hover:bg-blue-50">
              <Phone className="size-4" />
              Llamar
              <ChevronDown className="size-3" />
            </Button>
            <Button className="h-8 rounded-full border border-blue-600 bg-white px-7 text-xs font-bold text-blue-600 hover:bg-blue-50">Cerrar</Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1210px] pb-10 pt-4">
        <section className="overflow-hidden rounded border border-slate-300 bg-white">
          <SummaryStrip />
          {activeTab === "quote" ? <QuoteTab /> : null}
          {activeTab === "general" ? <GeneralInfoTab /> : null}
          {activeTab === "evidence" ? <EvidenceTab /> : null}
        </section>
      </main>
    </div>
  );
}

function DetailTab({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`h-full border-b-2 px-1 ${active ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600"}`}>
      {children}
    </button>
  );
}

function TopBar({ id }) {
  return (
    <header className="flex h-[34px] items-center justify-between border-b border-slate-200 bg-white px-3">
      <div className="flex min-w-0 items-center gap-3">
        <Menu className="size-4 shrink-0 text-slate-400" />
        <div className="truncate text-xs text-slate-500">
          <span className="text-lg font-extrabold text-slate-500">Detalle de Orden #{id}</span>
          <span className="mx-1">/</span>
          <span>FRANCO PAYANO HINOSTROZA</span>
          <span className="mx-1">/</span>
          <span>Ford Ranger</span>
          <span className="mx-1">/</span>
          <span>A8FBR01G3SJ412879</span>
          <span className="mx-1">/ -- /</span>
          <span>Trabajando ahora</span>
          <span className="mx-1">/</span>
          <span>Mantenimiento Preventivo</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <RoundButton icon={Bell} alert />
        <RoundButton icon={MessageSquare} alert />
        <RoundButton icon={MoreVertical} />
      </div>
    </header>
  );
}

function SummaryStrip() {
  return (
    <div className="grid grid-cols-6 border-b border-slate-300 px-7 py-4 text-[11px]">
      <SummaryItem label="Cita" value="3975" />
      <div>
        <p className="font-extrabold text-slate-900">Evidencias</p>
        <p className="mt-2 flex items-center gap-2 text-slate-500">
          <ImageIcon className="size-3" /> 3 <Truck className="size-3" /> 2 <Phone className="size-3" /> 0
        </p>
      </div>
      <div>
        <p className="font-extrabold text-slate-900">Vistas</p>
        <p className="mt-2 flex items-center gap-2 text-slate-500">
          <ImageIcon className="size-3" /> 0 <Bell className="size-3" /> 0
        </p>
      </div>
      <SummaryItem label="Ultima comunicacion" value="Cargado, Hace 2 horas" />
      <SummaryItem label="Orden digital" value="https://veh.imobi/9p2RYD" />
      <SummaryItem label="Cargado" value="03/06/26 02:38 pm" subLabel="Ultima actualizacion" subValue="03/06/26 04:15 pm" />
    </div>
  );
}

function SummaryItem({ label, value, subLabel, subValue }) {
  return (
    <div>
      <p className="font-extrabold text-slate-900">{label}</p>
      <p className="mt-2 text-slate-500">{value}</p>
      {subLabel ? <p className="mt-2 font-extrabold text-slate-900">{subLabel}</p> : null}
      {subValue ? <p className="mt-2 text-slate-500">{subValue}</p> : null}
    </div>
  );
}

function GeneralInfoTab() {
  return (
    <div className="grid grid-cols-3 gap-6 px-7 py-7">
      <ClientColumn />
      <VehicleColumn />
      <OrderColumn />
    </div>
  );
}

function QuoteTab() {
  return (
    <div className="min-h-[540px]">
      <div className="flex items-center justify-between border-b border-slate-100 px-7 py-5">
        <button type="button" className="inline-flex h-8 w-[150px] items-center justify-between rounded-full border border-blue-600 bg-white px-4 text-[11px] font-extrabold text-blue-600">
          Mostrar todos los puntos
          <ChevronDown className="size-4" />
        </button>
        <div className="flex items-center gap-5 text-[11px] text-slate-500">
          <label className="inline-flex items-center gap-2">
            Mostrar cotizacion a cliente
            <span className="size-3 rounded-sm border border-slate-300 bg-white" />
          </label>
          <ActionIcon icon={CalendarDays} />
          <ActionIcon icon={Grid3X3} muted />
          <ActionIcon icon={List} />
          <ActionIcon icon={Download} />
          <ActionIcon icon={Paperclip} />
          <ActionIcon icon={Send} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="w-[52%] px-7 py-4 font-extrabold uppercase">Trabajos y puntos de inspeccion</th>
              <th className="w-[32%] px-4 py-4 font-extrabold uppercase">Comentarios</th>
              <th className="w-[8%] px-4 py-4 text-right font-extrabold uppercase">Subtotal</th>
              <th className="w-[8%] px-4 py-4 text-center font-extrabold uppercase">Aprobado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-7 py-3 text-[11px] font-extrabold text-slate-800">Sistema: Otros</td>
              <td className="border-l border-slate-100" />
              <td className="border-l border-slate-100" />
              <td className="border-l border-slate-100" />
            </tr>
            {QUOTE_POINTS.map((point) => (
              <QuotePointRow key={point} text={point} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-b border-slate-200 px-7 py-5">
        <button type="button" className="inline-flex h-8 w-[120px] items-center justify-between rounded-full border border-blue-600 bg-white px-4 text-[11px] font-extrabold text-blue-600">
          Agregar punto
          <Plus className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_250px] gap-10 px-7 py-7">
        <div className="space-y-8">
          <QuoteNote label="Notas visibles para el cliente" />
          <QuoteNote label="Notas internas" />
        </div>
        <QuoteTotals />
      </div>
    </div>
  );
}

const QUOTE_POINTS = [
  "amortiguadores, ver recorrido, fuga de fluido y estado de gomas.",
  "Odometro",
  "Nivel de Combustible",
  "Video inventario Interior",
  "Video Inventario Exterior",
  "Video inventario motor",
];

function QuotePointRow({ text }) {
  return (
    <tr className="h-8 border-b border-slate-100">
      <td className="bg-slate-50 px-7">
        <div className="grid grid-cols-[20px_24px_24px_24px_1fr] items-center gap-3">
          <Plus className="size-4 text-blue-600" />
          <span className="size-4 rounded-full bg-emerald-400" />
          <ImageIcon className="size-4 text-blue-600" />
          <span className="text-blue-600">●</span>
          <span className="text-[11px] font-semibold text-slate-500">{text}</span>
        </div>
      </td>
      <td className="border-l border-slate-100 bg-white px-4" />
      <td className="border-l border-slate-100 bg-white px-4 text-right font-bold text-slate-700">
        S/0,00 <ChevronDown className="ml-1 inline size-3 text-blue-600" />
      </td>
      <td className="border-l border-slate-100 bg-white px-4" />
    </tr>
  );
}

function QuoteNote({ label }) {
  return (
    <div>
      <p className="mb-2 text-base font-extrabold text-slate-600">{label}</p>
      <span className="flex h-8 w-40 items-center rounded border border-slate-400 bg-white px-3 text-[11px] text-slate-500">
        <span className="flex-1">Agregar nota</span>
        <Plus className="size-4 text-slate-600" />
      </span>
    </div>
  );
}

function QuoteTotals() {
  return (
    <div className="text-[11px] font-extrabold">
      <div className="space-y-3 border-b border-slate-400 pb-5">
        <TotalLine label="Descuentos:" value="-0%" editable />
        <TotalLine label="Subtotal:" value="S/0,00" />
        <TotalLine label="Impuestos:" value="S/0,00" />
        <TotalLine label="TOTAL:" value="S/0,00" />
      </div>
      <div className="mt-5 space-y-3">
        <TotalLine label="Aprobado:" value="S/0,00" />
        <TotalLine label="Rechazado:" value="S/0,00" />
        <TotalLine label="Pendiente:" value="S/0,00" />
        <TotalLine label="TOTAL:" value="S/0,00" />
      </div>
    </div>
  );
}

function TotalLine({ label, value, editable = false }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-slate-800">{label}</span>
      <span className="text-blue-600">
        {value}
        {editable ? <span className="ml-2 text-blue-600">✎</span> : null}
      </span>
    </div>
  );
}

function EvidenceTab() {
  return (
    <div className="min-h-[760px]">
      <div className="flex items-center justify-between border-b border-slate-300 px-7 py-4">
        <div className="flex items-center gap-4 text-[11px] font-extrabold">
          <button type="button" className="rounded bg-slate-100 px-4 py-2 text-slate-700">Toda la evidencia</button>
          <button type="button" className="px-1 py-2 text-slate-700">Fotos</button>
          <button type="button" className="px-1 py-2 text-slate-700">Videos</button>
        </div>
        <Button className="h-8 rounded-full border border-blue-600 bg-white px-8 text-xs font-extrabold text-blue-600 hover:bg-blue-50">
          <Download className="size-4" />
          Descargar
        </Button>
      </div>
      <div className="space-y-9 px-7 py-5">
        {EVIDENCE_ITEMS.map((item) => (
          <EvidenceItem key={item.title} item={item} />
        ))}
      </div>
    </div>
  );
}

const EVIDENCE_ITEMS = [
  { title: "Odometro", count: "1 elemento", type: "screen" },
  { title: "Nivel de Combustible", count: "1 elemento", type: "fuel" },
  { title: "Video inventario Interior", count: "1 elemento", type: "seat", duration: "00:40" },
  { title: "Video Inventario Exterior", count: "1 elemento", type: "grille", duration: "01:00" },
  { title: "Video inventario motor", count: "1 elemento", type: "engine", duration: "00:35" },
];

function EvidenceItem({ item }) {
  return (
    <section>
      <label className="mb-4 flex items-center gap-3 text-[11px]">
        <span className="size-3 rounded-sm border border-slate-400 bg-white" />
        <span className="font-extrabold text-slate-800">{item.title}</span>
        <span className="text-[10px] text-slate-400">{item.count}</span>
      </label>
      <div className="relative h-[122px] w-[174px] overflow-hidden rounded-lg bg-slate-200 shadow-sm">
        <EvidencePreview type={item.type} />
        {item.duration ? <span className="absolute bottom-2 right-2 rounded bg-black px-1.5 py-0.5 text-[10px] font-extrabold text-white">{item.duration}</span> : null}
      </div>
    </section>
  );
}

function EvidencePreview({ type }) {
  const base = "absolute inset-0";
  if (type === "screen") {
    return (
      <div className={`${base} bg-[radial-gradient(circle_at_60%_25%,#ff8a3d_0_3%,transparent_4%),linear-gradient(120deg,#1f2937,#111827_35%,#4b5563_52%,#0f172a)]`}>
        <div className="absolute left-12 top-8 h-14 w-20 rounded bg-blue-500/70 blur-[1px]" />
        <div className="absolute left-16 top-12 text-2xl font-bold text-white">0</div>
        <div className="absolute bottom-0 left-0 h-7 w-full bg-black/35" />
      </div>
    );
  }
  if (type === "fuel") {
    return (
      <div className={`${base} bg-[linear-gradient(115deg,#475569,#020617_38%,#111827_55%,#6b7280)]`}>
        <div className="absolute left-0 top-5 h-20 w-16 bg-blue-500/50 blur-[2px]" />
        <div className="absolute right-12 top-9 h-9 w-3 rounded-full bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.9)]" />
        <div className="absolute bottom-2 left-3 text-[9px] font-bold text-white">OK</div>
      </div>
    );
  }
  if (type === "seat") {
    return (
      <div className={`${base} bg-[radial-gradient(circle_at_30%_20%,#f4d0a5,transparent_25%),linear-gradient(125deg,#4b2f24,#c4a58f_48%,#32231d)]`}>
        <div className="absolute right-6 top-2 h-28 w-16 rotate-6 rounded-full bg-stone-300/60 blur-[2px]" />
      </div>
    );
  }
  if (type === "grille") {
    return (
      <div className={`${base} bg-[linear-gradient(180deg,#cbd5e1,#a8a29e_42%,#1f2937_44%,#475569_57%,#111827)]`}>
        <div className="absolute left-4 top-48 h-0" />
        <div className="absolute left-8 top-54 h-0" />
        <div className="absolute left-8 top-11 h-3 w-32 rounded bg-slate-700/70" />
        <div className="absolute left-10 top-17 h-4 w-28 rounded bg-black/50" />
      </div>
    );
  }
  return (
    <div className={`${base} bg-[radial-gradient(circle_at_50%_50%,#9ca3af,transparent_25%),linear-gradient(135deg,#0f172a,#374151,#111827)]`}>
      <div className="absolute left-8 top-8 size-16 rounded-full border-8 border-slate-500/70" />
      <div className="absolute right-6 bottom-5 h-8 w-20 rounded bg-slate-300/40 blur-[1px]" />
    </div>
  );
}

function ClientColumn() {
  return (
    <section>
      <SectionTitle title="Informacion del cliente" />
      <h2 className="mt-5 text-lg font-extrabold text-slate-800">
        FRANCO PAYANO HINOSTROZA <button className="ml-2 text-[10px] font-extrabold text-blue-600">(Cambiar cliente)</button>
      </h2>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <InputField label="Nombre" value="FRANCO" />
          <InputField label=" " value="PAYANO HINOSTROZA" />
        </div>
        <InputField label="Correo" value="Payano.hinostroza@gmail.com" />
        <InputField label="Telefono" placeholder="Ingrese el telefono" />
        <InputField label="Celular" value="982 914-141" />
        <InputField label="Razon social" placeholder="Ingrese el nombre comercial" />
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <SelectField label="Documento de identificacion" value="Tipo de documento" />
          <InputField label=" " placeholder="Numero de identificacion" />
        </div>
        <SignatureBox label="Firma de Recepcion" />
        <SignatureBox label="Firma de Entrega" />
        <SignatureBox label="Firma del contrato de adhesion" />
        <SignatureBox label="Firma del contrato de aviso de privacidad" />
        <ToggleText title="Notificaciones de citas" text="El cliente recibira notificaciones por WhatsApp automaticos como: citas, recordatorios, etc." />
        <ToggleText title="Envios masivos" text="El cliente recibira mensajes de envios masivos por WhatsApp." />
      </div>
    </section>
  );
}

function VehicleColumn() {
  return (
    <section>
      <SectionTitle title="Informacion del vehiculo" />
      <h2 className="mt-5 text-lg font-extrabold text-slate-800">
        Ford Ranger <button className="ml-2 text-[10px] font-extrabold text-blue-600">(Cambiar vehiculo)</button>
      </h2>
      <div className="mt-4 space-y-4">
        <SelectField label="Marca" value="Ford" withDot />
        <SelectField label="Modelo" value="Ranger" />
        <SelectField label="Ano" value="Seleccione un ano" />
        <InputField label="VIN" value="A8FBR01G3SJ412879" />
        <InputField label="Kilometraje" value="23.297" />
        <InputField label="Placas" value="H3N879" />
      </div>
    </section>
  );
}

function OrderColumn() {
  return (
    <section>
      <SectionTitle title="Informacion de la Orden" />
      <div className="mt-5 space-y-4">
        <SelectField value="Etapa: Trabajando ahora" />
        <InputField label="Torre" placeholder="Ingrese torre" />
        <SelectField label="Tipo de Orden" value="Mantenimiento Preventivo" withGreenDot />
        <div>
          <Label>Fecha y hora promesa de entrega</Label>
          <div className="grid grid-cols-2 gap-3">
            <IconInput placeholder="DD/MM/YY" icon={CalendarDays} />
            <IconInput placeholder="" icon={Clock3} />
          </div>
        </div>
        <SelectField label="Asignado a" value="LP - Leonardo Ponce Figueroa" />
        <SelectField label="Asesor de Servicio" value="WA - WALDIR ATAUPILLCO HUGO" withRedDot />
        <SelectField label="Tecnico" value="Leonardo Ponce Figueroa" />
        <InfoText label="Motivos de visita del cliente" value="Sin motivos de visita del cliente" />
        <AddLine label="Motivos de visita del taller" placeholder="Agregar motivo" />
        <AddLine label="Notas visibles para el cliente" placeholder="Anadir nota" />
        <AddLine label="Notas internas" placeholder="Anadir nota" />
      </div>
    </section>
  );
}

function SectionTitle({ title }) {
  return (
    <div className="border-b-2 border-slate-900 pb-2 text-[11px] font-extrabold text-slate-900">
      {title}
    </div>
  );
}

function Label({ children }) {
  return <label className="mb-1 block text-[11px] font-extrabold text-slate-700">{children}</label>;
}

function InputField({ label, value = "", placeholder = "" }) {
  return (
    <label className="block">
      {label ? <Label>{label}</Label> : null}
      <input value={value} readOnly placeholder={placeholder} className="h-8 w-full rounded border border-slate-400 bg-white px-3 text-[11px] text-slate-800 outline-none" />
    </label>
  );
}

function SelectField({ label, value, withDot = false, withGreenDot = false, withRedDot = false }) {
  return (
    <label className="block">
      {label ? <Label>{label}</Label> : null}
      <span className="flex h-8 w-full items-center gap-2 rounded border border-slate-400 bg-white px-3 text-[11px] text-slate-800">
        {withDot ? <span className="h-2 w-5 rounded-full bg-blue-800" /> : null}
        {withGreenDot ? <span className="size-2 rounded-full bg-emerald-300" /> : null}
        {withRedDot ? <span className="size-2 rounded-full bg-red-700" /> : null}
        <span className="flex-1">{value}</span>
        <ChevronDown className="size-4 text-slate-700" />
      </span>
    </label>
  );
}

function IconInput({ placeholder, icon: Icon }) {
  return (
    <span className="flex h-8 items-center rounded border border-slate-400 bg-white px-3 text-[11px] text-slate-500">
      <span className="flex-1">{placeholder}</span>
      <Icon className="size-4 text-blue-500" />
    </span>
  );
}

function SignatureBox({ label }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div className="h-[62px] rounded border border-slate-400 bg-white" />
    </label>
  );
}

function ToggleText({ title, text }) {
  return (
    <div className="flex gap-3">
      <span className="relative mt-1 h-3 w-7 rounded-full bg-blue-600">
        <span className="absolute right-0 top-0 size-3 rounded-full bg-white shadow" />
      </span>
      <div>
        <p className="text-[11px] font-extrabold text-slate-700">{title}</p>
        <p className="max-w-[330px] text-[10px] text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function InfoText({ label, value }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="text-[11px] text-slate-500">{value}</p>
    </div>
  );
}

function AddLine({ label, placeholder }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <span className="flex h-8 items-center rounded border border-slate-400 bg-white px-3 text-[11px] text-slate-500">
        <span className="flex-1">{placeholder}</span>
        <Plus className="size-4 text-slate-600" />
      </span>
    </label>
  );
}

function ActionIcon({ icon: Icon }) {
  return (
    <button type="button" className="grid size-7 place-items-center rounded-full text-blue-600 transition hover:bg-blue-50">
      <Icon className="size-4" />
    </button>
  );
}

function RoundButton({ icon: Icon, alert = false }) {
  return (
    <button type="button" className="relative grid size-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50">
      <Icon className="size-4" />
      {alert ? <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" /> : null}
    </button>
  );
}
