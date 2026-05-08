"use client";

import { statItems } from "@/components/generalconfiguration/config";
import { cn } from "@/lib/utils";

const tones = {
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
};

export function StatsGrid({ stats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {statItems.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.key}
            className={cn(
              "flex min-h-24 items-center justify-between rounded-lg border p-4",
              tones[item.tone]
            )}
          >
            <div>
              <p className="text-xs font-semibold">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {stats[item.key]}
              </p>
            </div>
            <Icon className="size-9 opacity-30" />
          </div>
        );
      })}
    </div>
  );
}
