"use client";

import { useMemo, useState } from "react";
import { Bell, Hourglass, Info, MessageCircle, Search, Send, UserCheck, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const conversations = [
  {
    id: 1,
    client: "Rosi Vargas",
    phone: "51926583641",
    channel: "WA",
    status: "Nuevo lead",
    assigned: "Maritza Zea",
    lastMessage: "Hola, deseo informacion sobre la Nissan Qashqai Full.",
    time: "09:42",
    unread: 2,
    gender: "female",
    summary: {
      profile: ["Busca una SUV familiar con buena tecnologia.", "Valora la atencion rapida por WhatsApp."],
      demographics: ["Mujer adulta.", "Contacto principal por celular.", "Interes en financiamiento."],
      habits: ["Compara opciones antes de decidir.", "Prefiere recibir informacion resumida."],
      interests: ["Nissan Qashqai Full.", "Financiamiento y disponibilidad inmediata."],
      challenges: ["Definir cuota mensual.", "Confirmar stock y colores disponibles."],
      frustrations: ["Esperas largas para recibir respuesta.", "Informacion incompleta sobre pagos."],
      goals: ["Comprar un vehiculo seguro.", "Cerrar una propuesta clara esta semana."],
    },
    messages: [
      { id: 1, from: "client", text: "Hola, deseo informacion sobre la Nissan Qashqai Full.", time: "09:35" },
      { id: 2, from: "agent", text: "Hola Rosi, con gusto. Tenemos unidades disponibles y puedo enviarte la cotizacion.", time: "09:38" },
      { id: 3, from: "client", text: "Perfecto, tambien quisiera saber si aceptan financiamiento.", time: "09:42" },
    ],
  },
  {
    id: 2,
    client: "Paul Rivera",
    phone: "51912528990",
    channel: "WA",
    status: "Seguimiento",
    assigned: "Pablo Quintana",
    lastMessage: "Me interesa reservar una cita para ver el vehiculo.",
    time: "08:18",
    unread: 0,
    gender: "male",
    summary: {
      profile: ["Cliente en seguimiento con interes de visita.", "Necesita ver el vehiculo antes de avanzar."],
      demographics: ["Varon adulto.", "Contacto por WhatsApp.", "Presupuesto en evaluacion."],
      habits: ["Pide confirmacion antes de reservar.", "Responde mejor a mensajes concretos."],
      interests: ["Cita presencial.", "Condiciones de separacion y entrega."],
      challenges: ["Coordinar horario de visita.", "Comparar opciones similares."],
      frustrations: ["Cambios de disponibilidad.", "Demora en aprobacion bancaria."],
      goals: ["Agendar visita.", "Separar unidad si la propuesta encaja."],
    },
    messages: [
      { id: 1, from: "agent", text: "Paul, te comparto la propuesta actualizada del modelo que revisamos.", time: "08:02" },
      { id: 2, from: "client", text: "Gracias. Me interesa reservar una cita para ver el vehiculo.", time: "08:18" },
    ],
  },
  {
    id: 3,
    client: "Sofia Medina",
    phone: "51913329606",
    channel: "IG",
    status: "Urgente",
    assigned: "Etel Alvarez",
    lastMessage: "Necesito confirmar disponibilidad hoy.",
    time: "Ayer",
    unread: 1,
    gender: "female",
    summary: {
      profile: ["Lead urgente desde Instagram.", "Quiere respuesta el mismo dia."],
      demographics: ["Mujer adulta.", "Canal principal Instagram.", "Alta intencion de compra."],
      habits: ["Consulta publicaciones recientes.", "Prioriza disponibilidad real."],
      interests: ["Ford Ecosport.", "Stock, precio y versiones."],
      challenges: ["Confirmar unidad disponible.", "Enviar propuesta completa rapidamente."],
      frustrations: ["No recibir confirmacion de stock.", "Cambios de precio sin aviso."],
      goals: ["Validar disponibilidad hoy.", "Recibir cotizacion formal."],
    },
    messages: [
      { id: 1, from: "client", text: "Hola, vi el Ford Ecosport en Instagram.", time: "Ayer 17:10" },
      { id: 2, from: "client", text: "Necesito confirmar disponibilidad hoy.", time: "Ayer 17:12" },
      { id: 3, from: "agent", text: "Sofia, estoy verificando stock y te respondo en unos minutos.", time: "Ayer 17:20" },
    ],
  },
  {
    id: 4,
    client: "Andre Pariona",
    phone: "51954476771",
    channel: "FB",
    status: "Cotizacion enviada",
    assigned: "Nilton Rosales",
    lastMessage: "Quedo atento a la aprobacion del banco.",
    time: "Lun",
    unread: 0,
    gender: "male",
    summary: {
      profile: ["Cotizacion enviada y pendiente del banco.", "Cliente espera aprobacion para avanzar."],
      demographics: ["Varon adulto.", "Origen Facebook.", "Compra con financiamiento."],
      habits: ["Revisa propuesta antes de responder.", "Depende de aprobacion externa."],
      interests: ["Ford Bronco.", "Financiamiento y condiciones finales."],
      challenges: ["Seguimiento bancario.", "Mantener vigencia de la oferta."],
      frustrations: ["Tiempo de respuesta del banco.", "Variacion de condiciones comerciales."],
      goals: ["Obtener aprobacion.", "Pasar a reserva."],
    },
    messages: [
      { id: 1, from: "agent", text: "Andre, ya te envie la cotizacion del Ford Bronco.", time: "Lun 10:11" },
      { id: 2, from: "client", text: "Quedo atento a la aprobacion del banco.", time: "Lun 10:18" },
    ],
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
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(conversations[0]?.id || null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((item) => `${item.client} ${item.phone} ${item.lastMessage} ${item.channel}`.toLowerCase().includes(needle));
  }, [query]);
  const selectedConversation = conversations.find((item) => item.id === selectedId) || filteredConversations[0] || null;

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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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
        <span className="font-medium">{filteredConversations.length} conv. - {selectedConversation ? 1 : 0} sel.</span>
        <Button variant="outline" className="bg-white">
          Seleccionar
        </Button>
        <Button variant="outline" className="bg-white font-bold text-slate-800">
          Masivo
        </Button>
      </section>

      <section className="grid min-h-[calc(100svh-265px)] gap-2 lg:grid-cols-[330px_1fr]">
        <aside className="min-h-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[calc(100svh-280px)] overflow-y-auto">
            {filteredConversations.length ? filteredConversations.map((conversation) => {
              const active = selectedConversation?.id === conversation.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left transition hover:bg-slate-50",
                    active && "bg-violet-50 ring-1 ring-inset ring-violet-200"
                  )}
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-500">
                    {conversation.client.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-black text-slate-900">{conversation.client}</span>
                      <span className="shrink-0 text-[10px] font-bold text-slate-400">{conversation.time}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-400">{conversation.phone} - {conversation.channel}</span>
                    <span className="mt-1 line-clamp-2 text-xs leading-snug text-slate-600">{conversation.lastMessage}</span>
                    <span className="mt-2 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">{conversation.status}</span>
                      {conversation.unread ? <span className="grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-5 text-white">{conversation.unread}</span> : null}
                    </span>
                  </span>
                </button>
              );
            }) : (
              <div className="flex h-full min-h-64 items-start justify-center p-7 text-center">
                <p className="max-w-64 text-sm font-medium leading-relaxed text-slate-500">
                  No hay conversaciones que coincidan con los filtros.
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {selectedConversation ? (
            <div className="flex min-h-[420px] h-full flex-col">
              <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-sm font-black text-slate-900">{selectedConversation.client}</h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7 shrink-0 rounded-lg bg-white text-violet-700"
                      title="Ver resumen"
                      onClick={() => setSummaryOpen(true)}
                    >
                      <Info className="size-3.5" />
                    </Button>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{selectedConversation.phone} - {selectedConversation.channel} - Asignado a {selectedConversation.assigned}</p>
                </div>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-700">{selectedConversation.status}</span>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
                {selectedConversation.messages.map((message) => {
                  const mine = message.from === "agent";
                  return (
                    <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm", mine ? "bg-violet-700 text-white" : "border border-slate-200 bg-white text-slate-800")}>
                        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                        <p className={cn("mt-1 text-right text-[10px] font-semibold", mine ? "text-violet-100" : "text-slate-400")}>{message.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <footer className="border-t border-slate-200 p-3">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                  <Input className="h-9 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0" placeholder="Escribe una respuesta..." />
                  <Button className="h-9 bg-violet-700 text-white hover:bg-violet-800">
                    <Send className="size-4" />
                    Enviar
                  </Button>
                </div>
              </footer>
            </div>
          ) : (
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
          )}
        </section>
      </section>
      {selectedConversation ? (
        <PersonaSummaryDialog
          conversation={selectedConversation}
          open={summaryOpen}
          onClose={() => setSummaryOpen(false)}
        />
      ) : null}
    </main>
  );
}

function PersonaSummaryDialog({ conversation, open, onClose }) {
  const summary = conversation.summary || {};
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}>
      <DialogContent className="max-h-[92svh] max-w-[min(96vw,980px)] overflow-y-auto bg-white p-0">
        <DialogHeader className="border-b border-slate-200 px-4 py-3 text-left">
          <DialogTitle className="text-base font-black text-violet-700">Resumen del cliente</DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-500">
            {conversation.client} - {conversation.phone} - {conversation.channel}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 p-4 lg:grid-cols-[1fr_220px_1fr]">
          <div className="space-y-3">
            <SummaryBox title="Perfil" items={summary.profile} />
            <SummaryBox title="Datos demograficos" items={summary.demographics} />
            <SummaryBox title="Habitos" items={summary.habits} />
          </div>

          <div className="space-y-3">
            <div className="rounded-sm border border-cyan-200 bg-cyan-50/40 px-3 py-2 text-center text-lg font-black uppercase tracking-wide text-slate-900">
              {conversation.client}
            </div>
            <div className="grid place-items-center rounded-lg border border-slate-200 bg-white p-3">
              <PersonaSilhouette gender={conversation.gender} />
            </div>
            <SummaryBox title="Intereses" items={summary.interests} />
          </div>

          <div className="space-y-3">
            <SummaryBox title="Retos" items={summary.challenges} />
            <SummaryBox title="Frustraciones" items={summary.frustrations} />
            <SummaryBox title="Objetivos" items={summary.goals} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryBox({ title, items = [] }) {
  return (
    <section className="overflow-hidden rounded-sm border border-cyan-200 bg-white">
      <h3 className="border-b border-cyan-200 bg-cyan-50/60 px-3 py-1.5 text-center text-xs font-black uppercase text-slate-900">
        {title}
      </h3>
      <ul className="space-y-1.5 px-3 py-2 text-xs font-medium leading-snug text-slate-600">
        {(items.length ? items : ["Sin informacion registrada."]).map((item) => (
          <li key={item} className="flex gap-1.5">
            <span className="mt-1 size-1 shrink-0 rounded-full bg-violet-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PersonaSilhouette({ gender }) {
  if (gender === "female") {
    return (
      <svg viewBox="0 0 180 220" role="img" aria-label="Silueta mujer" className="h-44 w-36 text-slate-950">
        <path fill="currentColor" d="M90 15c-25 0-43 20-43 48 0 15 7 28 18 36-18 8-31 23-35 45l-10 56h39l7-43 9 43h30l9-43 7 43h39l-10-56c-4-22-17-37-35-45 11-8 18-21 18-36 0-28-18-48-43-48Z" />
        <path fill="white" opacity=".12" d="M64 79c7 15 18 22 26 22s19-7 26-22c-5 25-11 50-26 50S69 104 64 79Z" />
        <path fill="currentColor" d="M49 54c2-26 17-45 41-45s39 19 41 45c-12-13-29-20-41-20S61 41 49 54Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 180 220" role="img" aria-label="Silueta varon" className="h-44 w-36 text-slate-950">
      <path fill="currentColor" d="M90 14c-23 0-40 17-40 40 0 17 9 31 23 37-23 7-40 26-43 51l-7 58h39l4-48 10 48h28l10-48 4 48h39l-7-58c-3-25-20-44-43-51 14-6 23-20 23-37 0-23-17-40-40-40Z" />
      <path fill="white" opacity=".1" d="M67 91c7 10 15 15 23 15s16-5 23-15c-4 23-10 41-23 41S71 114 67 91Z" />
      <path fill="currentColor" d="M51 48c4-24 19-38 39-38s35 14 39 38c-10-7-23-10-39-10s-29 3-39 10Z" />
    </svg>
  );
}
