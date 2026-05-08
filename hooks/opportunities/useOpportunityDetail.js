"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/api/client";

export function useOpportunityDetail(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const skipAutoAttention = typeof window !== "undefined" && sessionStorage.getItem(`opportunity-skip-auto-attention-${id}`) === "1";
    if (skipAutoAttention) sessionStorage.removeItem(`opportunity-skip-auto-attention-${id}`);
    setData(await apiFetch(`/api/opportunities/${id}/detail${skipAutoAttention ? "?skipAutoAttention=1" : ""}`));
    setLoading(false);
  }, [id]);
  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  const actions = useMemo(() => ({
    save: async (payload) => {
      if (payload?.skipAutoAttention && typeof window !== "undefined") {
        sessionStorage.setItem(`opportunity-skip-auto-attention-${id}`, "1");
      }
      await apiFetch(`/api/opportunities/${id}/detail`, { method: "POST", body: JSON.stringify(payload) });
      await reload();
    },
  }), [id, reload]);
  return { data, loading, reload, ...actions };
}
