"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/app/api/client";

export function usePostventaOpportunities(kind = "opportunity") {
  const [data, setData] = useState({ currentUser: null, opportunities: [], options: { stages: [], origins: [], suborigins: [], users: [] } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch(`/api/postventa-opportunities?kind=${kind}`));
    } catch (err) {
      setError(err);
      if (err.status === 403) setData((current) => ({ ...current, opportunities: [] }));
      else throw err;
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  const actions = useMemo(() => ({
    create: async (payload) => {
      await apiFetch(`/api/postventa-opportunities?kind=${kind}`, { method: "POST", body: JSON.stringify({ ...payload, kind }) });
      await reload();
    },
    update: async (id, payload) => {
      await apiFetch(`/api/postventa-opportunities/${id}`, { method: "PUT", body: JSON.stringify({ ...payload, kind }) });
      await reload();
    },
    assign: async (id, payload) => {
      await apiFetch(`/api/postventa-opportunities/${id}`, { method: "PUT", body: JSON.stringify({ ...payload, action: "assign", kind }) });
      await reload();
    },
    detail: (id) => apiFetch(`/api/postventa-opportunities/${id}`),
  }), [kind, reload]);
  return { ...data, loading, error, reload, ...actions };
}
