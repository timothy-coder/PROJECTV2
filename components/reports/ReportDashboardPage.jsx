"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import PostventaReportsDashboard from "@/components/reportes/PostventaReportsDashboard";
import SalesReportsDashboard from "@/components/reportes/SalesReportsDashboard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ReportDashboardPage({ type }) {
  const isVentas = type === "ventas";
  const title = isVentas ? "Power BI Ventas" : "Power BI Posventa";

  return (
    <main className="min-h-full bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-violet-200 bg-slate-50/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-bold leading-tight text-violet-700">{title}</h1>
            <p className="mt-0.5 text-xs font-medium text-violet-400">Dashboard interactivo de reportes</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/reportes/ventas"
              className={cn(buttonVariants({ variant: isVentas ? "default" : "outline", size: "lg" }), isVentas ? "bg-violet-700 text-white hover:bg-violet-800" : "border-violet-200 bg-white text-violet-700")}
            >
              Ventas
            </Link>
            <Link
              href="/reportes/posventa"
              className={cn(buttonVariants({ variant: !isVentas ? "default" : "outline", size: "lg" }), !isVentas ? "bg-violet-700 text-white hover:bg-violet-800" : "border-violet-200 bg-white text-violet-700")}
            >
              Posventa
            </Link>
            <Link href="/reportes" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-slate-200 bg-white text-slate-700")}>
              <ArrowLeft className="size-4" />
              Volver
            </Link>
          </div>
        </div>
      </header>
      {isVentas ? <SalesReportsDashboard /> : <PostventaReportsDashboard />}
    </main>
  );
}
