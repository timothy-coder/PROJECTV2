"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { brandsModelsApi } from "@/app/api/brandsmodels.api";

export function useBrandsModels() {
  const [data, setData] = useState({ brands: [], models: [], classes: [], maintenance: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await brandsModelsApi.list();
      setData(next);
    } catch (err) {
      setError(err.message || "No se pudieron cargar marcas y modelos.");
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
    createBrand: async (payload) => { await brandsModelsApi.createBrand(payload); await reload(); },
    updateBrand: async (id, payload) => { await brandsModelsApi.updateBrand(id, payload); await reload(); },
    deleteBrand: async (id) => { await brandsModelsApi.deleteBrand(id); await reload(); },
    createModel: async (payload) => { await brandsModelsApi.createModel(payload); await reload(); },
    updateModel: async (id, payload) => { await brandsModelsApi.updateModel(id, payload); await reload(); },
    deleteModel: async (id) => { await brandsModelsApi.deleteModel(id); await reload(); },
    createClass: async (payload) => { await brandsModelsApi.createClass(payload); await reload(); },
    updateClass: async (id, payload) => { await brandsModelsApi.updateClass(id, payload); await reload(); },
    deleteClass: async (id) => { await brandsModelsApi.deleteClass(id); await reload(); },
    createMaintenance: async (payload) => { await brandsModelsApi.createMaintenance(payload); await reload(); },
    updateMaintenance: async (id, payload) => { await brandsModelsApi.updateMaintenance(id, payload); await reload(); },
    deleteMaintenance: async (id) => { await brandsModelsApi.deleteMaintenance(id); await reload(); },
  }), [reload]);

  return {
    ...data,
    loading,
    error,
    stats: { brands: data.brands.length, models: data.models.length, classes: data.classes.length },
    reload,
    ...actions,
  };
}
