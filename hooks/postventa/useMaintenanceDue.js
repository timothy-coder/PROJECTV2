"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/app/api/client";

export function useMaintenanceDue() {
  const [data, setData] = useState({ currentUser: null, vehicles: [], options: { origins: [], suborigins: [], users: [], stages: [], closings: [] } });
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setData(await apiFetch("/api/postventa-maintenance-due"));
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  const actions = useMemo(() => ({
    recalculateMaintenance: async () => {
      const result = await apiFetch("/api/clients/vehicles/maintenance/recalculate", { method: "POST" });
      await reload();
      return result;
    },
    createOpportunity: async (payload) => {
      const created = await apiFetch("/api/postventa-opportunities?kind=opportunity", { method: "POST", body: JSON.stringify({ ...payload, kind: "opportunity" }) });
      const firstDetail = Array.isArray(payload.details) ? payload.details.find((item) => item?.fechaAgenda && item?.horaAgenda) : null;
      const closed = Boolean(payload.close?.enabled);
      setData((current) => ({
        ...current,
        vehicles: current.vehicles.map((vehicle) => Number(vehicle.id) === Number(payload.vehiculoId)
          ? {
              ...vehicle,
              oportunidadId: created.id,
              oportunidadCodigo: created.code || "",
              oportunidades: [
                ...(vehicle.oportunidades || []),
                {
                  id: created.id,
                  code: created.code || "",
                  fechaAgendada: firstDetail ? `${firstDetail.fechaAgenda} ${String(firstDetail.horaAgenda || "").slice(0, 5)}` : "",
                  estado: closed ? "Cerrado" : "Programado",
                },
              ],
              fechaAgendada: firstDetail ? `${firstDetail.fechaAgenda} ${String(firstDetail.horaAgenda || "").slice(0, 5)}` : created.code || "",
              estadoRecordatorio: closed ? "Cerrado" : "Programado",
              cierreMotivo: closed ? payload.close.detalle || "Cierre registrado" : vehicle.cierreMotivo,
            }
          : vehicle),
      }));
      window.setTimeout(() => {
        reload().catch(() => {});
      }, 1200);
      return created;
    },
  }), [reload]);
  return { ...data, loading, reload, ...actions };
}
