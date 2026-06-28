"use client";

import { Bell, Hourglass, MessageCircle, Search, Send, UserCheck, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const stats = [
  {
    label: "Asignados",
    value: "0",
    icon: UserCheck,
    tone: "green",
  },
  {
    label: "Urgente",
    value: "0",
    icon: Hourglass,
    tone: "red",
  },
  {
    label: "Ritmo",
    value: "13d 9h",
    icon: Zap,
    tone: "blue",
  },
  {
    label: "Interacc.",
    value: "152m",
    icon: MessageCircle,
    tone: "slate",
  },
  {
    label: "WA",
    value: "0",
    icon: MessageCircle,
    tone: "muted",
  },
  {
    label: "IG",
    value: "0",
    icon: MessageCircle,
    tone: "muted",
  },
  {
    label: "FB",
    value: "0",
    icon: MessageCircle,
    tone: "muted",
  },
];

function statClasses(tone) {
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "red") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "blue") return "border-blue-200 bg-blue-50 text-blue-700";
  if (tone === "slate") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-slate-200 bg-white text-slate-500";
}

export default function MessagesPage() {
  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-950 sm:p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold leading-tight text-slate-800">Mensajes</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-400">Bandeja de conversaciones y canales</p>
        </div>
        <Button variant="outline" size="icon-lg" className="rounded-lg bg-white text-slate-600">
          <Bell className="size-4" />
        </Button>
      </header>

      <section className="mb-3 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-10 border-0 bg-transparent pl-9 text-sm shadow-none focus-visible:ring-0"
            placeholder="Buscar por cliente, celular o mensaje..."
          />
        </div>
      </section>

      <section className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={cn("min-h-16 rounded-lg border p-3 shadow-sm", statClasses(item.tone))}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate text-[10px] font-black uppercase">
                    <Icon className="size-3" />
                    {item.label}
                  </p>
                  <p className="mt-2 text-lg font-black leading-none">{item.value}</p>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mb-2 flex flex-wrap items-center justify-end gap-2 text-xs text-slate-500">
        <span className="font-medium">0 conv. - 0 sel.</span>
        <Button variant="outline" className="bg-white">
          Seleccionar
        </Button>
        <Button variant="outline" className="bg-white font-bold text-slate-800">
          Masivo
        </Button>
      </section>

      <section className="grid min-h-[calc(100svh-265px)] gap-2 lg:grid-cols-[330px_1fr]">
        <aside className="min-h-64 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex h-full min-h-64 items-start justify-center p-7 text-center">
            <p className="max-w-64 text-sm font-medium leading-relaxed text-slate-500">
              No hay conversaciones que coincidan con los filtros.
            </p>
          </div>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex min-h-[420px] h-full items-center justify-center p-6 text-center">
            <div>
              <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-violet-50 text-violet-700">
                <Send className="size-5" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                Selecciona una conversacion para comenzar.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
