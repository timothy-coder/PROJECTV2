"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const rowsByStatus = {
  pending: [
    { phone: "2549818098771066", client: "", origin: "Ventas IA", steps: [false, false, false], next: "17/04/26" },
    { phone: "1259680346353070", client: "", origin: "Ventas IA", steps: [false, false, false], next: "23/04/26" },
  ],
  process: [
    { phone: "51912528990", client: "Paul Rivera", origin: "Ventas IA", steps: [true, false, false], next: "18/04/26" },
    { phone: "+51912528990", client: "", origin: "Ventas IA", steps: [true, true, false], next: "18/04/26" },
  ],
  closed: [
    { phone: "51936644184", client: "", origin: "Ventas IA", steps: [true, true, true], next: "19/04/26", reason: "Sin respuesta" },
    { phone: "51912528990", client: "Paul Rivera", origin: "Ventas IA", steps: [true, true, true], next: "18/04/26", reason: "Sin respuesta" },
    { phone: "+51912528990", client: "", origin: "Ventas IA", steps: [true, true, true], next: "18/04/26", reason: "Sin respuesta" },
    { phone: "912528990", client: "", origin: "Ventas IA", steps: [true, true, true], next: "12/04/26", reason: "Sin respuesta" },
    { phone: "51987654321", client: "", origin: "Manual", steps: [false, false, false], next: "03/04/26", reason: "Sin respuesta" },
  ],
};

const tabs = [
  { key: "pending", label: "Pendientes", count: 2 },
  { key: "process", label: "En proceso", count: 2 },
  { key: "closed", label: "Cerrados", count: 5 },
];

const summaryCards = [
  { label: "Pendientes ahora", value: 2, icon: AlertCircle, tone: "orange" },
  { label: "En proceso", value: 2, icon: Clock3, tone: "blue" },
  { label: "Cerrados", value: 5, icon: CheckCircle2, tone: "slate" },
];

function toneClasses(tone) {
  if (tone === "orange") return "text-orange-600";
  if (tone === "blue") return "text-blue-600";
  return "text-slate-500";
}

export default function FollowupsPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const rows = useMemo(() => rowsByStatus[activeTab] || [], [activeTab]);
  const closed = activeTab === "closed";

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-950 sm:p-4">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black leading-none tracking-normal text-slate-950 sm:text-3xl">Follow-up 3-3-3</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Seguimiento automatico de leads - 3 intentos cada 3 dias</p>
        </div>
        <Button variant="outline" className="bg-white font-bold text-slate-800">
          <RefreshCw className="size-4" />
          Actualizar
        </Button>
      </header>

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="min-h-32 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <p className={cn("flex items-center gap-2 text-sm font-bold", toneClasses(card.tone))}>
                <Icon className="size-4" />
                <span className="text-slate-500">{card.label}</span>
              </p>
              <p className={cn("mt-12 text-3xl font-black leading-none", toneClasses(card.tone))}>{card.value}</p>
            </article>
          );
        })}
      </section>

      <section className="mb-6 flex w-fit rounded-lg bg-slate-100 p-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-bold transition",
                active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:bg-white/60"
              )}
            >
              {tab.label}
              {tab.key === "pending" ? (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black leading-none text-white">{tab.count}</span>
              ) : null}
            </button>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[900px] table-fixed text-left text-sm">
            <thead className="border-b border-slate-200 text-sm font-bold text-slate-500">
              <tr>
                <th className="w-[220px] py-4">Telefono</th>
                <th className="w-[160px]">Cliente</th>
                <th className="w-[150px]">Origen</th>
                <th className="w-[160px]">Pasos</th>
                <th className="w-[130px]">Proximo</th>
                {closed ? <th className="w-[170px]">Motivo cierre</th> : <th className="w-[130px] text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((item) => (
                <tr key={`${activeTab}-${item.phone}-${item.next}`}>
                  <td className="py-3 text-xs font-medium text-slate-950">{item.phone}</td>
                  <td className={item.client ? "text-sm font-medium text-slate-800" : "text-sm italic text-slate-500"}>{item.client || "Sin registro"}</td>
                  <td><OriginBadge value={item.origin} /></td>
                  <td><Steps steps={item.steps} /></td>
                  <td className="text-sm text-slate-500">{item.next}</td>
                  {closed ? (
                    <td className="text-sm text-slate-500">{item.reason}</td>
                  ) : (
                    <td className="text-right">
                      <Button variant="outline" size="sm" className="bg-white font-bold text-slate-900">
                        <XCircle className="size-4" />
                        Cerrar
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 sm:hidden">
          {rows.map((item) => (
            <article key={`${activeTab}-mobile-${item.phone}-${item.next}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-950">{item.phone}</p>
                  <p className={item.client ? "mt-1 text-xs font-medium text-slate-700" : "mt-1 text-xs italic text-slate-500"}>{item.client || "Sin registro"}</p>
                </div>
                <OriginBadge value={item.origin} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Steps steps={item.steps} />
                <span className="text-xs font-medium text-slate-500">{item.next}</span>
              </div>
              {closed ? <p className="mt-2 text-xs text-slate-500">Motivo: {item.reason}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function OriginBadge({ value }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
      {value}
    </span>
  );
}

function Steps({ steps }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((done, index) => (
        <span
          key={index}
          className={cn(
            "grid size-5 place-items-center rounded-full text-[10px] font-black",
            done ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"
          )}
        >
          {index + 1}
        </span>
      ))}
    </div>
  );
}
