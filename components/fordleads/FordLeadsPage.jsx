"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Eye, Filter, Pencil, Search, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { hasPerm } from "@/lib/permissions";

const DEFAULT_PAYLOAD = {
  status: "Assigned",
  contact: {
    name: "Nombre Cliente",
    documentType: "RUC",
    documentNumber: "00000000000",
    country: "PER",
    email: "cliente@email.com",
    phone: "999999999",
    mobilePhone: "999999999",
    contactPreference: "Phone",
    company: "",
    agreeReceiveContact: false,
    address: {
      city: "Lima",
      country: "PER",
      postalCode: "",
      state: "Lima",
      street: "",
    },
  },
  vehicle: {
    model: "Mustang Peru",
    version: "1.0",
  },
  preferenceDealer: {
    code: "S28817",
  },
  leadSource: {
    origin: "Manual",
    subOrigin: "Website",
    subOrigin2: "Organic",
  },
  financingFlag: false,
  currentVehicleExchange: "No",
};

const TYPE_STATUS_OPTIONS = [
  "",
  "New",
  "Certified",
  "Assigned",
  "Warming",
  "Agency Classification",
  "ChatBot Classification",
  "Rescheduled",
  "SalesManager",
  "Seller",
  "ContactFail",
  "Contacted",
  "Test-Drive",
  "Negotiating",
  "OnVisit",
  "Order",
  "Quotation",
  "Purchase Order",
  "Billing",
  "Closed Won",
  "Closed Lost",
  "Signed",
];

const CLOSED_TYPE_STATUS = new Set(["Closed Won", "Closed Lost", "Signed"]);

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function normalizeDateTime(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";
  const clean = text.replace(" ", "T").replace(".000Z", "Z").replace(/[zZ]$/, "");
  const [datePart, timePart = "00:00:00"] = clean.split("T");
  const timePieces = timePart.split(":");
  const hours = timePieces[0] || "00";
  const minutes = timePieces[1] || "00";
  const seconds = timePieces[2] || "00";
  return `${datePart}T${hours}:${minutes}:${seconds}Z`;
}

function contactName(contact = {}) {
  return contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "-";
}

function vehicleName(vehicle = {}) {
  return [vehicle.model, vehicle.version].filter(Boolean).join(" ") || "-";
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Ocurrio un error.");
  return payload;
}

function formatFordDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function itemSearchText(item = {}) {
  return [
    item.id,
    item.status,
    item.contact?.name,
    item.contact?.firstName,
    item.contact?.lastName,
    item.contact?.documentNumber,
    item.contact?.email,
    item.contact?.phone,
    item.contact?.mobilePhone,
    item.vehicle?.brand,
    item.vehicle?.marca,
    item.vehicle?.model,
    item.vehicle?.modelo,
    item.vehicle?.version,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function FordLeadsPage({ userPermissions = {} }) {
  const canSync = hasPerm(userPermissions, ["leads_ford", "sync"]);
  const canCreate = hasPerm(userPermissions, ["leads_ford", "create"]);
  const canEdit = hasPerm(userPermissions, ["leads_ford", "edit"]);

  const [startDate, setStartDate] = useState("2025-12-02T00:00:00");
  const [endDate, setEndDate] = useState("");
  const [typeStatus, setTypeStatus] = useState("");
  const [typeStatusOpen, setTypeStatusOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [leadId, setLeadId] = useState("");
  const [createPayload, setCreatePayload] = useState(safeJson(DEFAULT_PAYLOAD));
  const [patchPayload, setPatchPayload] = useState("{\n  \"status\": \"Contacted\"\n}");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/ford-leads?config=1")
      .then(readJson)
      .then((data) => {
        if (data.dealerCode || data.country) {
          setCreatePayload((current) => {
            try {
              const payload = JSON.parse(current);
              if (data.dealerCode) payload.preferenceDealer = { ...(payload.preferenceDealer || {}), code: data.dealerCode };
              if (data.country) {
                payload.contact = { ...(payload.contact || {}), country: data.country };
                payload.contact.address = { ...(payload.contact.address || {}), country: data.country };
              }
              return safeJson(payload);
            } catch {
              return current;
            }
          });
        }
      })
      .catch((error) => setMessage(error.message));
  }, []);

  const status = useMemo(() => (CLOSED_TYPE_STATUS.has(typeStatus) ? "closed" : "open"), [typeStatus]);
  const filteredItems = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => itemSearchText(item).includes(needle));
  }, [items, searchTerm]);

  async function searchLeads() {
    if (!canSync) return;
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", normalizeDateTime(startDate));
      if (endDate) params.set("endDate", normalizeDateTime(endDate));
      if (status) params.set("status", status);
      if (typeStatus) params.set("typeStatus", typeStatus);

      const data = await fetch(`/api/ford-leads?${params.toString()}`).then(readJson);
      setItems(data.items || []);
      setMessage(`Se encontraron ${data.items?.length || 0} leads.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function findById() {
    if (!leadId.trim()) return setMessage("Ingresa el id del lead.");
    setLoading(true);
    setMessage("");
    try {
      const data = await fetch(`/api/ford-leads/${encodeURIComponent(leadId.trim())}`).then(readJson);
      setSelected(data);
      setMessage("Lead encontrado.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function createLead() {
    setLoading(true);
    setMessage("");
    try {
      const data = await fetch("/api/ford-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(JSON.parse(createPayload)),
      }).then(readJson);
      setSelected(data);
      setMessage(data?.message || "Lead enviado a Ford.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function patchLead() {
    if (!leadId.trim()) return setMessage("Ingresa el id del lead.");
    setLoading(true);
    setMessage("");
    try {
      const data = await fetch(`/api/ford-leads/${encodeURIComponent(leadId.trim())}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(JSON.parse(patchPayload)),
      }).then(readJson);
      setSelected(data);
      setMessage(data?.message || "Lead actualizado en Ford.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Leads Ford</h1>
          <p className="text-sm text-black">Consulta, crea y actualiza leads usando la configuracion Ford del entorno.</p>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Field label="Inicio">
              <Input type="datetime-local" step="1" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </Field>
            <Field label="Fin">
              <Input type="datetime-local" step="1" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </Field>
            <Field label="Estado">
              <Input value={status} readOnly />
            </Field>
            <Field label="Tipo estado">
              <div className="relative">
                <Button type="button" variant="outline" className="h-9 w-full justify-between text-black" onClick={() => setTypeStatusOpen((open) => !open)}>
                  {typeStatus || "Todos"}
                  <ChevronsUpDown className="size-4 opacity-60" />
                </Button>
                {typeStatusOpen ? (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                    <Command>
                      <CommandInput placeholder="Buscar estado..." />
                      <CommandList>
                        <CommandEmpty>Sin resultados.</CommandEmpty>
                        <CommandGroup>
                          {TYPE_STATUS_OPTIONS.map((option) => (
                            <CommandItem
                              key={option || "all"}
                              value={option || "Todos"}
                              onSelect={() => {
                                setTypeStatus(option);
                                setTypeStatusOpen(false);
                              }}
                            >
                              <span>{option || "Todos"}</span>
                              {typeStatus === option ? <Check className="ml-auto size-4" /> : null}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </div>
                ) : null}
              </div>
            </Field>
            <Field label="Buscar">
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="ID, cliente, documento, modelo..." />
            </Field>
            <div className="flex items-end">
              <Button className="w-full" onClick={searchLeads} disabled={!canSync || loading}>
                <Filter className="mr-2 size-4" />
                Filtrar
              </Button>
            </div>
          </div>

          {message ? <div className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-black">{message}</div> : null}

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-black">
                <tr>
                  <th className="px-3 py-2">Id</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Contacto</th>
                  <th className="px-3 py-2">Vehiculo</th>
                  <th className="px-3 py-2">Modificado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, index) => (
                  <tr key={`${item.id || "lead"}-${index}`} className="hover:bg-slate-50">
                    <td className="max-w-[190px] truncate px-3 py-2 font-mono text-xs">{item.id || "-"}</td>
                    <td className="px-3 py-2">{item.status || "-"}</td>
                    <td className="px-3 py-2 font-medium">{contactName(item.contact)}</td>
                    <td className="px-3 py-2 text-black">{item.contact?.email || item.contact?.mobilePhone || item.contact?.phone || "-"}</td>
                    <td className="px-3 py-2">{vehicleName(item.vehicle)}</td>
                    <td className="px-3 py-2">{formatFordDate(item.lastModifiedDate || item.createdDate)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setSelected(item); setLeadId(item.id || ""); }}>
                        <Eye className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!filteredItems.length ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-black">Busca leads para ver resultados.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-black">Buscar por ID</h2>
            <div className="mt-3 flex gap-2">
              <Input value={leadId} onChange={(event) => setLeadId(event.target.value)} placeholder="00Q..." />
              <Button size="icon" variant="outline" onClick={findById} disabled={loading}>
                <Search className="size-4" />
              </Button>
            </div>
          </div>

          {canEdit ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold text-black">Actualizar Lead</h2>
              <Textarea className="mt-3 min-h-32 font-mono text-xs" value={patchPayload} onChange={(event) => setPatchPayload(event.target.value)} />
              <Button className="mt-3 w-full" variant="outline" onClick={patchLead} disabled={loading}>
                <Pencil className="mr-2 size-4" />
                Actualizar en Ford
              </Button>
            </div>
          ) : null}
        </aside>
      </section>

      {canCreate ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-black">Agregar Lead a Ford</h2>
            <Button onClick={createLead} disabled={loading}>
              <Send className="mr-2 size-4" />
              Enviar Lead
            </Button>
          </div>
          <Textarea className="mt-3 min-h-80 font-mono text-xs" value={createPayload} onChange={(event) => setCreatePayload(event.target.value)} />
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-black">Respuesta Ford</h2>
        <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-slate-200 bg-white p-3 text-xs text-black">
          {selected ? safeJson(selected) : "Sin respuesta seleccionada."}
        </pre>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold uppercase text-black">{label}</Label>
      {children}
    </div>
  );
}
