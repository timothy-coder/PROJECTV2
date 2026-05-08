"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { generalConfigurationApi } from "@/app/api/generalconfiguration.api";

function sortByName(items) {
  return [...items].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function useWorkshopsCounters(centroId) {
  const [talleres, setTalleres] = useState([]);
  const [mostradores, setMostradores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    if (!centroId) {
      setTalleres([]);
      setMostradores([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [talleresData, mostradoresData] = await Promise.all([
        generalConfigurationApi.talleres(centroId),
        generalConfigurationApi.mostradores(centroId),
      ]);

      setTalleres(talleresData.talleres || []);
      setMostradores(mostradoresData.mostradores || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar talleres y mostradores.");
      setTalleres([]);
      setMostradores([]);
    } finally {
      setLoading(false);
    }
  }, [centroId]);

  useEffect(() => {
    let mounted = true;

    Promise.resolve()
      .then(async () => {
        if (!centroId) {
          return [{ talleres: [] }, { mostradores: [] }];
        }

        if (mounted) {
          setLoading(true);
          setError("");
        }

        return Promise.all([
          generalConfigurationApi.talleres(centroId),
          generalConfigurationApi.mostradores(centroId),
        ]);
      })
      .then(([talleresData, mostradoresData]) => {
        if (!mounted) return;
        setTalleres(talleresData.talleres || []);
        setMostradores(mostradoresData.mostradores || []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "No se pudieron cargar talleres y mostradores.");
        setTalleres([]);
        setMostradores([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [centroId]);

  const createTaller = useCallback(async (payload) => {
    const data = await generalConfigurationApi.createTaller(payload);
    setTalleres((current) => sortByName([...current, data.taller]));
    return data.taller;
  }, []);

  const updateTaller = useCallback(async (id, payload) => {
    const data = await generalConfigurationApi.updateTaller(id, payload);
    setTalleres((current) =>
      sortByName(current.map((item) => (item.id === id ? data.taller : item)))
    );
    return data.taller;
  }, []);

  const deleteTaller = useCallback(async (id) => {
    await generalConfigurationApi.deleteTaller(id);
    setTalleres((current) => current.filter((item) => item.id !== id));
  }, []);

  const createMostrador = useCallback(async (payload) => {
    const data = await generalConfigurationApi.createMostrador(payload);
    setMostradores((current) => sortByName([...current, data.mostrador]));
    return data.mostrador;
  }, []);

  const updateMostrador = useCallback(async (id, payload) => {
    const data = await generalConfigurationApi.updateMostrador(id, payload);
    setMostradores((current) =>
      sortByName(current.map((item) => (item.id === id ? data.mostrador : item)))
    );
    return data.mostrador;
  }, []);

  const deleteMostrador = useCallback(async (id) => {
    await generalConfigurationApi.deleteMostrador(id);
    setMostradores((current) => current.filter((item) => item.id !== id));
  }, []);

  const stats = useMemo(
    () => ({
      talleres: talleres.length,
      mostradores: mostradores.length,
    }),
    [mostradores, talleres]
  );

  return {
    talleres,
    mostradores,
    loading,
    error,
    stats,
    createTaller,
    updateTaller,
    deleteTaller,
    createMostrador,
    updateMostrador,
    deleteMostrador,
    reload: loadData,
  };
}
