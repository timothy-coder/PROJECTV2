"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/api/client";

export function useOpportunityDetail(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    const skipAutoAttention = typeof window !== "undefined" && sessionStorage.getItem(`opportunity-skip-auto-attention-${id}`) === "1";
    if (skipAutoAttention) sessionStorage.removeItem(`opportunity-skip-auto-attention-${id}`);
    setData(await apiFetch(`/api/opportunities/${id}/detail${skipAutoAttention ? "?skipAutoAttention=1" : ""}`));
    if (showLoading) setLoading(false);
  }, [id]);
  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  const actions = useMemo(() => ({
    save: async (payload) => {
      const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
      if (payload?.skipAutoAttention && typeof window !== "undefined") {
        sessionStorage.setItem(`opportunity-skip-auto-attention-${id}`, "1");
      }
      await apiFetch(`/api/opportunities/${id}/detail`, { method: "POST", body: JSON.stringify(payload) });
      await reload({ showLoading: false });
      if (typeof window !== "undefined") {
        const restoreScroll = () => window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
        requestAnimationFrame(restoreScroll);
        setTimeout(restoreScroll, 50);
        setTimeout(restoreScroll, 150);
      }
    },
  }), [id, reload]);
  return { data, loading, reload, ...actions };
}
