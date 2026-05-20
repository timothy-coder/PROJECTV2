"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Eye, Filter, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasPerm } from "@/lib/permissions";

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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const status = useMemo(() => (CLOSED_TYPE_STATUS.has(typeStatus) ? "closed" : "open"), [typeStatus]);
  const filteredItems = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => itemSearchText(item).includes(needle));
  }, [items, searchTerm]);

  async function searchLeads({ silent = false } = {}) {
    if (!canSync) return;
    setLoading(true);
    if (!silent) setMessage("");
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

  useEffect(() => {
    if (!canSync) return;
    let cancelled = false;
    Promise.resolve().then(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("startDate", normalizeDateTime("2025-12-02T00:00:00"));
        params.set("status", "open");
        const data = await fetch(`/api/ford-leads?${params.toString()}`).then(readJson);
        if (!cancelled) {
          setItems(data.items || []);
          setMessage(`Se encontraron ${data.items?.length || 0} leads.`);
        }
      } catch (error) {
        if (!cancelled) setMessage(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [canSync]);

  return (
    <div className="min-h-[calc(100svh-80px)] space-y-5 bg-slate-50 p-4 text-black sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-black">Leads Ford</h1>
          <p className="mt-1 text-sm text-slate-600">Consulta, crea y actualiza leads usando la configuracion Ford del entorno.</p>
        </div>
        {canCreate ? (
          <Link href="/leads-ford/nuevo">
            <Button>
              <Send className="mr-2 size-4" />
              Agregar Lead
            </Button>
          </Link>
        ) : null}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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

          {message ? <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-black">{message}</div> : null}

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-bold text-black">Resultados</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{filteredItems.length} visibles</span>
            </div>
            <div className="max-h-[calc(100svh-360px)] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-black">
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
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-black">Cargando leads...</td>
                  </tr>
                ) : null}
                {!loading && filteredItems.map((item, index) => (
                  <tr key={`${item.id || "lead"}-${index}`} className="hover:bg-slate-50">
                    <td className="max-w-[190px] truncate px-3 py-2 font-mono text-xs">{item.id || "-"}</td>
                    <td className="px-3 py-2">{item.status || "-"}</td>
                    <td className="px-3 py-2 font-medium">{contactName(item.contact)}</td>
                    <td className="px-3 py-2 text-black">{item.contact?.email || item.contact?.mobilePhone || item.contact?.phone || "-"}</td>
                    <td className="px-3 py-2">{vehicleName(item.vehicle)}</td>
                    <td className="px-3 py-2">{formatFordDate(item.lastModifiedDate || item.createdDate)}</td>
                    <td className="px-3 py-2 text-right">
                      {item.id ? (
                        <Link href={`/leads-ford/${encodeURIComponent(item.id)}`} className="inline-flex size-7 items-center justify-center rounded-md hover:bg-slate-100" title="Ver detalle">
                          <Eye className="size-4" />
                        </Link>
                      ) : (
                        <Button size="icon" variant="ghost">
                          <Eye className="size-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && !filteredItems.length ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-slate-600">No hay leads para mostrar con estos filtros.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            </div>
          </div>
        </div>
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
