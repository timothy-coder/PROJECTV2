"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/app/api/client";

export function usePostventaOpportunityDetail(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setData(await apiFetch(`/api/postventa-opportunities/${id}`));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const actions = useMemo(() => ({
    save: async (payload) => {
      const result = await apiFetch(`/api/postventa-opportunities/${id}`, { method: "POST", body: JSON.stringify(payload) });
      await reload();
      return result;
    },
    createAppointment: async (payload) => {
      const result = await apiFetch("/api/postventa-appointments", { method: "POST", body: JSON.stringify({ ...payload, oportunidadId: id }) });
      await reload();
      return result;
    },
    updateAppointment: async (appointmentId, payload) => {
      const result = await apiFetch(`/api/postventa-appointments/${appointmentId}`, { method: "PUT", body: JSON.stringify(payload) });
      await reload();
      return result;
    },
    updateClientData: async (payload) => {
      const result = await apiFetch(`/api/postventa-opportunities/${id}`, { method: "POST", body: JSON.stringify({ action: "client-update", ...payload }) });
      await reload();
      return result;
    },
    updateVehicleData: async (payload) => {
      const result = await apiFetch(`/api/postventa-opportunities/${id}`, { method: "POST", body: JSON.stringify({ action: "vehicle-update", ...payload }) });
      await reload();
      return result;
    },
  }), [id, reload]);

  return { data, loading, reload, ...actions };
}
