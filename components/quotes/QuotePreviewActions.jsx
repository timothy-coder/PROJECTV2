"use client";

import { Eye, FileDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasPerm } from "@/lib/permissions";

export function QuotePreviewActions({ publicToken, fileName = "cotizacion", quoteId, userPermissions = {} }) {
  const [downloading, setDownloading] = useState(false);
  const [tcDialog, setTcDialog] = useState(null);
  const [tcValue, setTcValue] = useState("");
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

  function requestOtherPdf(full = false) {
    setTcValue("");
    setTcDialog({
      full,
      url: `/api/cotizacion-preview/${quoteId}/ford-pdf?format=otros${full ? "&full=1" : ""}`,
      name: full ? `cotizacion-otros-completa-${quoteId}` : `cotizacion-otros-${quoteId}`,
    });
  }

  function confirmOtherPdf() {
    if (!tcValue.trim()) {
      toast.error("Ingresa el TC");
      return;
    }
    const separator = tcDialog.url.includes("?") ? "&" : "?";
    const url = `${tcDialog.url}${separator}tc=${encodeURIComponent(tcValue.trim())}`;
    const name = tcDialog.name;
    setTcDialog(null);
    downloadServerPdf(url, name);
  }

  return (
    <>
      <div className="mt-4 grid gap-2 print:hidden sm:grid-cols-2 lg:flex lg:justify-end">
        {quoteId && canFord ? (
          <>
            <button
              type="button"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-60 sm:text-sm lg:w-auto"
              disabled={downloading}
              onClick={() => downloadServerPdf(`/api/cotizacion-preview/${quoteId}/ford-pdf`, fileName)}
            >
              <FileDown className="size-4" />
              {downloading ? "Generando..." : "Descargar PDF"}
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-violet-700 px-3 text-xs font-bold text-white disabled:opacity-60 sm:text-sm lg:w-auto"
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
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 text-xs font-bold text-white disabled:opacity-60 sm:text-sm lg:w-auto"
              disabled={downloading}
              onClick={() => requestOtherPdf(false)}
            >
              <FileDown className="size-4" />
              Descargar PDF
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-neutral-700 px-3 text-xs font-bold text-white disabled:opacity-60 sm:text-sm lg:w-auto"
              disabled={downloading}
              onClick={() => requestOtherPdf(true)}
            >
              <FileDown className="size-4" />
              Cotizacion + ficha tecnica
            </button>
          </>
        ) : null}
        {publicToken ? (
          <Link className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white sm:text-sm lg:w-auto" href={`/cotizacion/${publicToken}`}>
            <Eye className="size-4" />
            Ver Enlace Publico
          </Link>
        ) : (
          <button
            type="button"
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white opacity-50 sm:text-sm lg:w-auto"
            disabled
          >
            <Eye className="size-4" />
            Ver Enlace Publico
          </button>
        )}
      </div>
      <Dialog open={Boolean(tcDialog)} onOpenChange={(open) => !open && setTcDialog(null)}>
        <DialogContent className="max-w-sm bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>Tipo de cambio</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="quote-tc">TC para la cotizacion otros</Label>
            <Input id="quote-tc" value={tcValue} onChange={(event) => setTcValue(event.target.value)} placeholder="3.55" autoFocus />
          </div>
          <DialogFooter>
            <button type="button" className="h-9 rounded-md border px-4 text-sm font-bold" onClick={() => setTcDialog(null)}>Cancelar</button>
            <button type="button" className="h-9 rounded-md bg-slate-950 px-4 text-sm font-bold text-white" onClick={confirmOtherPdf}>Descargar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
