"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, CalendarClock, Car, ClipboardList, Database, FileText, Search, ShieldCheck, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hasPerm } from "@/lib/permissions";

const REPORTS = [
  {
    id: "ventas-powerbi",
    title: "One Solution",
    description: "Oportunidades, cotizaciones, reservas, clientes y unidades.",
    category: "Ventas",
    href: "/reportes/ventas",
    icon: Database,
    permissions: [["reportes", "view"], ["home", "view"], ["home", "ventas"]],
    requireAllPermissions: true,
    badge: "Dashboard",
  },
  {
    id: "posventa-powerbi",
    title: "One Solution",
    description: "Ordenes, oportunidades, mantenimientos y cotizaciones de posventa.",
    category: "Posventa",
    href: "/reportes/posventa",
    icon: Wrench,
    permissions: [["reportes", "view"], ["home", "view"], ["home", "posventa"]],
    requireAllPermissions: true,
    badge: "Dashboard",
  },
  {
    id: "reservas",
    title: "Notas de Pedido",
    description: "Seguimiento de reservas, firmas, estados y observaciones.",
    category: "Ventas",
    href: "/reservas",
    icon: FileText,
    permissions: [["reservas", "view"]],
    badge: "Modulo",
  },
  {
    id: "oportunidades",
    title: "Oportunidades Venta",
    description: "Embudo comercial, etapas, cierre, asesor y modelo cotizado.",
    category: "Ventas",
    href: "/oportunidades",
    icon: BarChart3,
    permissions: [["oportunidades", "view"]],
    badge: "Modulo",
  },
  {
    id: "leads-ford",
    title: "Leads Ford",
    description: "Leads enviados, token Ford, asesor, modelo y fechas.",
    category: "Ventas",
    href: "/leads-ford",
    icon: Car,
    permissions: [["leads_ford", "view"]],
    badge: "Modulo",
  },
  {
    id: "agenda",
    title: "Agenda Comercial",
    description: "Citas, asesores, clientes, horarios y actividades.",
    category: "Ventas",
    href: "/agenda",
    icon: CalendarClock,
    permissions: [["agenda", "view"]],
    badge: "Modulo",
  },
  {
    id: "oportunidadespv",
    title: "Oportunidades Posventa",
    description: "Etapas, estados, vehiculo, cliente y mantenimiento.",
    category: "Posventa",
    href: "/oportunidadespv",
    icon: ClipboardList,
    permissions: [["oportunidadespv", "view"]],
    badge: "Modulo",
  },
  {
    id: "proximos-mantenimientos",
    title: "Proximos Mantenimientos",
    description: "Clientes, vehiculos, vencimientos y dias restantes.",
    category: "Posventa",
    href: "/proximosmantenimientos",
    icon: ShieldCheck,
    permissions: [["oportunidadespv", "view"]],
    badge: "Modulo",
  },
];

const CATEGORIES = ["Todos", "Ventas", "Posventa"];

function canSeeReport(userPermissions, report) {
  if (report.requireAllPermissions) {
    return report.permissions.every((permission) => hasPerm(userPermissions, permission));
  }
  return report.permissions.some((permission) => hasPerm(userPermissions, permission));
}

export default function ReportsPage({ userPermissions = {} }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");

  const visibleReports = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return REPORTS
      .filter((report) => canSeeReport(userPermissions, report))
      .filter((report) => category === "Todos" || report.category === category)
      .filter((report) => !needle || `${report.title} ${report.description} ${report.category}`.toLowerCase().includes(needle));
  }, [category, query, userPermissions]);

  const counts = useMemo(() => {
    const allowed = REPORTS.filter((report) => canSeeReport(userPermissions, report));
    return {
      total: allowed.length,
      ventas: allowed.filter((report) => report.category === "Ventas").length,
      posventa: allowed.filter((report) => report.category === "Posventa").length,
    };
  }, [userPermissions]);

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-950 sm:p-4">
      <header className="mb-3 border-b border-violet-200 pb-3">
        <h1 className="text-base font-bold leading-tight text-violet-700">Reportes</h1>
        <p className="mt-0.5 text-xs font-medium text-violet-400">Accesos compactos a reportes y fuentes de datos</p>
      </header>

      <section className="mb-3 grid grid-cols-3 gap-2">
        <Stat label="Total" value={counts.total} />
        <Stat label="Ventas" value={counts.ventas} />
        <Stat label="Posventa" value={counts.posventa} />
      </section>

      <section className="mb-3 rounded-lg border bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar reporte..."
              className="h-9 bg-white pl-8 text-sm"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {CATEGORIES.map((item) => (
              <Button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                variant={category === item ? "default" : "outline"}
                size="lg"
                className={`shrink-0 ${
                  category === item
                    ? "bg-violet-700 text-white hover:bg-violet-800"
                    : "border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
                }`}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visibleReports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
        {!visibleReports.length ? (
          <div className="rounded-lg border border-dashed bg-white p-6 text-center text-sm font-semibold text-slate-500 md:col-span-2 xl:col-span-3">
            No hay reportes disponibles con esos filtros.
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-violet-100 bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] font-bold uppercase leading-tight text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black leading-none text-violet-700 sm:text-xl">{value}</p>
    </div>
  );
}

function ReportCard({ report }) {
  const Icon = report.icon;
  const openButton = (
    <Link href={report.href} className="inline-flex h-8 items-center justify-center rounded-md border border-violet-200 px-3 text-xs font-bold text-violet-700 hover:bg-violet-50">
      Abrir
    </Link>
  );

  return (
    <Card size="sm" className="bg-white shadow-sm transition hover:ring-violet-200 hover:shadow-md">
      <CardHeader className="grid-cols-[auto_1fr_auto] items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-bold leading-tight text-slate-900">{report.title}</CardTitle>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{report.badge}</span>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-2 text-xs leading-snug text-slate-500">{report.description}</p>
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">{report.category}</span>
        {openButton}
      </CardFooter>
    </Card>
  );
}
