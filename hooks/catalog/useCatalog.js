"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { catalogApi } from "@/app/api/catalog.api";

export function useCatalog() {
  const [data, setData] = useState({ prices: [] });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setData(await catalogApi.list());
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const stats = useMemo(() => {
    const groups = data.prices.flatMap((price) => price.groups);
    const items = groups.flatMap((group) => group.items);
    return { prices: data.prices.length, groups: groups.length, items: items.length, activeItems: items.filter((item) => item.isActive).length };
  }, [data.prices]);

  const actions = useMemo(() => ({
    createGroup: async (payload) => { await catalogApi.createGroup(payload); await reload(); },
    updateGroup: async (id, payload) => { await catalogApi.updateGroup(id, payload); await reload(); },
    deleteGroup: async (id) => { await catalogApi.deleteGroup(id); await reload(); },
    createItem: async (payload) => { await catalogApi.createItem(payload); await reload(); },
    updateItem: async (id, payload) => { await catalogApi.updateItem(id, payload); await reload(); },
    deleteItem: async (id) => { await catalogApi.deleteItem(id); await reload(); },
    importRows: async (rows) => { const result = await catalogApi.import(rows); await reload(); return result; },
  }), [reload]);

  return { ...data, loading, stats, reload, ...actions };
}
