"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { carPricesApi } from "@/app/api/car-prices.api";

export function useCarPrices() {
  const [data, setData] = useState({ prices: [], history: [], soldHistory: [], pendingPurchases: [], options: { brands: [], models: [], currencies: [] } });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await carPricesApi.list();
    setData(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const stats = useMemo(() => {
    const inventoryHistory = data.history.filter((item) => !item.vendido);
    return {
      total: inventoryHistory.length,
      stock: inventoryHistory.filter((item) => !item.enReserva).length,
      pedido: data.pendingPurchases.length,
      history: inventoryHistory.length,
      sold: data.soldHistory.length,
      pendingPurchases: data.pendingPurchases.length,
    };
  }, [data.history, data.pendingPurchases.length, data.soldHistory.length]);

  const actions = useMemo(() => ({
    create: async (payload) => { await carPricesApi.create(payload); await reload(); },
    update: async (id, payload) => { await carPricesApi.update(id, payload); await reload(); },
    delete: async (id) => { await carPricesApi.delete(id); await reload(); },
    importRows: async (rows) => { const result = await carPricesApi.import(rows); await reload(); return result; },
    createHistory: async (payload) => { await carPricesApi.createHistory(payload); await reload(); },
    updateHistory: async (vin, payload) => { await carPricesApi.updateHistory(vin, payload); await reload(); },
    updateEvent: async (id, payload) => { await carPricesApi.updateEvent(id, payload); await reload(); },
    importHistoryRows: async (rows) => { const result = await carPricesApi.importHistory(rows); await reload(); return result; },
  }), [reload]);

  return { ...data, loading, stats, reload, ...actions };
}
