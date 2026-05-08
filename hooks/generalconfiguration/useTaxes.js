"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { generalConfigurationApi } from "@/app/api/generalconfiguration.api";

function sortByName(items) {
  return [...items].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function useTaxes() {
  const [impuestos, setImpuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadImpuestos = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await generalConfigurationApi.impuestos();
      setImpuestos(sortByName(data.impuestos || []));
    } catch (err) {
      setError(err.message || "No se pudieron cargar los impuestos.");
      setImpuestos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.resolve()
      .then(() => generalConfigurationApi.impuestos())
      .then((data) => {
        if (!mounted) return;
        setImpuestos(sortByName(data.impuestos || []));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "No se pudieron cargar los impuestos.");
        setImpuestos([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const createImpuesto = useCallback(async (payload) => {
    const data = await generalConfigurationApi.createImpuesto(payload);
    setImpuestos((current) => sortByName([...current, data.impuesto]));
    return data.impuesto;
  }, []);

  const updateImpuesto = useCallback(async (id, payload) => {
    const data = await generalConfigurationApi.updateImpuesto(id, payload);
    setImpuestos((current) =>
      sortByName(current.map((item) => (item.id === id ? data.impuesto : item)))
    );
    return data.impuesto;
  }, []);

  const deleteImpuesto = useCallback(async (id) => {
    await generalConfigurationApi.deleteImpuesto(id);
    setImpuestos((current) => current.filter((item) => item.id !== id));
  }, []);

  const stats = useMemo(
    () => ({
      total: impuestos.length,
      activos: impuestos.filter((item) => item.isActive).length,
    }),
    [impuestos]
  );

  return {
    impuestos,
    loading,
    error,
    stats,
    createImpuesto,
    updateImpuesto,
    deleteImpuesto,
    reload: loadImpuestos,
  };
}
