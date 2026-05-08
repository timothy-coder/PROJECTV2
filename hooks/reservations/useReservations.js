"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { reservationsApi } from "@/app/api/reservations.api";

export function useReservations() {
  const [data, setData] = useState({ reservations: [], stats: {}, currentUser: null });
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setData(await reservationsApi.list());
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = setTimeout(reload, 0);
    return () => clearTimeout(timer);
  }, [reload]);
  return useMemo(() => ({ ...data, loading, reload }), [data, loading, reload]);
}

export function useReservationDetail(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setData(await reservationsApi.detail(id));
    setLoading(false);
  }, [id]);
  useEffect(() => {
    const timer = setTimeout(reload, 0);
    return () => clearTimeout(timer);
  }, [reload]);
  const update = useCallback(async (payload, options = {}) => {
    await reservationsApi.update(id, payload);
    if (options.reload !== false) await reload();
  }, [id, reload]);
  return { data, loading, reload, update };
}
