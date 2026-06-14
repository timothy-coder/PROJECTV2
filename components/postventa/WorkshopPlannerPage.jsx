"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Maximize2,
  Menu,
  MessageSquare,
  MoreVertical,
  Play,
  Search,
  Sun,
} from "lucide-react";

import { hasPerm } from "@/lib/permissions";

const TABS = ["Asesores", "Tecnicos", "Lavado", "Control de Calidad", "Etapas", "Pausadas"];

const ADVISORS = [
  { name: "Elvis Herrera\nPorras", color: "bg-cyan-500" },
  { name: "Jose Daniel\nCondor\nQuinteros", color: "bg-blue-600" },
  { name: "Josef Eduardo\nFlores Velazco", color: "bg-indigo-700" },
  { name: "WALDIR\nATAUPILLCO\nHUGO", color: "bg-red-700" },
];

const TECHNICIANS = [
  { name: "DANIEL\nLOVATON\nQUISPE" },
  { name: "Denis Santiago\nFlores Avila" },
  { name: "Eugenio Coca\nHuatarongo", muted: true },
  { name: "Jhonatan Smith\nAlarcon Salcedo" },
  { name: "Jose Luis\nAlvarado" },
  { name: "Leonardo Ponce\nFigueroa" },
];

const TECH_EVENTS = [
  { row: 1, start: 3, span: 5, type: "diagnostic", code: "26807", title: "#26807 - DANTE LUIS ROJAS TORRES", sub: "Ecosport - W4I248", promise: "Promesa: --" },
  { row: 4, start: 0, span: 1, type: "maintenance", title: "" },
  { row: 5, start: 5, span: 4, type: "maintenance", code: "26810", title: "#26810 - FRANCO PAYANO HINOSTROZA", sub: "Ranger - H3N879", promise: "Promesa: --" },
  { row: 6, start: 3, span: 5, type: "recall", code: "26809", title: "#26809 - LUIS MIGUEL QUISPE", sub: "Ranger - W8C883", promise: "Promesa: --" },
];

const STAGES = [
  { name: "Sin etapa", items: [] },
  { name: "Trabajando ahora", items: ["26807", "26785", "26809", "26810"] },
  { name: "Prueba de ruta", items: [] },
  { name: "Lavado", items: [] },
  { name: "Control de calidad y de entrega", items: ["26806", "26808"] },
  { name: "Listo para entrega", items: ["26629", "2600568", "2600574", "26636", "26638", "26642", "26643", "26645", "26663", "26666", "260890", "26668", "2600236", "26670"] },
  { name: "Paralizado", items: ["26714", "26766", "26777", "26805"] },
];

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function advisorListForUser(currentUser, canViewAll) {
  if (canViewAll) return ADVISORS;
  const userName = normalizeText(currentUser?.fullname || currentUser?.name || currentUser?.username);
  const match = ADVISORS.find((advisor) => {
    const advisorName = normalizeText(advisor.name.replace(/\n/g, " "));
    return userName && (advisorName.includes(userName) || userName.includes(advisorName));
  });
  return match ? [match] : [{ name: currentUser?.fullname || currentUser?.username || "Mi usuario", color: "bg-blue-600" }];
}

function formatPlannerDate(date) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
}

function buildTimeSlots(date) {
  const start = new Date(date);
  const minutes = start.getMinutes();
  start.setMinutes(minutes < 30 ? 0 : 30, 0, 0);
  const slots = [];
  for (let index = 0; index < 14; index += 1) {
    const slot = new Date(start.getTime() + index * 30 * 60 * 1000);
    slots.push(slot.toTimeString().slice(0, 5));
  }
  return slots;
}

function minutesFromTime(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function currentTimePosition(now, times) {
  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutesFromTime(times[0]);
  return Math.max(0, Math.min(14, (current - start) / 30));
}

export default function WorkshopPlannerPage({ userPermissions, currentUser }) {
  const [activeTab, setActiveTab] = useState("Asesores");
  const [advisorFilterOpen, setAdvisorFilterOpen] = useState(false);
  const [selectedAdvisors, setSelectedAdvisors] = useState([]);
  const canView = Boolean(hasPerm(userPermissions, ["planeador_tallerpv", "view"]) || hasPerm(userPermissions, ["planeador_tallerpv", "viewall"]));
  const canViewAll = hasPerm(userPermissions, ["planeador_tallerpv", "viewall"]);
  const now = useMemo(() => new Date(), []);
  const times = useMemo(() => buildTimeSlots(now), [now]);
  const availableAdvisors = useMemo(() => advisorListForUser(currentUser, canViewAll), [canViewAll, currentUser]);
  const visibleAdvisors = useMemo(() => {
    if (!canViewAll || !selectedAdvisors.length) return availableAdvisors;
    return availableAdvisors.filter((advisor) => selectedAdvisors.includes(advisor.name));
  }, [availableAdvisors, canViewAll, selectedAdvisors]);
  const isStages = activeTab === "Etapas";
  const people = activeTab === "Asesores" ? visibleAdvisors : TECHNICIANS;

  if (!canView) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver el planeador de taller.</div>;
  }

  function toggleAdvisor(name) {
    setSelectedAdvisors((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  return (
    <div className="min-h-full bg-[#f7f7f8] text-slate-700">
      <PlannerTopBar now={now} />
      <div className="bg-amber-400 px-6 py-4 text-center text-xs font-bold text-white">
        Su cuenta tiene un saldo vencido. Envie su comprobante a <span className="underline">cobranza@clearcheck.us</span> para evitar que su cuenta sea suspendida. Obtenga hasta 20% de descuento con pago anticipado anual.
      </div>

      <nav className="border-b border-slate-200 bg-white px-16">
        <div className="flex h-12 items-center gap-8">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`h-full border-b-[3px] px-2 text-sm font-bold transition ${
                activeTab === tab ? "border-blue-600 bg-slate-50 text-blue-600" : "border-transparent text-slate-600 hover:text-blue-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <main className="px-6 py-4">
        <section className="mx-auto max-w-[1760px]">
          <div className="mb-2 flex items-center justify-between gap-4">
            <Legend activeTab={activeTab} />
            <div className="flex items-center gap-4">
              {activeTab === "Asesores" && canViewAll ? (
                <div className="relative">
                  <button type="button" className="inline-flex h-8 min-w-[180px] items-center justify-between rounded-full border border-slate-300 bg-white px-4 text-xs font-bold text-blue-600" onClick={() => setAdvisorFilterOpen((current) => !current)}>
                    {selectedAdvisors.length ? `Asesores ${selectedAdvisors.length}` : `Asesores +${availableAdvisors.length}`}
                    <ChevronDown className={`size-4 text-slate-500 transition ${advisorFilterOpen ? "rotate-180" : ""}`} />
                  </button>
                  {advisorFilterOpen ? (
                    <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-lg">
                      <button type="button" className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-bold text-blue-600 hover:bg-blue-50" onClick={() => setSelectedAdvisors([])}>
                        Ver todos
                      </button>
                      {availableAdvisors.map((advisor) => (
                        <label key={advisor.name} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
                          <input type="checkbox" checked={!selectedAdvisors.length || selectedAdvisors.includes(advisor.name)} onChange={() => toggleAdvisor(advisor.name)} />
                          <span className="whitespace-pre-line text-xs font-semibold text-slate-700">{advisor.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <button type="button" className="inline-flex h-8 min-w-[170px] items-center justify-between rounded-full border border-slate-300 bg-white px-4 text-xs font-bold text-blue-600">
                  {activeTab === "Asesores" ? "Mi asesor" : activeTab === "Tecnicos" ? "Tecnicos +10" : activeTab}
                  <ChevronDown className="size-4 text-slate-500" />
                </button>
              )}
              <button type="button" className="grid size-8 place-items-center text-blue-600">
                <Maximize2 className="size-5" />
              </button>
            </div>
          </div>

          {isStages ? <StagesBoard /> : <TimelineGrid title={activeTab} people={people} times={times} now={now} showEvents={activeTab !== "Asesores"} />}
        </section>
      </main>
    </div>
  );
}

function PlannerTopBar({ now }) {
  return (
    <header className="flex h-[52px] items-center justify-between border-b border-slate-200 bg-white px-7">
      <div className="flex h-full items-center">
        <div className="flex items-center gap-4 pr-7">
          <Menu className="size-5 text-slate-400" />
          <h1 className="text-xl font-bold text-slate-500">Planeador de Taller</h1>
        </div>
        <div className="flex h-full items-center border-l border-r border-slate-300 px-6 text-center">
          <div>
            <p className="text-[11px] text-slate-700">Capacidad</p>
            <p className="text-sm font-bold text-slate-950">0%</p>
            <div className="mt-0.5 flex gap-0.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <span key={index} className="h-1.5 w-3 rounded-[2px] border border-slate-400" />
              ))}
            </div>
          </div>
        </div>
        <button type="button" className="ml-4 inline-flex h-9 items-center gap-4 rounded-full border border-slate-300 bg-white px-4 text-sm font-extrabold text-blue-600">
          {formatPlannerDate(now)}
          <CalendarDays className="size-5" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <label className="hidden h-9 w-[250px] items-center rounded-full border border-slate-300 bg-white px-4 text-xs text-slate-500 xl:flex">
          <span className="flex-1">Buscar: # Cita, # Orden, VIN, placas</span>
          <Search className="size-4" />
        </label>
        <div className="h-8 border-l border-slate-300" />
        <RoundButton icon={Bell} alert />
        <RoundButton icon={MessageSquare} alert />
        <RoundButton icon={MoreVertical} />
      </div>
    </header>
  );
}

function RoundButton({ icon: Icon, alert = false }) {
  return (
    <button type="button" className="relative grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50">
      <Icon className="size-5" />
      {alert ? <span className="absolute right-1 top-1 size-2.5 rounded-full bg-red-500" /> : null}
    </button>
  );
}

function Legend({ activeTab }) {
  if (activeTab === "Etapas") return <div className="h-8" />;
  if (activeTab === "Tecnicos") {
    return (
      <div className="space-y-2 pl-2 text-xs text-slate-600">
        <p className="flex items-center gap-2">
          <Sun className="size-4 text-orange-500" /> Orden sin iniciar segun la hora programada o con fecha promesa de entrega vencida
        </p>
        <div className="flex flex-wrap items-center gap-5">
          <LegendLine color="bg-pink-100" label="Diagnostico" />
          <LegendLine color="bg-green-300" label="Mantenimiento Preventivo" />
          <LegendLine color="bg-yellow-200" label="Garantia/Recall" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 pl-2 text-xs text-slate-600">
      <LegendLine color="bg-emerald-400" label="Cita confirmada u Orden creada" />
    </div>
  );
}

function LegendLine({ color, label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-0.5 w-4 ${color}`} />
      {label}
    </span>
  );
}

function TimelineGrid({ title, people, times, now, showEvents }) {
  const nowPosition = currentTimePosition(now, times);
  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
      <div className="grid min-w-[1360px] grid-cols-[130px_repeat(14,minmax(105px,1fr))]">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-600">{title}</div>
        {times.map((time, index) => (
          <div key={time} className={`border-b border-slate-200 px-1 py-3 text-center text-xs text-slate-500 ${index >= 11 ? "bg-slate-100" : ""}`}>
            {time}
          </div>
        ))}
      </div>
      <div className="max-h-[calc(100vh-252px)] min-h-[500px] overflow-auto">
        <div className="relative grid min-w-[1360px] grid-cols-[130px_repeat(14,minmax(105px,1fr))]">
          {people.map((person, rowIndex) => (
            <TimelineRow key={person.name} person={person} rowIndex={rowIndex} times={times} />
          ))}
          <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-blue-600" style={{ left: `calc(130px + ${nowPosition} * ((100% - 130px) / 14))` }} />
          {showEvents ? TECH_EVENTS.map((event) => <TimelineEvent key={`${event.code || event.title}-${event.row}-${event.start}`} event={event} />) : null}
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ person, rowIndex, times }) {
  return (
    <>
      <div className={`flex min-h-[100px] items-center border-b border-r border-slate-200 px-4 text-sm ${person.muted ? "text-slate-300" : "text-slate-900"}`}>
        {person.color ? <span className={`mr-2 h-1.5 w-1.5 rounded-full ${person.color}`} /> : null}
        <span className="whitespace-pre-line leading-tight">{person.name}</span>
      </div>
      {times.map((time, index) => (
        <div key={`${rowIndex}-${time}`} className={`min-h-[100px] border-b border-r border-slate-200 ${index >= 11 ? "bg-slate-100" : ""}`} />
      ))}
    </>
  );
}

function TimelineEvent({ event }) {
  const colors = {
    diagnostic: "border-pink-200 bg-pink-100 text-red-900",
    maintenance: "border-green-300 bg-green-300 text-green-950",
    recall: "border-yellow-200 bg-yellow-100 text-yellow-950",
  };
  const top = 44 + event.row * 100;
  const left = `calc(130px + ${event.start} * ((100% - 130px) / 14))`;
  const width = `calc(${event.span} * ((100% - 130px) / 14) - 4px)`;

  return (
    <div className={`absolute rounded-md border p-2 text-xs shadow-sm ${colors[event.type]}`} style={{ top, left, width, minHeight: 94 }}>
      {event.code ? <span className="mr-2 rounded-full bg-red-700 px-3 py-1 text-[11px] font-extrabold text-white">{event.code}</span> : null}
      <span className="font-medium">{event.title}</span>
      {event.sub ? <p className="mt-1">{event.sub}</p> : null}
      {event.promise ? <p>{event.promise}</p> : null}
      {event.code ? (
        <button type="button" className="mt-2 grid size-5 place-items-center rounded-full border-2 border-blue-600 text-blue-600">
          <Play className="ml-0.5 size-3 fill-blue-600" />
        </button>
      ) : null}
    </div>
  );
}

function StagesBoard() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
      <div className="border-b border-slate-200 bg-slate-100 px-5 py-3 text-sm font-extrabold text-slate-600">Etapas</div>
      <div className="max-h-[calc(100vh-215px)] min-h-[620px] overflow-auto">
        <div className="grid min-w-[1400px] grid-cols-7">
          {STAGES.map((stage) => (
            <div key={stage.name} className="min-h-[720px] border-r border-slate-300 bg-white last:border-r-0">
              <div className="border-b border-slate-100 px-4 py-4 text-center text-sm text-slate-600">{stage.name}</div>
              <div className="space-y-5 px-5 py-5">
                {stage.items.map((item) => (
                  <span key={item} className={`mx-auto block w-28 rounded-full px-4 py-1.5 text-center text-sm font-extrabold text-white ${item === "26766" ? "bg-blue-600" : "bg-red-700"}`}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
