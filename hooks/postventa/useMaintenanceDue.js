"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/app/api/client";

export function useMaintenanceDue() {
  const [data, setData] = useState({ currentUser: null, vehicles: [], options: { origins: [], suborigins: [], users: [], stages: [] } });
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
    createOpportunity: async (payload) => {
      await apiFetch("/api/postventa-opportunities?kind=opportunity", { method: "POST", body: JSON.stringify({ ...payload, kind: "opportunity" }) });
      await reload();
    },
  }), [reload]);
  return { ...data, loading, reload, ...actions };
}
