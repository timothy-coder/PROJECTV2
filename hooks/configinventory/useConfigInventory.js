"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { configInventoryApi } from "@/app/api/configinventory.api";

export function useConfigInventory() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await configInventoryApi.list();
    setTypes(data.types || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const actions = useMemo(() => ({
    createType: async (payload) => { await configInventoryApi.createType(payload); await reload(); },
    updateType: async (id, payload) => { await configInventoryApi.updateType(id, payload); await reload(); },
    deleteType: async (id) => { await configInventoryApi.deleteType(id); await reload(); },
  }), [reload]);

  return { types, loading, stats: { total: types.length }, reload, ...actions };
}
