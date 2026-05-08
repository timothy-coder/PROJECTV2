"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { opportunitiesApi } from "@/app/api/opportunities.api";

export function useOpportunities(kind = "opportunity") {
  const [data, setData] = useState({ opportunities: [], options: { clients: [], origins: [], suborigins: [], stages: [], users: [] }, currentUser: null });
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setData(await opportunitiesApi.list(kind));
    setLoading(false);
  }, [kind]);
  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  const actions = useMemo(() => ({
    create: async (payload) => { await opportunitiesApi.create(payload, kind); await reload(); },
    update: async (id, payload) => { await opportunitiesApi.update(id, payload); await reload(); },
    assign: async (id, payload) => { await opportunitiesApi.assign(id, payload); await reload(); },
  }), [kind, reload]);
  return { ...data, loading, reload, ...actions };
}
