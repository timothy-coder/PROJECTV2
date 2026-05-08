"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { generalConfigurationApi } from "@/app/api/generalconfiguration.api";

function sortByName(items) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export function useAppointmentSuborigins(origenId = "") {
  const [suborigenes, setSuborigenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSuborigenes = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await generalConfigurationApi.suborigenesCitas(origenId);
      setSuborigenes(sortByName(data.suborigenes || []));
    } catch (err) {
      setError(err.message || "No se pudieron cargar los suborigenes.");
      setSuborigenes([]);
    } finally {
      setLoading(false);
    }
  }, [origenId]);

  useEffect(() => {
    let mounted = true;

    Promise.resolve()
      .then(() => generalConfigurationApi.suborigenesCitas(origenId))
      .then((data) => {
        if (!mounted) return;
        setSuborigenes(sortByName(data.suborigenes || []));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "No se pudieron cargar los suborigenes.");
        setSuborigenes([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [origenId]);

  const createSuborigen = useCallback(async (payload) => {
    const data = await generalConfigurationApi.createSuborigenCita(payload);
    setSuborigenes((current) => sortByName([...current, data.suborigen]));
    return data.suborigen;
  }, []);

  const updateSuborigen = useCallback(async (id, payload) => {
    const data = await generalConfigurationApi.updateSuborigenCita(id, payload);
    setSuborigenes((current) =>
      sortByName(current.map((item) => (item.id === id ? data.suborigen : item)))
    );
    return data.suborigen;
  }, []);

  const deleteSuborigen = useCallback(async (id) => {
    await generalConfigurationApi.deleteSuborigenCita(id);
    setSuborigenes((current) => current.filter((item) => item.id !== id));
  }, []);

  const stats = useMemo(
    () => ({
      total: suborigenes.length,
      activos: suborigenes.filter((item) => item.isActive).length,
      inactivos: suborigenes.filter((item) => !item.isActive).length,
    }),
    [suborigenes]
  );

  return {
    suborigenes,
    loading,
    error,
    stats,
    createSuborigen,
    updateSuborigen,
    deleteSuborigen,
    reload: loadSuborigenes,
  };
}
