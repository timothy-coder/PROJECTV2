"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { carPricesApi } from "@/app/api/car-prices.api";

export function useCarPrices() {
  const [data, setData] = useState({ prices: [], history: [], options: { brands: [], models: [], currencies: [] } });
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

  const stats = useMemo(() => ({
    total: data.prices.length,
    brands: new Set(data.prices.map((item) => item.marcaId)).size,
    models: new Set(data.prices.map((item) => item.modeloId)).size,
    stock: data.prices.filter((item) => item.enStock && item.existe).length,
    pedido: data.prices.filter((item) => !item.enStock && item.existe).length,
    history: data.history.length,
  }), [data.history.length, data.prices]);

  const actions = useMemo(() => ({
    create: async (payload) => { await carPricesApi.create(payload); await reload(); },
    update: async (id, payload) => { await carPricesApi.update(id, payload); await reload(); },
    delete: async (id) => { await carPricesApi.delete(id); await reload(); },
    importRows: async (rows) => { const result = await carPricesApi.import(rows); await reload(); return result; },
    createHistory: async (payload) => { await carPricesApi.createHistory(payload); await reload(); },
  }), [reload]);

  return { ...data, loading, stats, reload, ...actions };
}
