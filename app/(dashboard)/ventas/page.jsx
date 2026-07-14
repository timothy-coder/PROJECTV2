import { ArrowLeft, ReceiptText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default async function SalesPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const quoteId = resolvedSearchParams?.puntoventaCotizacion || "";
  const mode = resolvedSearchParams?.modo || "";
  const isEdit = mode === "editar";

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-950">
      <header className="mb-3 flex items-start justify-between gap-3 border-b border-violet-200 pb-3">
        <div>
          <h1 className="text-base font-bold leading-tight text-violet-700">{isEdit ? "Editar cotizacion" : "Venta"}</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">
            {quoteId ? `Cotizacion de punto de venta #${quoteId}` : "Gestion de venta"}
          </p>
        </div>
        <Button asChild variant="outline" className="h-9">
          <Link href="/puntoventa/cotizacion">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
      </header>

      <section className="rounded-lg border bg-white p-6 text-center shadow-sm">
        <ReceiptText className="mx-auto mb-3 size-9 text-violet-600" />
        <h2 className="text-sm font-black text-slate-900">
          {isEdit ? "Cotizacion lista para editar" : "Cotizacion lista para pasar a venta"}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Esta pantalla ya recibe el ID de la cotizacion desde punto de venta. El siguiente paso es conectar aqui el formulario final de venta y comprobante.
        </p>
      </section>
    </main>
  );
}
