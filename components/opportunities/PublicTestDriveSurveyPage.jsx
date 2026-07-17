"use client";

import { useEffect, useState } from "react";
import { Frown, Meh, Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ROUTE_ITEMS = [
  ["rutaErgonomia", "Ergonomía y posición de manejo"],
  ["rutaVisibilidad", "Visibilidad y percepción del entorno"],
  ["rutaDinamica", "Dinámica y sensación de manejo"],
  ["rutaSeguridad", "Seguridad y confianza del vehículo"],
  ["rutaConfort", "Confort acústico y sensorial"],
  ["rutaTecnologia", "Tecnología e interfaz de usuario"],
];

const INITIAL_FORM = {
  rutaErgonomia: 0,
  rutaVisibilidad: 0,
  rutaDinamica: 0,
  rutaSeguridad: 0,
  rutaConfort: 0,
  rutaTecnologia: 0,
  asesorExplico: "",
  experienciaTestdrive: "",
  explicacionesDemostraciones: "",
  fordManejo: "",
  estadoVehiculo: "",
  autoSuficiente: "",
  realizaraCompra: "",
  compraPlazo: "",
};

export default function PublicTestDriveSurveyPage({ token }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/testdrive-survey/${token}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || "No se pudo cargar la encuesta.");
        return payload;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((error) => {
        if (!cancelled) setMessage(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/testdrive-survey/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No se pudo guardar la encuesta.");
      setDone(true);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 p-4 text-sm font-semibold text-slate-600">Cargando encuesta...</div>;
  }

  if (message && !data) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 p-4"><div className="max-w-md rounded-lg border bg-white p-5 text-center text-sm font-semibold text-red-600 shadow-sm">{message}</div></div>;
  }

  if (done || data?.link?.estado === "respondido") {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-black text-violet-700">Encuesta registrada</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">Gracias por responder la encuesta del test drive.</p>
        </div>
      </div>
    );
  }

  const testdrive = data?.testdrive || {};

  return (
    <main className="min-h-screen bg-slate-50 p-2 text-slate-950 sm:p-4">
      <section className="mx-auto max-w-6xl rounded-xl border bg-white shadow-sm">
        <header className="flex flex-col gap-1 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-violet-500">Encuesta Test Drive</p>
            <h1 className="text-base font-black text-slate-950 sm:text-lg">{testdrive.numero}</h1>
          </div>
          <div className="text-left sm:text-right">
          <p className="text-xs font-medium text-slate-500">
            {testdrive.fecha} {testdrive.horaInicio ? `- ${testdrive.horaInicio}` : ""}{testdrive.horaFin ? ` a ${testdrive.horaFin}` : ""}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{[testdrive.clienteNombre, testdrive.modelo, testdrive.placa].filter(Boolean).join(" - ")}</p>
          </div>
        </header>

        <div className="space-y-3 p-3 sm:p-4">
          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="mb-2">
              <p className="text-sm font-bold leading-tight">Rutas</p>
              <p className="text-xs font-medium text-slate-500">Según la prueba de manejo, califica del 1 al 10.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {ROUTE_ITEMS.map(([key, label]) => (
                <ScoreCard key={key} label={label} value={form[key]} onChange={(value) => update(key, value)} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-white p-3">
            <p className="mb-2 text-center text-sm font-bold leading-tight">Feedback del Cliente</p>
            <div className="grid gap-2">
              <FaceScale label="1. ¿El asesor comercial explicó adecuadamente las funciones principales del vehículo antes de la prueba?" value={form.asesorExplico} onChange={(value) => update("asesorExplico", value)} />
              <FaceScale label="2. ¿Cuán satisfecho se encuentra con la experiencia del test drive?" value={form.experienciaTestdrive} onChange={(value) => update("experienciaTestdrive", value)} />
              <FaceScale label="3. ¿Cuán satisfecho se encuentra con las explicaciones y demostraciones recibidas durante el test drive?" value={form.explicacionesDemostraciones} onChange={(value) => update("explicacionesDemostraciones", value)} />
              <FaceScale label="4. ¿Cuán satisfecho se encuentra con el vehículo que manejó?" value={form.fordManejo} onChange={(value) => update("fordManejo", value)} />
              <FaceScale label="5. ¿Cuán satisfecho se encuentra con el estado del vehículo?" value={form.estadoVehiculo} onChange={(value) => update("estadoVehiculo", value)} />
              <FaceScale label="6. ¿El tiempo de la prueba de manejo fue suficiente para evaluar el vehículo?" value={form.autoSuficiente} onChange={(value) => update("autoSuficiente", value)} />
              <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                <YesNo label="7. ¿Realizaría la compra ahora?" value={form.realizaraCompra} onChange={(value) => update("realizaraCompra", value)} />
                <label className="text-xs font-semibold text-slate-700">
                  O en
                  <Input className="mt-2" value={form.compraPlazo} placeholder="Ej. 30 días" onChange={(event) => update("compraPlazo", event.target.value)} />
                </label>
              </div>
            </div>
          </div>

          {message ? <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-semibold text-red-700">{message}</div> : null}
        </div>

        <footer className="flex justify-end border-t px-4 py-3">
          <Button size="sm" className="h-8 bg-violet-700 text-xs text-white hover:bg-violet-800" disabled={saving} onClick={submit}>
            <Send className="size-4" />
            {saving ? "Guardando..." : "Enviar encuesta"}
          </Button>
        </footer>
      </section>
    </main>
  );
}

function ScoreCard({ label, value, onChange }) {
  return (
    <div className="rounded-lg border bg-white p-2">
      <p className="mb-1.5 min-h-7 text-[11px] font-bold leading-tight text-slate-700">{label}</p>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
          <button
            key={score}
            type="button"
            className={`h-7 rounded-md border text-[11px] font-black ${Number(value) === score ? "border-violet-500 bg-violet-100 text-violet-700" : "bg-white text-slate-600"}`}
            onClick={() => onChange(score)}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

function FaceScale({ label, value, onChange }) {
  const options = [
    { value: "muy_satisfecho", label: "Muy satisfecho", note: "Nota 10", icon: Smile, className: "border-emerald-200 bg-emerald-50 text-emerald-700", activeClass: "ring-2 ring-emerald-400" },
    { value: "satisfecho", label: "Satisfecho", note: "Nota 9", icon: Meh, className: "border-amber-200 bg-amber-50 text-amber-700", activeClass: "ring-2 ring-amber-400" },
    { value: "insatisfecho", label: "Insatisfecho", note: "Nota 8 a 1", icon: Frown, className: "border-red-200 bg-red-50 text-red-700", activeClass: "ring-2 ring-red-400" },
  ];
  return (
    <div className="grid items-center gap-2 rounded-lg border bg-slate-50 p-2 sm:grid-cols-[minmax(320px,1fr)_360px]">
      <p className="text-xs font-semibold leading-snug text-slate-700">{label}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((option) => {
          const Icon = option.icon;
          const active = value === option.value;
          return (
            <button key={option.value} type="button" className={`flex h-10 items-center gap-1.5 rounded-lg border px-2 text-left ${option.className} ${active ? option.activeClass : "opacity-80"}`} onClick={() => onChange(option.value)}>
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold">{option.label}</span>
                <span className="block truncate text-[11px] font-semibold">{option.note}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YesNo({ label, value, onChange }) {
  const options = [
    { value: "si", label: "Sí", className: "border-emerald-200 bg-emerald-50 text-emerald-700", activeClass: "ring-2 ring-emerald-400" },
    { value: "no", label: "No", className: "border-red-200 bg-red-50 text-red-700", activeClass: "ring-2 ring-red-400" },
  ];
  return (
    <div className="grid items-center gap-2 rounded-lg border bg-slate-50 p-2 sm:grid-cols-[minmax(220px,1fr)_140px]">
      <p className="text-xs font-semibold leading-snug text-slate-700">{label}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((option) => (
          <button key={option.value} type="button" className={`h-10 rounded-lg border px-3 text-xs font-black ${option.className} ${value === option.value ? option.activeClass : "opacity-80"}`} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
