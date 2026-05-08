"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/app/api/client";

export function usePostventaAgenda() {
  const [data, setData] = useState({ currentUser: null, centers: [], schedules: [], items: [], options: { users: [] } });
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setData(await apiFetch("/api/postventa-agenda"));
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  return { ...data, loading, reload };
}
