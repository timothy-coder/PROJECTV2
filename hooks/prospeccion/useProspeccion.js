"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { prospeccionApi } from "@/app/api/prospeccion.api";

export function useProspeccion() {
  const [frequencies, setFrequencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const data = await prospeccionApi.list();
    setFrequencies(data.frequencies || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  const stats = useMemo(() => {
    const values = frequencies.map((item) => item.dias);
    const total = values.length;
    return {
      total,
      min: total ? Math.min(...values) : 0,
      avg: total ? Math.round(values.reduce((a, b) => a + b, 0) / total) : 0,
      max: total ? Math.max(...values) : 0,
    };
  }, [frequencies]);
  return {
    frequencies,
    loading,
    stats,
    reload,
    create: async (payload) => { await prospeccionApi.create(payload); await reload(); },
    update: async (id, payload) => { await prospeccionApi.update(id, payload); await reload(); },
    delete: async (id) => { await prospeccionApi.delete(id); await reload(); },
  };
}
