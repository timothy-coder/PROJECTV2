"use client";

import { cn } from "@/lib/utils";

export function ConfigurationTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-100 p-1">
      <div className="flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex h-8 min-w-36 shrink-0 items-center justify-center rounded-md px-4 text-xs font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                active
                  ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
              )}
            >
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
