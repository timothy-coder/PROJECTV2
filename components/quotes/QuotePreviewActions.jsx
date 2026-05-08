"use client";

import { Download, Eye } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function QuotePreviewActions({ publicToken, fileName = "cotizacion", targetId = "quote-preview-root", advisorName = "Asesor" }) {
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf() {
    const element = document.getElementById(targetId);
    if (!element) return;
    setDownloading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const maxWidth = pageWidth - margin * 2;
      let y = margin;
      const lines = extractPdfLines(element);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("Resumen de Cotizacion", margin, y);
      y += 8;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      lines.forEach((line) => {
        const wrapped = pdf.splitTextToSize(line, maxWidth);
        wrapped.forEach((text) => {
          if (y > pageHeight - 18) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(text, margin, y);
          y += 5;
        });
        y += 1.5;
      });

      if (y > pageHeight - 58) {
        pdf.addPage();
        y = margin;
      }
      y += 10;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("FIRMA DEL CLIENTE:", margin, y);
      pdf.text("FIRMA DEL ASESOR:", pageWidth / 2 + 6, y);
      y += 22;
      pdf.line(margin, y, pageWidth / 2 - 8, y);
      pdf.line(pageWidth / 2 + 6, y, pageWidth - margin, y);
      y += 6;
      pdf.setFont("helvetica", "normal");
      pdf.text("Cliente", margin, y);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(18);
      pdf.text(advisorName || "Asesor", pageWidth / 2 + 6, y);
      pdf.save(`${sanitizeFileName(fileName)}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mt-5 flex justify-center gap-3 print:hidden">
      <button
        type="button"
        className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-60"
        disabled={downloading}
        onClick={downloadPdf}
      >
        <Download className="size-4" />
        {downloading ? "Generando..." : "Descargar PDF"}
      </button>
      {publicToken ? (
        <Link className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white" href={`/cotizacion/${publicToken}`}>
          <Eye className="size-4" />
          Ver Enlace Publico
        </Link>
      ) : null}
    </div>
  );
}

function extractPdfLines(root) {
  const ignored = new Set(["SCRIPT", "STYLE", "BUTTON", "A"]);
  const nodes = Array.from(root.querySelectorAll("h1,h2,h3,p,th,td,span"));
  const lines = [];
  nodes.forEach((node) => {
    if (ignored.has(node.tagName) || node.closest(".print\\:hidden")) return;
    const text = node.textContent?.replace(/\s+/g, " ").trim();
    if (!text || lines.at(-1) === text) return;
    lines.push(text);
  });
  return lines;
}

function sanitizeFileName(value) {
  return String(value || "cotizacion")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "cotizacion";
}
