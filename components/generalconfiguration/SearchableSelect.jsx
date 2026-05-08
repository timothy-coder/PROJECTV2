"use client";

import { useMemo, useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SearchableSelect({
  value,
  options = [],
  placeholder = "Selecciona una opcion",
  searchPlaceholder = "Buscar...",
  emptyText = "Sin resultados",
  disabled,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value]
  );

  return (
    <div className="relative w-full">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="h-9 w-full justify-between bg-white px-3 text-left text-sm font-medium text-slate-950"
      >
        <span className={cn("truncate", !selected && "text-slate-500")}>
          {selected?.label || placeholder}
        </span>
        <ChevronsUpDown className="size-4 text-slate-400" />
      </Button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Cerrar selector"
            className="fixed inset-0 z-[80] cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-[90] mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
            <Command className="bg-white">
              <div className="flex h-9 items-center gap-2 border-b border-slate-200 px-3">
                <Search className="size-4 text-slate-400" />
                <Command.Input
                  placeholder={searchPlaceholder}
                  className="h-full w-full bg-transparent text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400"
                />
              </div>
              <Command.List className="max-h-56 overflow-y-auto p-1">
                <Command.Empty className="px-3 py-6 text-center text-sm font-medium text-slate-500">
                  {emptyText}
                </Command.Empty>
                {options.map((option) => (
                  <Command.Item
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => {
                      onChange(String(option.value));
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-700 outline-none data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-950"
                  >
                    <span className="truncate">{option.label}</span>
                    {String(option.value) === String(value) ? (
                      <Check className="size-4 text-blue-600" />
                    ) : null}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </div>
        </>
      ) : null}
    </div>
  );
}
