"use client";

import { Printer } from "lucide-react";

export function CatalogPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-3 py-2 text-sm font-bold text-white hover:bg-violet-800"
    >
      <Printer className="size-4" />
      Descargar PDF
    </button>
  );
}
