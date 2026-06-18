"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/app/api/client";

export function CreateReservationButton({ opportunityId, quoteId, className = "" }) {
  const [loading, setLoading] = useState(false);

  async function createReservation() {
    setLoading(true);
    try {
      const result = await apiFetch(`/api/opportunities/${opportunityId}/detail`, {
        method: "POST",
        body: JSON.stringify({ action: "quote-reserve", cotizacionId: quoteId }),
      });
      toast.success("Nota de pedido creada");
      if (result?.reservaId) window.location.href = `/reservas/${result.reservaId}`;
      else window.location.href = "/reservas";
    } catch (error) {
      toast.error("No se pudo crear la nota de pedido", { description: error?.message || "Intenta nuevamente." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={createReservation}
      disabled={loading}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
      Crear Nota de Pedido
    </button>
  );
}
