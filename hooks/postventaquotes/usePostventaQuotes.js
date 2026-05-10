"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { postventaQuotesApi } from "@/app/api/postventa-quotes.api";

export function usePostventaQuotes(tipo) {
  const [data, setData] = useState({ quotes: [], options: {}, currentUser: null });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setData(await postventaQuotesApi.list(tipo));
    setLoading(false);
  }, [tipo]);

  useEffect(() => {
    const timer = setTimeout(reload, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const actions = useMemo(() => ({
    createQuote: async (payload) => { const result = await postventaQuotesApi.create({ ...payload, tipo }); await reload(); return result; },
    updateQuote: async (id, payload) => { await postventaQuotesApi.update(id, payload); await reload(); },
    deleteQuote: async (id) => { await postventaQuotesApi.delete(id); await reload(); },
  }), [reload, tipo]);

  return { ...data, loading, reload, ...actions };
}
