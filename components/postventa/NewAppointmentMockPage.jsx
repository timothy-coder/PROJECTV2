"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  Paperclip,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { hasPerm } from "@/lib/permissions";

const DAYS = [
  ["lu", "ma", "mi", "ju", "vi", "sa", "do"],
  ["1", "2", "3", "4", "5", "6", "7"],
  ["8", "9", "10", "11", "12", "13", "14"],
  ["15", "16", "17", "18", "19", "20", "21"],
  ["22", "23", "24", "25", "26", "27", "28"],
  ["29", "30", "", "", "", "", ""],
];

const HOURS = [
  "07:00 - 07:30",
  "07:30 - 08:00",
  "08:00 - 08:30",
  "08:30 - 09:00",
  "09:00 - 09:30",
  "09:30 - 10:00",
  "10:00 - 10:30",
  "10:30 - 11:00",
  "11:00 - 11:30",
  "11:30 - 12:00",
  "12:00 - 12:30",
  "12:30 - 13:00",
  "13:00 - 13:30",
  "13:30 - 14:00",
  "14:00 - 14:30",
  "14:30 - 15:00",
  "15:00 - 15:30",
  "15:30 - 16:00",
  "16:00 - 16:30",
  "16:30 - 17:00",
  "17:00 - 17:30",
  "17:30 - 18:00",
  "18:00 - 18:30",
  "18:30 - 19:00",
];

export default function NewAppointmentMockPage({ userPermissions }) {
  const [selectedHour, setSelectedHour] = useState("17:30 - 18:00");
  const canView = Boolean(hasPerm(userPermissions, ["citas_nueva", "view"]));

  if (!canView) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ingresar a Nueva cita de PostVenta.</div>;
  }

  return (
    <div className="min-h-full bg-[#f7f7f8] p-1 text-slate-700">
      <div className="min-h-[calc(100vh-8px)] overflow-hidden rounded-lg border border-slate-300 bg-white">
        <header className="flex h-16 items-center justify-between px-20">
          <h1 className="text-base font-extrabold text-black">Nueva cita</h1>
          <div className="flex items-center gap-4">
            <button type="button" className="grid size-8 place-items-center text-blue-500">
              <Paperclip className="size-4" />
            </button>
            <button type="button" className="grid size-8 place-items-center text-slate-400">
              <History className="size-4" />
            </button>
            <Button className="h-8 w-36 rounded-full bg-slate-200 text-[10px] font-extrabold text-slate-500 hover:bg-slate-300">Cancelar</Button>
            <Button className="h-8 w-36 rounded-full bg-emerald-300 text-[10px] font-extrabold text-white hover:bg-emerald-400">Crear cita</Button>
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-76px)] grid-cols-[1fr_410px]">
          <main className="px-20 pb-8">
            <StepHeader number="1" title="Seleccione un cliente" />
            <section className="space-y-4 border-b border-slate-200 pb-7">
              <SelectLike placeholder="Busque y seleccione el cliente por nombre, celular, placas o VIN" full />
              <div className="grid grid-cols-5 gap-2">
                <Field label="Nombre del cliente" required placeholder="Nombre" />
                <Field label="Apellidos" optional placeholder="Apellidos" />
                <Field label="Celular" required placeholder="Celular" />
                <Field label="Correo electronico" optional placeholder="Correo electronico" />
                <Field label="Identificacion fiscal" optional placeholder="Identificacion fiscal" />
              </div>
              <SelectLike placeholder="Busque o cree un vehiculo" full muted />
              <div className="grid grid-cols-6 gap-2">
                <Field label="Placas" optional placeholder="Placas" />
                <Field label="VIN" optional placeholder="VIN" />
                <SelectField label="Marca" placeholder="Marca" />
                <SelectField label="Modelo" placeholder="Modelo" />
                <SelectField label="Ano" placeholder="Ano" />
                <Field label="Color" optional placeholder="Color" />
              </div>
            </section>

            <StepHeader number="2" title="Seleccione el motivo de visita" required />
            <section className="space-y-3 border-b border-slate-200 pb-8">
              <SelectField className="w-[220px]" placeholder="Seleccione el motivo de visita" />
              <button type="button" className="inline-flex h-8 w-[480px] items-center justify-center gap-2 rounded border border-blue-500 bg-white text-[11px] font-extrabold text-blue-400">
                <Plus className="size-4" />
                Agregar otro motivo de visita
              </button>
            </section>

            <div className="relative">
              <StepHeader number="3" title="Seleccione la hora y fecha de la cita" />
              <p className="absolute right-[180px] top-7 text-[11px] font-extrabold text-blue-600">Miercoles, 03 de Junio 2026 / 17:30:00</p>
            </div>
            <section className="grid grid-cols-[230px_1fr] gap-9 pt-9">
              <div>
                <LabelText required>Seleccione la fecha</LabelText>
                <CalendarCard />
              </div>
              <div>
                <LabelText required>Seleccione el Asesor de Servicio a cargo</LabelText>
                <SelectLike placeholder="Cualquier Asesor de Servicio" className="mb-6 h-8 max-w-[420px]" />
                <LabelText required muted>Seleccione la hora</LabelText>
                <div className="flex max-w-[920px] flex-wrap gap-2">
                  {HOURS.map((hour) => (
                    <button
                      type="button"
                      key={hour}
                      onClick={() => setSelectedHour(hour)}
                      className={`h-7 min-w-[86px] rounded-full border px-3 text-[11px] font-bold transition ${
                        selectedHour === hour
                          ? "border-blue-500 bg-blue-500 text-white"
                          : hour === "18:00 - 18:30" || hour === "18:30 - 19:00"
                            ? "border-blue-500 bg-white text-blue-500"
                            : "border-slate-300 bg-white text-slate-400"
                      }`}
                    >
                      {hour}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </main>

          <aside className="border-l border-slate-200 bg-[#f6f6f6] px-3 py-6">
            <div className="space-y-5">
              <p className="text-[11px] text-slate-700">Persona que agenda: <b>Josimar Pariona</b></p>
              <SideField label="Numero de cita" required placeholder="Se asigna de forma automatica" dot />
              <SideSelect label="Origen de cita" placeholder="Seleccione un origen" />
              <div className="flex items-center gap-2 border-b border-slate-200 pb-5">
                <span className="relative h-4 w-8 rounded-full bg-slate-300">
                  <span className="absolute left-0.5 top-0.5 size-3 rounded-full bg-white" />
                </span>
                <span className="text-[11px] font-extrabold text-slate-800">Servicio de valet</span>
              </div>
              <SideDate label="Fecha promesa" placeholder="DD/MM/YY" />
              <SideTime label="Hora promesa" placeholder="Selecciona una hora" />
              <NoteField label="Notas visibles para el cliente" />
              <NoteField label="Notas internas" />
              <div className="pt-2">
                <p className="text-xs font-extrabold text-slate-700">Archivos adjuntos</p>
                <p className="mt-3 text-xs text-slate-500">Sin archivos adjuntos</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function StepHeader({ number, title, required = false }) {
  return (
    <div className="flex items-center gap-3 pb-6 pt-7">
      <span className="text-base font-extrabold text-blue-600">PASO {number}</span>
      <span className="text-xs font-extrabold text-slate-800">
        {title} {required ? <span className="text-blue-500">*</span> : null}
      </span>
    </div>
  );
}

function LabelText({ children, required = false, muted = false }) {
  return (
    <p className={`mb-3 text-[11px] font-extrabold ${muted ? "text-slate-400" : "text-slate-700"}`}>
      {children} {required ? <span className="text-blue-500">*</span> : null}
    </p>
  );
}

function Field({ label, required = false, optional = false, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold text-slate-400">
        {label} {required ? <span className="text-blue-500">*</span> : null} {optional ? <span>(opcional)</span> : null}
      </span>
      <input className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-[11px] outline-none focus:border-blue-500" placeholder={placeholder} />
    </label>
  );
}

function SelectField({ label, placeholder, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label ? <span className="mb-1 block text-[10px] font-bold text-slate-400">{label}</span> : null}
      <span className="flex h-7 w-full items-center justify-between rounded border border-slate-300 bg-white px-2 text-[11px] text-slate-400">
        {placeholder}
        <ChevronDown className="size-3 text-slate-700" />
      </span>
    </label>
  );
}

function SelectLike({ placeholder, full = false, muted = false, className = "" }) {
  return (
    <div className={`flex h-7 items-center justify-between rounded border border-slate-300 bg-white px-2 text-[11px] ${muted ? "text-slate-400" : "text-slate-500"} ${full ? "w-full" : ""} ${className}`}>
      <span>{placeholder}</span>
      <ChevronDown className="size-3 text-slate-600" />
    </div>
  );
}

function CalendarCard() {
  return (
    <div className="w-[230px] rounded-lg bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.10)]">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800">junio 2026</span>
        <div className="flex gap-4 text-slate-300">
          <ChevronLeft className="size-4" />
          <ChevronRight className="size-4" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-4 text-center text-[10px] text-slate-400">
        {DAYS.flat().map((day, index) => (
          <span key={`${day}-${index}`} className={`mx-auto grid size-6 place-items-center rounded-full ${day === "3" ? "bg-blue-400 font-extrabold text-white" : ""}`}>
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}

function SideField({ label, required = false, placeholder, dot = false }) {
  return (
    <label className="relative block">
      <span className="mb-2 block text-[10px] font-bold text-slate-600">
        {label} {required ? <span className="text-blue-500">*</span> : null}
      </span>
      <input disabled placeholder={placeholder} className="h-8 w-full rounded border border-slate-300 bg-white px-3 text-[11px] text-slate-400" />
      {dot ? <span className="absolute right-[-2px] top-[31px] size-2 rounded-full bg-blue-500" /> : null}
    </label>
  );
}

function SideSelect({ label, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold text-slate-700">{label}</span>
      <span className="flex h-8 items-center justify-between rounded border border-slate-300 bg-white px-3 text-[11px] text-slate-700">
        {placeholder}
        <ChevronDown className="size-4" />
      </span>
    </label>
  );
}

function SideDate({ label, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold text-slate-700">{label}</span>
      <span className="flex h-8 items-center justify-between rounded border border-slate-300 bg-white px-3 text-[11px] text-slate-500">
        {placeholder}
        <CalendarDays className="size-4 text-blue-500" />
      </span>
    </label>
  );
}

function SideTime({ label, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold text-slate-700">{label}</span>
      <span className="flex h-8 items-center justify-between rounded border border-slate-300 bg-white px-3 text-[11px] text-slate-500">
        {placeholder}
        <Clock3 className="size-4 text-slate-500" />
      </span>
    </label>
  );
}

function NoteField({ label }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold text-slate-700">{label}</span>
      <span className="flex h-8 items-center justify-between rounded border border-slate-300 bg-white px-3 text-[11px] text-slate-400">
        Anadir nota
        <Plus className="size-4 text-slate-600" />
      </span>
    </label>
  );
}
