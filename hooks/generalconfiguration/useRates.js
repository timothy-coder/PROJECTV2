"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { generalConfigurationApi } from "@/app/api/generalconfiguration.api";

function sortByName(items) {
  return [...items].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function useRates(tipo) {
  const [tarifas, setTarifas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTarifas = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await generalConfigurationApi.tarifas(tipo);
      setTarifas(sortByName(data.tarifas || []));
    } catch (err) {
      setError(err.message || "No se pudieron cargar las tarifas.");
      setTarifas([]);
    } finally {
      setLoading(false);
    }
  }, [tipo]);

  useEffect(() => {
    let mounted = true;

    Promise.resolve()
      .then(() => generalConfigurationApi.tarifas(tipo))
      .then((data) => {
        if (!mounted) return;
        setTarifas(sortByName(data.tarifas || []));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "No se pudieron cargar las tarifas.");
        setTarifas([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [tipo]);

  const createTarifa = useCallback(async (payload) => {
    const data = await generalConfigurationApi.createTarifa(payload);
    setTarifas((current) => sortByName([...current, data.tarifa]));
    return data.tarifa;
  }, []);

  const updateTarifa = useCallback(async (id, payload) => {
    const data = await generalConfigurationApi.updateTarifa(id, payload);
    setTarifas((current) =>
      sortByName(current.map((tarifa) => (tarifa.id === id ? data.tarifa : tarifa)))
    );
    return data.tarifa;
  }, []);

  const deleteTarifa = useCallback(async (id) => {
    await generalConfigurationApi.deleteTarifa(id);
    setTarifas((current) => current.filter((tarifa) => tarifa.id !== id));
  }, []);

  const stats = useMemo(() => {
    const activeRates = tarifas.filter((tarifa) => tarifa.activo);
    const total = tarifas.length;
    const sum = activeRates.reduce((acc, tarifa) => acc + Number(tarifa.precioHora || 0), 0);

    return {
      total,
      activas: activeRates.length,
      inactivas: tarifas.filter((tarifa) => !tarifa.activo).length,
      promedio: activeRates.length ? sum / activeRates.length : 0,
    };
  }, [tarifas]);

  return {
    tarifas,
    loading,
    error,
    stats,
    createTarifa,
    updateTarifa,
    deleteTarifa,
    reload: loadTarifas,
  };
}
