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
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {statItems.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.key}
            className={cn(
              "flex min-h-16 items-center justify-between rounded-lg border p-2 sm:min-h-24 sm:p-4",
              tones[item.tone]
            )}
          >
            <div>
              <p className="truncate text-[10px] font-semibold sm:text-xs">{item.label}</p>
              <p className="mt-1 text-lg font-bold text-slate-950 sm:mt-2 sm:text-2xl">
                {stats[item.key]}
              </p>
            </div>
            <Icon className="hidden size-9 opacity-30 sm:block" />
          </div>
        );
      })}
    </div>
  );
}
