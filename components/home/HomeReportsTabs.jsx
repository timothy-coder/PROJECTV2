"use client";

import { useState } from "react";

import PostventaReportsDashboard from "@/components/reportes/PostventaReportsDashboard";
import SalesReportsDashboard from "@/components/reportes/SalesReportsDashboard";

export function HomeReportsTabs({ showSales, showPostventa }) {
  const initialView = showSales ? "ventas" : "posventa";
  const [view, setView] = useState(initialView);
  const canSwitch = showSales && showPostventa;
  const switcher = canSwitch ? (
    <div className="inline-flex h-9 items-center gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-violet-100">
      <button
        type="button"
        className={`h-7 rounded-md px-3 text-sm font-bold transition ${view === "ventas" ? "bg-violet-700 text-white shadow-sm" : "text-violet-700 hover:bg-violet-50"}`}
        onClick={() => setView("ventas")}
      >
        Ventas
      </button>
      <button
        type="button"
        className={`h-7 rounded-md px-3 text-sm font-bold transition ${view === "posventa" ? "bg-violet-700 text-white shadow-sm" : "text-violet-700 hover:bg-violet-50"}`}
        onClick={() => setView("posventa")}
      >
        Posventa
      </button>
    </div>
  ) : null;

  return (
    <main className="min-w-0 bg-slate-50">
      {view === "ventas" && showSales ? <SalesReportsDashboard viewSwitcher={switcher} /> : null}
      {view === "posventa" && showPostventa ? <PostventaReportsDashboard viewSwitcher={switcher} /> : null}
    </main>
  );
}
