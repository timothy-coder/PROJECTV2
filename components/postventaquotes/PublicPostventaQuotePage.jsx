"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

const money = (value, code = "S/") => `${code || "S/"} ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PublicPostventaQuotePage({ token }) {
  const [state, setState] = useState({ loading: true, quote: null, error: "" });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/postventa-quotes/public/${token}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || "No se pudo cargar la cotizacion.");
        if (active) setState({ loading: false, quote: data.quote, error: "" });
      } catch (error) {
        if (active) setState({ loading: false, quote: null, error: error.message });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [token]);

  const totals = useMemo(() => state.quote ? calculateDisplayTotals(state.quote) : null, [state.quote]);

  if (state.loading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-slate-50 text-slate-600">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Cargando cotizacion...
      </main>
    );
  }

  if (state.error) {
    return <main className="flex min-h-svh items-center justify-center bg-slate-50 p-4 text-center font-bold text-slate-700">{state.error}</main>;
  }

  const quote = state.quote;
  const currency = quote.monedaCodigo || quote.monedaSimbolo || "S/";

  return (
    <main className="min-h-svh bg-slate-100 p-3 text-slate-950 sm:p-6">
      <section className="mx-auto max-w-5xl rounded-xl bg-white shadow-sm">
        <header className="border-b p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-emerald-700">Cotizacion PostVenta</p>
              <h1 className="text-2xl font-black">#{quote.id} - {quote.tipo === "pyp" ? "PYP" : "Taller"}</h1>
              <p className="mt-1 text-sm text-slate-500">{quote.descripcion || "Cotizacion de servicio"}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" />
              Imprimir
            </Button>
          </div>
        </header>

        <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
          <Info label="Cliente" value={quote.cliente} />
          <Info label="Estado" value={<span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold capitalize text-emerald-700"><CheckCircle2 className="size-3" />{quote.estado}</span>} />
          <Info label="Fecha" value={quote.createdAt ? new Date(quote.createdAt).toLocaleDateString("es-PE") : "-"} />
          <Info label="Creado por" value={quote.creadoPor} />
          <Info label="Horas" value={Number(quote.horasTrabajo || 0).toFixed(2)} />
          <Info label="Total" value={<b className="text-lg text-emerald-700">{money(quote.total, currency)}</b>} />
        </div>

        <div className="space-y-6 p-5 pt-0 sm:p-6 sm:pt-0">
          <Table title="Productos" columns={["Nro. Parte", "Descripcion", "Cant.", "Precio", "Subtotal"]}>
            {quote.products.map((item) => {
              const subtotal = Number(item.precioUnitario || 0) * Number(item.cantidad || 0);
              const discount = subtotal * Number(item.descuentoPorcentaje || 0) / 100;
              return (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2 font-bold">{item.numeroParte || "-"}</td>
                  <td>{item.descripcion || "-"}</td>
                  <td>{item.cantidad}</td>
                  <td>{money(item.precioUnitario, currency)}</td>
                  <td className="font-bold">{money(Math.max(subtotal - discount, 0), currency)}</td>
                </tr>
              );
            })}
            {!quote.products.length ? <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Sin productos.</td></tr> : null}
          </Table>

          <Table title="Adicionales" columns={["Descripcion", "Monto", "Descuento", "Total"]}>
            {quote.extras.map((item) => {
              const discount = item.descuentoTipo === "monto" ? Number(item.descuentoValor || 0) : Number(item.monto || 0) * Number(item.descuentoValor || 0) / 100;
              return (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">{item.descripcion}</td>
                  <td>{money(item.monto, currency)}</td>
                  <td>{discount ? `-${money(discount, currency)}` : "-"}</td>
                  <td className="font-bold">{money(Math.max(Number(item.monto || 0) - discount, 0), currency)}</td>
                </tr>
              );
            })}
            {!quote.extras.length ? <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">Sin adicionales.</td></tr> : null}
          </Table>

          <section className="rounded-xl border bg-slate-50 p-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Summary label="Subtotal productos" value={money(quote.subtotalProductos, currency)} />
              <Summary label="Subtotal mano de obra" value={money(quote.subtotalManoObra, currency)} />
              <Summary label="Subtotal adicionales" value={money(quote.subtotalExtras, currency)} />
              <Summary label="Descuento total" value={`-${money(totals.generalDiscount, currency)}`} />
              <Summary label="IGV" value={quote.incluirIgv ? money(totals.tax, currency) : "-"} />
              <Summary label="TOTAL" value={money(quote.total, currency)} strong />
            </div>
          </section>

          <p className="flex items-center gap-2 text-xs text-slate-500">
            <CalendarClock className="size-4" />
            Este enlace registra las aperturas para seguimiento interno.
          </p>
        </div>
      </section>
    </main>
  );
}

function calculateDisplayTotals(quote) {
  const base = Number(quote.subtotalProductos || 0) + Number(quote.subtotalManoObra || 0) + Number(quote.subtotalExtras || 0);
  const generalDiscount = Number(quote.descuentoMonto || 0) + base * Number(quote.descuentoPorcentaje || 0) / 100;
  const taxable = Math.max(base - generalDiscount, 0);
  const tax = quote.incluirIgv ? taxable * Number(quote.impuestoPorcentaje || 0) / 100 : 0;
  return { generalDiscount, tax };
}

function Info({ label, value }) {
  return <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><div className="mt-1 font-bold">{value || "-"}</div></div>;
}

function Table({ title, columns, children }) {
  return (
    <section>
      <h2 className="mb-3 font-bold">{title}</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr>{columns.map((column) => <th key={column} className="px-3 py-2">{column}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

function Summary({ label, value, strong }) {
  return <div className={`flex justify-between ${strong ? "text-lg font-black text-emerald-700" : ""}`}><span>{label}</span><span>{value}</span></div>;
}
