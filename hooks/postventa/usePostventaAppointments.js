"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/app/api/client";

export function usePostventaAppointments() {
  const [data, setData] = useState({ currentUser: null, appointments: [], maintenanceSubitems: [] });
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setData(await apiFetch("/api/postventa-appointments"));
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  const actions = useMemo(() => ({
    create: async (payload) => {
      const result = await apiFetch("/api/postventa-appointments", { method: "POST", body: JSON.stringify(payload) });
      await reload();
      return result;
    },
    update: async (appointmentId, payload) => {
      const result = await apiFetch(`/api/postventa-appointments/${appointmentId}`, { method: "PUT", body: JSON.stringify(payload) });
      await reload();
      return result;
    },
  }), [reload]);
  return { ...data, loading, reload, ...actions };
}
