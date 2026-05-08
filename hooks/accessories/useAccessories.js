"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { accessoriesApi } from "@/app/api/accessories.api";

export function useAccessories() {
  const [data, setData] = useState({ accessories: [], options: { brands: [], models: [], currencies: [], taxes: [] } });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await accessoriesApi.list();
    setData(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const stats = useMemo(() => ({
    total: data.accessories.length,
    brands: data.options.brands.length,
    models: data.options.models.length,
    currencies: data.options.currencies.length,
    taxes: data.options.taxes.length,
  }), [data]);

  const actions = useMemo(() => ({
    create: async (payload) => { await accessoriesApi.create(payload); await reload(); },
    update: async (id, payload) => { await accessoriesApi.update(id, payload); await reload(); },
    delete: async (id) => { await accessoriesApi.delete(id); await reload(); },
  }), [reload]);

  return { ...data, loading, stats, reload, ...actions };
}
