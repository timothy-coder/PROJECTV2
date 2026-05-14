"use client";

import { Download } from "lucide-react";

export function CatalogPrintButton({ priceId }) {
  return (
    <a
      href={`/api/catalog/pdf/${priceId}`}
      download={`ficha-tecnica-${priceId}.pdf`}
      className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-3 py-2 text-sm font-bold text-white hover:bg-violet-800"
    >
      <Download className="size-4" />
      Descargar PDF
    </a>
  );
}
