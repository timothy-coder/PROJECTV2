"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { generalConfigurationApi } from "@/app/api/generalconfiguration.api";

function sortByName(items) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export function useAppointmentOrigins() {
  const [origenes, setOrigenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrigenes = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await generalConfigurationApi.origenesCitas();
      setOrigenes(sortByName(data.origenes || []));
    } catch (err) {
      setError(err.message || "No se pudieron cargar los origenes.");
      setOrigenes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.resolve()
      .then(() => generalConfigurationApi.origenesCitas())
      .then((data) => {
        if (!mounted) return;
        setOrigenes(sortByName(data.origenes || []));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "No se pudieron cargar los origenes.");
        setOrigenes([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const createOrigen = useCallback(async (payload) => {
    const data = await generalConfigurationApi.createOrigenCita(payload);
    setOrigenes((current) => sortByName([...current, data.origen]));
    return data.origen;
  }, []);

  const updateOrigen = useCallback(async (id, payload) => {
    const data = await generalConfigurationApi.updateOrigenCita(id, payload);
    setOrigenes((current) =>
      sortByName(current.map((origen) => (origen.id === id ? data.origen : origen)))
    );
    return data.origen;
  }, []);

  const deleteOrigen = useCallback(async (id) => {
    await generalConfigurationApi.deleteOrigenCita(id);
    setOrigenes((current) => current.filter((origen) => origen.id !== id));
  }, []);

  const stats = useMemo(
    () => ({
      total: origenes.length,
      activos: origenes.filter((origen) => origen.isActive).length,
    }),
    [origenes]
  );

  return {
    origenes,
    loading,
    error,
    stats,
    createOrigen,
    updateOrigen,
    deleteOrigen,
    reload: loadOrigenes,
  };
}
