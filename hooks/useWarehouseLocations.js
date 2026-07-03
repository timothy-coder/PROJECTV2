"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { warehouseLocationsApi } from "@/app/api/warehouse-locations.api";

export function useWarehouseLocations() {
  const [data, setData] = useState({
    shelves: [],
    levels: [],
    positions: [],
    options: { workshops: [], counters: [] },
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await warehouseLocationsApi.list();
    setData({
      shelves: next.shelves || [],
      levels: next.levels || [],
      positions: next.positions || [],
      options: {
        workshops: next.options?.workshops || [],
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
    createShelf: async (payload) => { await warehouseLocationsApi.createShelf(payload); await reload(); },
    updateShelf: async (id, payload) => { await warehouseLocationsApi.updateShelf(id, payload); await reload(); },
    deleteShelf: async (id) => { await warehouseLocationsApi.deleteShelf(id); await reload(); },
    createLevel: async (payload) => { await warehouseLocationsApi.createLevel(payload); await reload(); },
    updateLevel: async (id, payload) => { await warehouseLocationsApi.updateLevel(id, payload); await reload(); },
    deleteLevel: async (id) => { await warehouseLocationsApi.deleteLevel(id); await reload(); },
    createPosition: async (payload) => { await warehouseLocationsApi.createPosition(payload); await reload(); },
    updatePosition: async (id, payload) => { await warehouseLocationsApi.updatePosition(id, payload); await reload(); },
    deletePosition: async (id) => { await warehouseLocationsApi.deletePosition(id); await reload(); },
  }), [reload]);

  return {
    ...data,
    loading,
    stats: {
      shelves: data.shelves.length,
      levels: data.levels.length,
      positions: data.positions.length,
    },
    reload,
    ...actions,
  };
}
