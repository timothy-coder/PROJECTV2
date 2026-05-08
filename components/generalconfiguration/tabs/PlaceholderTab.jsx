"use client";

import { LockKeyhole } from "lucide-react";

export function PlaceholderTab({ tab }) {
  const Icon = tab.icon || LockKeyhole;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-950">{tab.label}</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Este modulo ya esta separado para implementar su tabla, API y botones con permisos propios.
          </p>
        </div>
      </div>
    </section>
  );
}
