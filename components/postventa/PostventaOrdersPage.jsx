"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Image as ImageIcon,
  Maximize2,
  Menu,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { hasPerm } from "@/lib/permissions";

const MOCK_ORDERS = [
  { id: 26810, client: "FRANCO PAYANO HINOS...", model: "Ranger", plate: "H3N879", brand: "Ford", loaded: "02:38 pm", inspection: [6, 0, 0], quote: "S/-", communicationAgo: "Hace 2 horas", photos: 5, stage: "Trabajando ahora", docs: 1 },
  { id: 26809, client: "LUIS MIGUEL QUISPE MA...", model: "Ranger", plate: "W8C883", brand: "Ford", loaded: "10:40 am", inspection: [15, 1, 1], quote: "S/-", communicationAgo: "Hace 6 horas", photos: 21, stage: "Trabajando ahora", docs: 1 },
  { id: 26785, client: "ELIA VERA DE LA CRUZ", model: "Territory 2024", plate: "W5J491", brand: "Ford", loaded: "10:19 am", inspection: [5, 0, 0], quote: "S/-", communicationAgo: "Hace 6 horas", photos: 5, stage: "Trabajando ahora", docs: 1 },
  { id: 26808, client: "SHIRLI JESSENIA OLAEC...", model: "Explorer", plate: "CSN500", brand: "Ford", loaded: "10:05 am", inspection: [20, 0, 1], quote: "S/-", communicationAgo: "Hace 6 horas", photos: 24, stage: "Control de calidad y de entrega", docs: 1 },
  { id: 26807, client: "DANTE LUIS ROJAS TOR...", model: "Ecosport 2022", plate: "W4I248", brand: "Ford", loaded: "09:36 am", inspection: [5, 0, 0], quote: "S/-", communicationAgo: "Hace 7 horas", photos: 5, stage: "Trabajando ahora", docs: 2 },
  { id: 26806, client: "", model: "Explorer", plate: "W4Z261", brand: "Ford", loaded: "09:06 am", inspection: [64, 0, 0], quote: "S/-", communicationAgo: "Hace 7 horas", photos: 13, stage: "Control de calidad y de entrega", docs: 1 },
  { id: 26805, client: "JESUS GUTARRA ALAYO", model: "Territory 2024", plate: "CLJ031", brand: "Ford", loaded: "08:57 am", inspection: [17, 0, 3], quote: "S/-", communicationAgo: "Hace 8 horas", photos: 19, stage: "Paralizado", docs: 1 },
  { id: 26804, client: "RAUL HUAMANCHaQUI ...", model: "Territory 2023", plate: "W5E014", brand: "Ford", loaded: "08:23 am", inspection: [80, 1, 2], quote: "S/-", communicationAgo: "Hace 8 horas", photos: 22, stage: "Listo para entrega", docs: 1 },
];

export default function PostventaOrdersPage({ userPermissions }) {
  const [orderNumber, setOrderNumber] = useState("");
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const canView = Boolean(hasPerm(userPermissions, ["ordenespv", "view"]) || hasPerm(userPermissions, ["ordenespv", "viewall"]));
  const canCreate = Boolean(hasPerm(userPermissions, ["ordenespv", "create"]));

  const rows = useMemo(() => {
    const cleanOrder = orderNumber.trim();
    const cleanQuery = query.trim().toLowerCase();

    return MOCK_ORDERS.filter((order) => {
      const matchesOrder = !cleanOrder || String(order.id).includes(cleanOrder);
      const matchesQuery =
        !cleanQuery ||
        [order.client, order.model, order.plate, order.stage, order.brand].filter(Boolean).join(" ").toLowerCase().includes(cleanQuery);

      return matchesOrder && matchesQuery;
    });
  }, [orderNumber, query]);

  if (!canView) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver ordenes de PostVenta.</div>;
  }

  return (
    <div className="min-h-full bg-[#f7f7f8] text-slate-700">
      <TopBar />
      <div className="bg-amber-400 px-6 py-4 text-center text-xs font-bold text-white">
        Su cuenta tiene un saldo vencido. Envie su comprobante a <span className="underline">cobranza@clearcheck.us</span> para evitar que su cuenta sea suspendida. Obtenga hasta 20% de descuento con pago anticipado anual.
      </div>

      <main className="px-6 py-6">
        <section className="mx-auto max-w-[1720px]">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid flex-1 gap-3 lg:grid-cols-[280px_1fr] xl:max-w-[980px]">
              <FilterInput placeholder="# Orden" value={orderNumber} onChange={setOrderNumber} />
              <FilterInput placeholder="Filtrar (Tipo de Orden, VIN, placas, cliente, miembro del equipo)" value={query} onChange={setQuery} wide />
              <DateInput placeholder="Inicio: DD/MM/YY" value={startDate} onChange={setStartDate} />
              <div className="grid gap-3 sm:grid-cols-[220px_220px_160px]">
                <DateInput placeholder="Fin: DD/MM/YY" value={endDate} onChange={setEndDate} />
                <Button className="h-10 rounded-full bg-blue-400 text-sm font-bold text-white hover:bg-blue-500">
                  <Search className="size-4" />
                  Buscar
                </Button>
                <button type="button" className="h-10 text-left text-xs font-bold text-blue-400">
                  Nueva busqueda
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-4">
              {canCreate ? (
                <Button className="h-10 rounded-full bg-blue-600 px-8 text-sm font-bold text-white hover:bg-blue-700">
                  <Plus className="size-4" />
                  Nueva Orden
                </Button>
              ) : null}
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>
                  <b>Resultado:</b> {rows.length.toLocaleString("es-PE")} Ordenes
                </span>
                <ToolbarIcon icon={ArrowDownToLine} />
                <ToolbarIcon icon={Maximize2} />
                <ToolbarIcon icon={SlidersHorizontal} />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="max-h-[calc(100vh-250px)] min-h-[520px] overflow-auto">
              <table className="w-full min-w-[1240px] border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-white text-slate-600">
                  <tr className="border-b border-slate-200">
                    <HeaderCell className="w-[110px]" />
                    <HeaderCell># ORDEN</HeaderCell>
                    <HeaderCell>CLIENTE/VEHICULO</HeaderCell>
                    <HeaderCell>
                      <span className="inline-flex items-center gap-2">CARGADO <ChevronDown className="size-4" /></span>
                    </HeaderCell>
                    <HeaderCell>
                      <span className="inline-flex items-center gap-2">INSPECCION <SlidersHorizontal className="size-4" /></span>
                    </HeaderCell>
                    <HeaderCell>
                      <span className="inline-flex items-center gap-2">COTIZACION <SlidersHorizontal className="size-4" /></span>
                    </HeaderCell>
                    <HeaderCell>COMUNICACION</HeaderCell>
                    <HeaderCell>
                      <span className="inline-flex items-center gap-2">ETAPA <SlidersHorizontal className="size-4" /></span>
                    </HeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((order) => (
                    <OrderRow key={order.id} order={order} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function TopBar() {
  return (
    <header className="flex h-[54px] items-center justify-between border-b border-slate-200 bg-white px-7">
      <div className="flex items-center gap-4">
        <Menu className="size-5 text-slate-400" />
        <h1 className="text-xl font-bold text-slate-500">Ordenes</h1>
      </div>
      <div className="flex items-center gap-2">
        <RoundButton icon={Bell} alert />
        <RoundButton icon={MessageSquare} alert />
        <RoundButton icon={MoreVertical} />
      </div>
    </header>
  );
}

function FilterInput({ placeholder, value, onChange, wide = false }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`h-10 rounded-full border border-slate-300 bg-white px-5 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${wide ? "min-w-0" : ""}`}
    />
  );
}

function DateInput({ placeholder, value, onChange }) {
  return (
    <label className="flex h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-xs text-blue-500 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
      <span className="min-w-0 flex-1 truncate">{value || placeholder}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} type="date" className="h-0 w-0 opacity-0" />
      <CalendarDays className="size-5 shrink-0 text-blue-500" />
    </label>
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

function ToolbarIcon({ icon: Icon }) {
  return (
    <button type="button" className="grid size-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
      <Icon className="size-4" />
    </button>
  );
}

function HeaderCell({ children, className = "" }) {
  return <th className={`h-16 px-6 text-[11px] font-extrabold uppercase tracking-wide ${className}`}>{children}</th>;
}

function OrderRow({ order }) {
  const openDetail = () => {
    window.location.href = `/ordenes/${order.id}`;
  };

  return (
    <tr className="h-20 bg-white transition hover:bg-blue-50/30">
      <td className="px-6">
        <div className="flex items-center gap-3 text-blue-500">
          <div className="relative">
            <ClipboardList className="size-6 stroke-[1.8]" />
            <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">{order.docs}</span>
          </div>
          <button type="button" onClick={openDetail} title="Ver detalle de orden" className="rounded-full p-1 transition hover:bg-blue-100">
            <ChevronRight className="size-5 stroke-[3]" />
          </button>
        </div>
      </td>
      <td className="px-6 text-sm font-bold text-blue-500">
        <button type="button" onClick={openDetail} className="font-bold hover:underline">
          {order.id}
        </button>
      </td>
      <td className="px-6">
        <div className="grid grid-cols-[34px_1fr] items-center gap-2">
          <BrandBadge label={order.brand} />
          <div className="min-w-0">
            {order.client ? <p className="truncate text-xs font-extrabold uppercase text-slate-600">{order.client}</p> : null}
            <p className="mt-1 text-[11px] text-slate-500">{order.model}</p>
            <p className="mt-1 text-[11px] text-slate-500">{order.plate}</p>
          </div>
        </div>
      </td>
      <td className="px-6 text-xs text-slate-500">{order.loaded}</td>
      <td className="px-6">
        <div className="flex items-center gap-3">
          <Metric value={order.inspection[0]} color="green" />
          <Metric value={order.inspection[1]} color="yellow" />
          <Metric value={order.inspection[2]} color="red" />
          <div className="relative text-slate-400">
            <Bell className="size-4 fill-slate-400" />
            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-red-500" />
          </div>
        </div>
      </td>
      <td className="px-6">
        <div className="flex items-center gap-4">
          <DollarSign className="size-5 rounded border border-blue-400 bg-blue-50 p-0.5 text-blue-500" />
          <span className="text-sm font-bold text-slate-600">{order.quote}</span>
        </div>
      </td>
      <td className="px-6">
        <p className="text-xs font-extrabold text-slate-600">Cargado</p>
        <p className="text-[11px] text-slate-500">{order.communicationAgo}</p>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
          <ImageIcon className="size-4" />
          {order.photos}
        </div>
      </td>
      <td className="px-6">
        <p className="max-w-[180px] text-xs font-extrabold text-slate-600">{order.stage}</p>
      </td>
    </tr>
  );
}

function BrandBadge({ label }) {
  return (
    <div className="grid h-4 w-8 place-items-center rounded-full bg-blue-700 text-[7px] font-bold italic text-white shadow-sm ring-1 ring-blue-300">
      {label}
    </div>
  );
}

function Metric({ value, color }) {
  const colors = {
    green: "bg-emerald-400 text-white",
    yellow: "bg-amber-400 text-white",
    red: "bg-red-500 text-white",
  };

  return <span className={`grid size-6 place-items-center rounded-full text-[11px] font-extrabold ${colors[color]}`}>{value}</span>;
}
