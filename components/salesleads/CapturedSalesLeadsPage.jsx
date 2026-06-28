"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Filter, RefreshCw, Trash2, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const leads = [
  { id: 1, name: "Rosi", phone: "51926583641", model: "Nissan Qashqai", version: "Full", price: "S/ 50,000", status: "Nuevo", date: "06/04/2026, 05:55 p. m.", email: "rosiriverflower@gmail.com", payment: "Contado", days: "0 dias habiles" },
  { id: 2, name: "Paul Rivera", phone: "51912528990", model: "Nissan Qashqai", version: "Full", price: "S/ 50,000", status: "Nuevo", date: "25/03/2026, 09:09 p. m.", use: "transporte personal", payment: "Contado", days: "0 dias habiles" },
  { id: 3, name: "Sofia", phone: "51913329606", model: "Ford Ecosport", version: "BASICA AUTOMATICA", price: "S/ 80,000", status: "Nuevo", date: "22/03/2026, 10:02 a. m.", payment: "Contado", days: "0 dias habiles" },
  { id: 4, name: "Rosi", phone: "51926583641", model: "Chevrolet Onix", version: "BASICA AUTOMATICA", price: "S/ 80,000", status: "Nuevo", date: "22/03/2026, 07:31 a. m.", payment: "Contado", days: "0 dias habiles" },
  { id: 5, name: "Andre Pariona", phone: "51954476771", model: "Ford Bronco", version: "Full", price: "S/ 80,000", status: "Nuevo", date: "21/03/2026, 01:03 p. m.", payment: "Contado", days: "0 dias habiles" },
  { id: 6, name: "Paul Rivera", phone: "51912528990", model: "TOYOTA frontier", version: "BASICA AUTOMATICA", price: "S/ 80,000", status: "Nuevo", date: "21/03/2026, 08:12 a. m.", use: "personal", payment: "Contado", days: "0 dias habiles" },
  { id: 7, name: "Paul Rivera", phone: "51912528990", model: "Nissan Qashqai", version: "Full", price: "S/ 50,000", status: "Nuevo", date: "21/03/2026, 08:12 a. m.", use: "familiar", payment: "Contado", days: "0 dias habiles" },
];

const statusCards = [
  { label: "Nuevo", value: 7, tone: "blue" },
  { label: "Contactado", value: 0, tone: "yellow" },
  { label: "Negociando", value: 0, tone: "purple" },
  { label: "Cerrado", value: 0, tone: "green" },
  { label: "Perdido", value: 0, tone: "red" },
];

function badgeClasses(tone) {
  if (tone === "yellow") return "bg-amber-100 text-amber-700";
  if (tone === "purple") return "bg-purple-100 text-purple-700";
  if (tone === "green") return "bg-emerald-100 text-emerald-700";
  if (tone === "red") return "bg-red-100 text-red-700";
  return "bg-blue-100 text-blue-700";
}

export default function CapturedSalesLeadsPage() {
  const [selectedId, setSelectedId] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selectedLead = useMemo(() => leads.find((lead) => lead.id === selectedId) || leads[0], [selectedId]);

  return (
    <main className="min-h-full bg-slate-50 text-slate-950">
      <div className={cn("grid min-h-full gap-0", selectedLead ? "xl:grid-cols-[1fr_390px]" : "")}>
        <section className="min-w-0 p-3 sm:p-4">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black leading-tight text-slate-900">Leads de ventas</h1>
              <p className="mt-0.5 text-sm font-medium text-slate-500">Cotizaciones generadas por el agente de IA · 7 total</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-blue-500 bg-white font-bold text-blue-700" onClick={() => setFiltersOpen((value) => !value)}>
                <Filter className="size-4" />
                Filtros
                <span className="grid size-5 place-items-center rounded-full bg-blue-600 text-[10px] text-white">1</span>
              </Button>
              <Button variant="outline" size="icon-lg" className="bg-white">
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </header>

          {filtersOpen ? (
            <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Estado">
                  <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200">
                    <option>Nuevo</option>
                    <option>Contactado</option>
                    <option>Negociando</option>
                    <option>Cerrado</option>
                    <option>Perdido</option>
                  </select>
                </Field>
                <Field label="Desde">
                  <Input type="date" />
                </Field>
                <Field label="Hasta">
                  <Input type="date" />
                </Field>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" className="font-bold text-slate-700">
                  <X className="size-4" />
                  Limpiar filtros
                </Button>
              </div>
            </section>
          ) : null}

          <section className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
            {statusCards.map((card, index) => (
              <article key={card.label} className={cn("rounded-lg border bg-white p-3 text-center shadow-sm", index === 0 && "border-blue-500 bg-blue-50")}>
                <span className={cn("rounded px-2 py-1 text-xs font-bold", badgeClasses(card.tone))}>{card.label}</span>
                <p className="mt-2 text-sm font-black text-slate-900">{card.value}</p>
              </article>
            ))}
          </section>

          <section className="space-y-2">
            {leads.map((lead) => {
              const active = lead.id === selectedId;
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedId(lead.id)}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg border bg-white px-4 py-3 text-left shadow-sm transition",
                    active ? "border-blue-500 ring-2 ring-blue-500" : "border-slate-200 hover:border-blue-200"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400">
                      <UserRound className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{lead.name} <span className="font-medium text-slate-400">· {lead.phone}</span></p>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{lead.model} — {lead.version}</p>
                      {lead.use ? <p className="mt-1 text-xs font-medium text-slate-400">Uso: {lead.use}</p> : null}
                    </div>
                  </div>
                  <div className="hidden items-center gap-3 text-right sm:flex">
                    <span className="font-bold text-slate-900">{lead.price}</span>
                    <span className="rounded bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">{lead.status}</span>
                    <span className="text-xs font-medium text-slate-400">{lead.date}</span>
                    {active ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
                  </div>
                </button>
              );
            })}
          </section>
        </section>

        {selectedLead ? <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedId(null)} /> : null}
      </div>
    </main>
  );
}

function LeadDetailPanel({ lead, onClose }) {
  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-full overflow-y-auto border-l border-slate-200 bg-white shadow-xl sm:w-[390px] xl:sticky xl:top-0 xl:h-svh xl:shadow-none">
      <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-4 py-4">
        <div>
          <h2 className="text-base font-black text-slate-900">{lead.name}</h2>
          <p className="text-xs font-medium text-slate-500">{lead.phone}</p>
        </div>
        <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose}>
          <X className="size-5" />
        </button>
      </header>

      <div className="space-y-6 p-4 pb-40">
        <Section title="Cotizacion">
          <div className="rounded-lg bg-slate-50 p-4">
            <Info label="Modelo" value={lead.model} strong />
            <Info label="Version" value={lead.version} strong />
            <Info label="Precio final" value={lead.price} strong />
            <Info label="Forma de pago" value={lead.payment} strong />
            <Info label="Tiempo de entrega" value={lead.days} strong />
          </div>
        </Section>

        <Section title="Perfil del cliente">
          <Info label="Email" value={lead.email || "—"} strong={Boolean(lead.email)} />
          <Info label="Uso del vehiculo" value={lead.use || "—"} />
          <Info label="Personas habituales" value="—" />
          <Info label="Presupuesto estimado" value="50000" strong />
          <Info label="Equipamiento requerido" value="—" />
          <Info label="Historial crediticio" value="—" />
        </Section>

        <Section title="Fechas">
          <p className="text-xs text-slate-600">Cotizacion generada: <b className="text-slate-900">{lead.date}</b></p>
          <p className="mt-1 text-xs text-slate-600">Resumen enviado: <b className="text-slate-900">{lead.date}</b></p>
        </Section>

        <Section title="Gestion">
          <p className="text-xs text-slate-500">Ajusta el estado o envia esta cotizacion al flujo comercial.</p>
        </Section>
      </div>

      <footer className="fixed bottom-0 right-0 z-40 w-full border-t border-slate-200 bg-white p-4 sm:w-[390px] xl:absolute">
        <div className="grid gap-2">
          <Button className="bg-slate-950 text-white hover:bg-slate-800">Guardar cambios</Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700">
            <ExternalLink className="size-4" />
            Enviar a Ventas
          </Button>
          <Button variant="outline" className="border-red-200 bg-white font-bold text-red-600 hover:bg-red-50">
            <Trash2 className="size-4" />
            Eliminar cotizacion
          </Button>
        </div>
      </footer>
    </aside>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-black uppercase text-slate-400">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Info({ label, value, strong = false }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("mt-0.5 text-sm text-slate-900", strong && "font-black")}>{value}</p>
    </div>
  );
}
