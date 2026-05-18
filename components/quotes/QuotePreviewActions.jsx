"use client";

import { Eye, FileDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { hasPerm } from "@/lib/permissions";

export function QuotePreviewActions({ publicToken, fileName = "cotizacion", quoteId, userPermissions = {} }) {
  const [downloading, setDownloading] = useState(false);
  const canFord = hasPerm(userPermissions, ["cotizacion_ford", "view"]);
  const canOther = hasPerm(userPermissions, ["cotizacion_otros", "view"]);

  async function downloadServerPdf(url, name) {
    setDownloading(true);
    try {
      const response = await fetch(url, { credentials: "include" });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("application/pdf")) {
        const error = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
        throw new Error(error?.message || "No se pudo generar el PDF de cotizacion.");
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${sanitizeFileName(name)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast.error("No se pudo descargar", { description: error.message || "Revisa la cotizacion." });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mt-5 flex justify-center gap-3 print:hidden">
      {quoteId && canFord ? (
        <>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-60"
            disabled={downloading}
            onClick={() => downloadServerPdf(`/api/cotizacion-preview/${quoteId}/ford-pdf`, fileName)}
          >
            <FileDown className="size-4" />
            {downloading ? "Generando..." : "Descargar PDF"}
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-violet-700 px-4 text-sm font-bold text-white disabled:opacity-60"
            disabled={downloading}
            onClick={() => downloadServerPdf(`/api/cotizacion-preview/${quoteId}/ford-pdf?full=1`, `cotizacion-completa-${quoteId}`)}
          >
            <FileDown className="size-4" />
            Cotizacion + ficha tecnica
          </button>
        </>
      ) : null}
      {quoteId && canOther ? (
        <>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-bold text-white disabled:opacity-60"
            disabled={downloading}
            onClick={() => downloadServerPdf(`/api/cotizacion-preview/${quoteId}/ford-pdf?format=otros`, `cotizacion-otros-${quoteId}`)}
          >
            <FileDown className="size-4" />
            Descargar PDF
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-neutral-700 px-4 text-sm font-bold text-white disabled:opacity-60"
            disabled={downloading}
            onClick={() => downloadServerPdf(`/api/cotizacion-preview/${quoteId}/ford-pdf?format=otros&full=1`, `cotizacion-otros-completa-${quoteId}`)}
          >
            <FileDown className="size-4" />
            Cotizacion + ficha tecnica
          </button>
        </>
      ) : null}
      {publicToken ? (
        <Link className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white" href={`/cotizacion/${publicToken}`}>
          <Eye className="size-4" />
          Ver Enlace Publico
        </Link>
      ) : (
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white opacity-50"
          disabled
        >
          <Eye className="size-4" />
          Ver Enlace Publico
        </button>
      )}
    </div>
  );
}

function sanitizeFileName(value) {
  return String(value || "cotizacion")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "cotizacion";
}
