"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { salesSettingsApi } from "@/app/api/sales-settings.api";

export function useSalesSettings(scope) {
  const [data, setData] = useState({ centers: [], schedules: [], stages: [], times: [], closings: [], hours: [], userCounts: [], userCountUsers: [], measurementTypes: [], testdrive: null });
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setData(await salesSettingsApi.list(scope));
    setLoading(false);
  }, [scope]);
  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  const actions = useMemo(() => ({
    save: async (payload) => { await salesSettingsApi.save(scope, payload); await reload(); },
    delete: async (resource, id) => { await salesSettingsApi.save(scope, { action: "delete", resource, id }); await reload(); },
  }), [reload, scope]);
  return { ...data, loading, reload, ...actions };
}
