"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function CatalogPrintButton({ priceId }) {
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const response = await fetch(`/api/catalog/pdf/${priceId}`, { credentials: "include" });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.message || "No se pudo descargar la ficha tecnica.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ficha-tecnica-${priceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("No se pudo descargar", { description: error.message || "Intentalo nuevamente." });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={downloading}
      onClick={downloadPdf}
      className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-3 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60"
    >
      <Download className="size-4" />
      {downloading ? "Descargando..." : "Descargar PDF"}
    </button>
  );
}
