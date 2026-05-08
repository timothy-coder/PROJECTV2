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
      const { default: autoTable } = await import("jspdf-autotable");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      let y = 18;
      const data = extractQuotePdfData(element);

      pdf.setFillColor(94, 23, 235);
      pdf.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text(data.title || "Resumen de Cotizacion", margin + 6, y + 11);
      pdf.setFontSize(10);
      pdf.text(data.code || sanitizeFileName(fileName), margin + 6, y + 19);
      pdf.text(new Date().toLocaleDateString("es-PE"), pageWidth - margin - 6, y + 11, { align: "right" });
      y += 38;

      data.sections.forEach((section) => {
        y = drawSection(pdf, autoTable, section, y, { margin, pageWidth, pageHeight });
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

function extractQuotePdfData(root) {
  const title = root.querySelector("header h1")?.textContent?.trim() || root.querySelector("h1")?.textContent?.trim() || "Resumen de Cotizacion";
  const code = root.querySelector("header p")?.textContent?.trim() || "";
  const sections = Array.from(root.querySelectorAll(":scope > section, :scope > div > section, section"))
    .filter((section, index, all) => all.findIndex((item) => item === section) === index)
    .map((section) => extractSection(section))
    .filter((section) => section.title || section.lines.length || section.tables.length);
  return { title, code, sections };
}

function extractSection(section) {
  const ignored = new Set(["SCRIPT", "STYLE", "BUTTON", "A"]);
  const title = section.querySelector("h2,h3")?.textContent?.replace(/\s+/g, " ").trim() || "";
  const titleNode = section.querySelector("h2,h3");
  const lines = [];
  const nodes = Array.from(section.querySelectorAll("p,span,div"));
  nodes.forEach((node) => {
    if (ignored.has(node.tagName) || node.closest(".print\\:hidden") || node.closest("table") || node === titleNode || node.contains(titleNode)) return;
    if (node.children.length > 2) return;
    const text = node.textContent?.replace(/\s+/g, " ").trim();
    if (!text || text === title || lines.includes(text) || text.length > 180) return;
    lines.push(text);
  });
  const tables = Array.from(section.querySelectorAll("table")).map((table) => ({
    head: Array.from(table.querySelectorAll("thead th")).map((cell) => cleanText(cell.textContent)),
    body: Array.from(table.querySelectorAll("tbody tr")).map((row) => Array.from(row.querySelectorAll("td")).map((cell) => cleanText(cell.textContent))).filter((row) => row.some(Boolean)),
  })).filter((table) => table.head.length && table.body.length);
  return { title, lines: compactLines(lines), tables };
}

function compactLines(lines) {
  return lines.filter((line, index) => {
    if (!line) return false;
    const previous = lines[index - 1] || "";
    return line !== previous && !previous.includes(line);
  }).slice(0, 36);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function drawSection(pdf, autoTable, section, y, ctx) {
  const { margin, pageWidth, pageHeight } = ctx;
  if (y > pageHeight - 45) {
    pdf.addPage();
    y = margin;
  }

  const blockX = margin;
  const blockWidth = pageWidth - margin * 2;
  const startY = y;
  const minHeight = section.tables.length ? 26 : Math.min(92, 22 + Math.ceil(section.lines.length / 2) * 11);

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(blockX, y, blockWidth, minHeight, 3, 3, "FD");
  pdf.setTextColor(94, 23, 235);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(section.title || "Detalle", blockX + 5, y + 8);
  y += 15;

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(8);
  const columnWidth = (blockWidth - 16) / 2;
  section.lines.slice(0, section.tables.length ? 8 : 28).forEach((line, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = blockX + 5 + col * (columnWidth + 6);
    const lineY = y + row * 10;
    if (lineY > pageHeight - 20) return;
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(x, lineY - 4, columnWidth, 8, 2, 2, "F");
    pdf.setFont("helvetica", "normal");
    pdf.text(pdf.splitTextToSize(line, columnWidth - 4), x + 2, lineY);
  });
  y = Math.max(startY + minHeight + 7, y + Math.ceil(Math.min(section.lines.length, section.tables.length ? 8 : 28) / 2) * 10 + 6);

  section.tables.forEach((table) => {
    if (y > pageHeight - 35) {
      pdf.addPage();
      y = margin;
    }
    autoTable(pdf, {
      startY: y,
      head: [table.head],
      body: table.body,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", textColor: [15, 23, 42] },
      headStyles: { fillColor: [94, 23, 235], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });
    y = pdf.lastAutoTable.finalY + 8;
  });

  return y;
}

function sanitizeFileName(value) {
  return String(value || "cotizacion")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "cotizacion";
}
