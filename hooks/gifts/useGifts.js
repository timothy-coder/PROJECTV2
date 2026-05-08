"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { giftsApi } from "@/app/api/gifts.api";

export function useGifts() {
  const [data, setData] = useState({ gifts: [], options: { currencies: [], taxes: [] } });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await giftsApi.list();
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
    total: data.gifts.length,
    store: data.gifts.filter((gift) => gift.regaloTienda).length,
    currencies: data.options.currencies.length,
    taxes: data.options.taxes.length,
  }), [data]);

  const actions = useMemo(() => ({
    create: async (payload) => { await giftsApi.create(payload); await reload(); },
    update: async (id, payload) => { await giftsApi.update(id, payload); await reload(); },
    delete: async (id) => { await giftsApi.delete(id); await reload(); },
  }), [reload]);

  return { ...data, loading, stats, reload, ...actions };
}
