"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { generalConfigurationApi } from "@/app/api/generalconfiguration.api";

function sortMotivos(items) {
  return [...items].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function withSortedSubmotivos(motivo) {
  return {
    ...motivo,
    submotivos: [...(motivo.submotivos || [])].sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    ),
  };
}

export function useAppointmentReasons() {
  const [motivos, setMotivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMotivos = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await generalConfigurationApi.motivosCitas();
      setMotivos(sortMotivos((data.motivos || []).map(withSortedSubmotivos)));
    } catch (err) {
      setError(err.message || "No se pudieron cargar los motivos.");
      setMotivos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.resolve()
      .then(() => generalConfigurationApi.motivosCitas())
      .then((data) => {
        if (!mounted) return;
        setMotivos(sortMotivos((data.motivos || []).map(withSortedSubmotivos)));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "No se pudieron cargar los motivos.");
        setMotivos([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const createMotivo = useCallback(async (payload) => {
    const data = await generalConfigurationApi.createMotivoCita(payload);
    setMotivos((current) => sortMotivos([...current, data.motivo]));
    return data.motivo;
  }, []);

  const updateMotivo = useCallback(async (id, payload) => {
    const data = await generalConfigurationApi.updateMotivoCita(id, payload);
    setMotivos((current) =>
      sortMotivos(
        current.map((motivo) =>
          motivo.id === id
            ? { ...data.motivo, submotivos: motivo.submotivos || [] }
            : motivo
        )
      )
    );
    return data.motivo;
  }, []);

  const deleteMotivo = useCallback(async (id) => {
    await generalConfigurationApi.deleteMotivoCita(id);
    setMotivos((current) => current.filter((motivo) => motivo.id !== id));
  }, []);

  const createSubmotivo = useCallback(async (payload) => {
    const data = await generalConfigurationApi.createSubmotivoCita(payload);
    setMotivos((current) =>
      current.map((motivo) =>
        motivo.id === data.submotivo.motivoId
          ? withSortedSubmotivos({
              ...motivo,
              submotivos: [...(motivo.submotivos || []), data.submotivo],
            })
          : motivo
      )
    );
    return data.submotivo;
  }, []);

  const updateSubmotivo = useCallback(async (id, payload) => {
    const data = await generalConfigurationApi.updateSubmotivoCita(id, payload);
    setMotivos((current) =>
      current.map((motivo) => {
        const withoutItem = (motivo.submotivos || []).filter((item) => item.id !== id);
        const shouldReceive = motivo.id === data.submotivo.motivoId;

        return withSortedSubmotivos({
          ...motivo,
          submotivos: shouldReceive ? [...withoutItem, data.submotivo] : withoutItem,
        });
      })
    );
    return data.submotivo;
  }, []);

  const deleteSubmotivo = useCallback(async (id) => {
    await generalConfigurationApi.deleteSubmotivoCita(id);
    setMotivos((current) =>
      current.map((motivo) => ({
        ...motivo,
        submotivos: (motivo.submotivos || []).filter((item) => item.id !== id),
      }))
    );
  }, []);

  const stats = useMemo(() => {
    const submotivos = motivos.flatMap((motivo) => motivo.submotivos || []);

    return {
      totalMotivos: motivos.length,
      motivosActivos: motivos.filter((motivo) => motivo.isActive).length,
      totalSubmotivos: submotivos.length,
    };
  }, [motivos]);

  return {
    motivos,
    loading,
    error,
    stats,
    createMotivo,
    updateMotivo,
    deleteMotivo,
    createSubmotivo,
    updateSubmotivo,
    deleteSubmotivo,
    reload: loadMotivos,
  };
}
