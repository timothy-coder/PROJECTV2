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
      await apiFetch(`/api/postventa-opportunities/${id}`, { method: "POST", body: JSON.stringify(payload) });
      await reload();
    },
    createAppointment: async (payload) => {
      const result = await apiFetch("/api/postventa-appointments", { method: "POST", body: JSON.stringify({ ...payload, oportunidadId: id }) });
      await reload();
      return result;
    },
  }), [id, reload]);

  return { data, loading, reload, ...actions };
}
