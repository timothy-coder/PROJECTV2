"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  className,
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const selected = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value]
  );

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      setPosition(null);
      return;
    }
    const gap = 4;
    const desiredHeight = Math.min(300, 48 + options.length * 40);
    const bottomSpace = window.innerHeight - rect.bottom - gap;
    const topSpace = rect.top - gap;
    const openUp = bottomSpace < Math.min(160, desiredHeight) && topSpace > bottomSpace;
    const maxHeight = Math.max(180, Math.min(desiredHeight, openUp ? topSpace : bottomSpace));
    const width = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8);
    setPosition({
      top: openUp ? rect.top - maxHeight - gap : rect.bottom + gap,
      left,
      width,
      maxHeight,
    });
  }, [options.length]);

  useEffect(() => {
    if (!open) return undefined;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const dropdown = open ? (
    <>
      <button
        type="button"
        aria-label="Cerrar selector"
        className="fixed inset-0 z-[80] cursor-default"
        onClick={() => setOpen(false)}
      />
      <div
        className="fixed z-[90] max-h-[min(320px,calc(100svh-1rem))] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        style={position ? { top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight } : undefined}
      >
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
  ) : null;

  return (
    <div className="relative w-full">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          updatePosition();
          setOpen((current) => !current);
        }}
        className={cn("h-9 w-full justify-between bg-white px-3 text-left text-sm font-medium text-slate-950", className)}
      >
        <span className={cn("truncate", !selected && "text-slate-500")}>
          {selected?.label || placeholder}
        </span>
        <ChevronsUpDown className="size-4 text-slate-400" />
      </Button>
      {dropdown && typeof document !== "undefined" ? createPortal(dropdown, document.body) : dropdown}
    </div>
  );
}
