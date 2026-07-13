"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { generalConfigurationApi } from "@/app/api/generalconfiguration.api";

export function useConfigurationCenters() {
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCentros = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await generalConfigurationApi.centros();
      setCentros(data.centros || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los grupos.");
      setCentros([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createCentro = useCallback(async ({ nombre }) => {
    const data = await generalConfigurationApi.createCentro({ nombre });
    setCentros((current) =>
      [...current, data.centro].sort((a, b) => a.nombre.localeCompare(b.nombre))
    );
    return data.centro;
  }, []);

  const updateCentro = useCallback(async (id, { nombre }) => {
    const data = await generalConfigurationApi.updateCentro(id, { nombre });
    setCentros((current) =>
      current
        .map((centro) => (centro.id === id ? data.centro : centro))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    );
    return data.centro;
  }, []);

  const deleteCentro = useCallback(async (id) => {
    await generalConfigurationApi.deleteCentro(id);
    setCentros((current) => current.filter((centro) => centro.id !== id));
  }, []);

  useEffect(() => {
    let mounted = true;

    generalConfigurationApi
      .centros()
      .then((data) => {
        if (!mounted) return;
        setCentros(data.centros || []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "No se pudieron cargar los grupos.");
        setCentros([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(
    () => ({
      total: centros.length,
      activos: centros.length,
      inactivos: 0,
    }),
    [centros]
  );

  return {
    centros,
    loading,
    error,
    stats,
    createCentro,
    updateCentro,
    deleteCentro,
    reload: loadCentros,
  };
}
