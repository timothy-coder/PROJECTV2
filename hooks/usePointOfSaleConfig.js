"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { pointOfSaleConfigApi } from "@/app/api/point-of-sale-config.api";

export function usePointOfSaleConfig() {
  const [data, setData] = useState({
    items: [],
    activePoint: null,
    settings: { habilitarAperturaCaja: false },
    options: { workshops: [], counters: [], centers: [] },
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await pointOfSaleConfigApi.list();
    setData({
      items: next.items || [],
      activePoint: next.activePoint || null,
      settings: {
        habilitarAperturaCaja: Boolean(next.settings?.habilitarAperturaCaja),
      },
      options: {
        workshops: next.options?.workshops || [],
        centers: next.options?.centers || [],
        counters: next.options?.counters || [],
      },
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const actions = useMemo(() => ({
    create: async (payload) => { await pointOfSaleConfigApi.create(payload); await reload(); },
    close: async (payload) => { await pointOfSaleConfigApi.close(payload); await reload(); },
    update: async (id, payload) => { await pointOfSaleConfigApi.update(id, payload); await reload(); },
    delete: async (id) => { await pointOfSaleConfigApi.delete(id); await reload(); },
  }), [reload]);

  return { ...data, loading, stats: { total: data.items.length }, reload, ...actions };
}
