"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/app/api/client";

export function usePostventaOpportunityDetail(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    setData(await apiFetch(`/api/postventa-opportunities/${id}`));
    if (showLoading) setLoading(false);
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const actions = useMemo(() => ({
    save: async (payload) => {
      const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
      const result = await apiFetch(`/api/postventa-opportunities/${id}`, { method: "POST", body: JSON.stringify(payload) });
      await reload({ showLoading: false });
      restoreScroll(scrollY);
      return result;
    },
    createAppointment: async (payload) => {
      const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
      const result = await apiFetch("/api/postventa-appointments", { method: "POST", body: JSON.stringify({ ...payload, oportunidadId: id }) });
      await reload({ showLoading: false });
      restoreScroll(scrollY);
      return result;
    },
    updateAppointment: async (appointmentId, payload) => {
      const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
      const result = await apiFetch(`/api/postventa-appointments/${appointmentId}`, { method: "PUT", body: JSON.stringify(payload) });
      await reload({ showLoading: false });
      restoreScroll(scrollY);
      return result;
    },
    updateClientData: async (payload) => {
      const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
      const result = await apiFetch(`/api/postventa-opportunities/${id}`, { method: "POST", body: JSON.stringify({ action: "client-update", ...payload }) });
      await reload({ showLoading: false });
      restoreScroll(scrollY);
      return result;
    },
    updateVehicleData: async (payload) => {
      const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
      const result = await apiFetch(`/api/postventa-opportunities/${id}`, { method: "POST", body: JSON.stringify({ action: "vehicle-update", ...payload }) });
      await reload({ showLoading: false });
      restoreScroll(scrollY);
      return result;
    },
  }), [id, reload]);

  return { data, loading, reload, ...actions };
}

function restoreScroll(scrollY) {
  if (typeof window === "undefined") return;
  const restore = () => window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
  requestAnimationFrame(restore);
  setTimeout(restore, 50);
  setTimeout(restore, 150);
}
