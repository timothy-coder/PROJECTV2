"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { generalConfigurationApi } from "@/app/api/generalconfiguration.api";

function sortByCode(items) {
  return [...items].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export function useCurrencies() {
  const [monedas, setMonedas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMonedas = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await generalConfigurationApi.monedas();
      setMonedas(sortByCode(data.monedas || []));
    } catch (err) {
      setError(err.message || "No se pudieron cargar las monedas.");
      setMonedas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.resolve()
      .then(() => generalConfigurationApi.monedas())
      .then((data) => {
        if (!mounted) return;
        setMonedas(sortByCode(data.monedas || []));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "No se pudieron cargar las monedas.");
        setMonedas([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const createMoneda = useCallback(async (payload) => {
    const data = await generalConfigurationApi.createMoneda(payload);
    setMonedas((current) => sortByCode([...current, data.moneda]));
    return data.moneda;
  }, []);

  const updateMoneda = useCallback(async (id, payload) => {
    const data = await generalConfigurationApi.updateMoneda(id, payload);
    setMonedas((current) =>
      sortByCode(current.map((moneda) => (moneda.id === id ? data.moneda : moneda)))
    );
    return data.moneda;
  }, []);

  const deleteMoneda = useCallback(async (id) => {
    await generalConfigurationApi.deleteMoneda(id);
    setMonedas((current) => current.filter((moneda) => moneda.id !== id));
  }, []);

  const stats = useMemo(
    () => ({
      total: monedas.length,
      activos: monedas.filter((moneda) => moneda.isActive).length,
    }),
    [monedas]
  );

  return {
    monedas,
    loading,
    error,
    stats,
    createMoneda,
    updateMoneda,
    deleteMoneda,
    reload: loadMonedas,
  };
}
