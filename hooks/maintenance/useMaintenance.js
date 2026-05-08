"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { maintenanceApi } from "@/app/api/maintenance.api";

export function useMaintenance() {
  const [data, setData] = useState({ maintenances: [], subitems: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await maintenanceApi.list();
      setData(next);
    } catch (err) {
      setError(err.message || "No se pudieron cargar mantenimientos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      reload();
    }, 0);

    return () => clearTimeout(timer);
  }, [reload]);

  const actions = useMemo(() => ({
    createMaintenance: async (payload) => { await maintenanceApi.createMaintenance(payload); await reload(); },
    updateMaintenance: async (id, payload) => { await maintenanceApi.updateMaintenance(id, payload); await reload(); },
    deleteMaintenance: async (id) => { await maintenanceApi.deleteMaintenance(id); await reload(); },
    createSubmaintenance: async (payload) => { await maintenanceApi.createSubmaintenance(payload); await reload(); },
    updateSubmaintenance: async (id, payload) => { await maintenanceApi.updateSubmaintenance(id, payload); await reload(); },
    deleteSubmaintenance: async (id) => { await maintenanceApi.deleteSubmaintenance(id); await reload(); },
  }), [reload]);

  const stats = useMemo(() => {
    const active = data.maintenances.filter((item) => item.isActive).length;
    const withBase = data.maintenances.filter((item) => item.mantenimientoId).length;
    return {
      total: data.maintenances.length,
      active,
      withBase,
      subs: data.subitems.length,
    };
  }, [data]);

  return {
    ...data,
    loading,
    error,
    stats,
    reload,
    ...actions,
  };
}
