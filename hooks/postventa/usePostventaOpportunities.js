"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/app/api/client";

const DEFAULT_FILTERS = {};

export function usePostventaOpportunities(kind = "opportunity", filters = DEFAULT_FILTERS) {
  const [data, setData] = useState({ currentUser: null, opportunities: [], meta: { total: 0, page: 1, limit: 10, pages: 1 }, options: { stages: [], origins: [], suborigins: [], users: [] } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ kind });
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== "") params.set(key, String(value));
      });
      setData(await apiFetch(`/api/postventa-opportunities?${params.toString()}`));
    } catch (err) {
      setError(err);
      if (err.status === 403) setData((current) => ({ ...current, opportunities: [] }));
      else throw err;
    } finally {
      setLoading(false);
    }
  }, [filters, kind]);
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
