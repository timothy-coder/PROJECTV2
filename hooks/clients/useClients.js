"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { clientsApi } from "@/app/api/clients.api";

export function useClients() {
  const [clients, setClients] = useState([]);
  const [options, setOptions] = useState({
    departamentos: [],
    provincias: [],
    distritos: [],
    marcas: [],
    clases: [],
    modelos: [],
    users: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await clientsApi.list();
      setClients(data.clients || []);
      setOptions(data.options || {
        departamentos: [],
        provincias: [],
        distritos: [],
        marcas: [],
        clases: [],
        modelos: [],
        users: [],
      });
    } catch (err) {
      setError(err.message || "No se pudieron cargar los clientes.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.resolve()
      .then(() => clientsApi.list())
      .then((data) => {
        if (!mounted) return;
        setClients(data.clients || []);
        setOptions(data.options || {
          departamentos: [],
          provincias: [],
          distritos: [],
          marcas: [],
          clases: [],
          modelos: [],
          users: [],
        });
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "No se pudieron cargar los clientes.");
        setClients([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const createClient = useCallback(async (payload) => {
    const result = await clientsApi.create(payload);
    await loadClients();
    return result;
  }, [loadClients]);

  const updateClient = useCallback(async (id, payload) => {
    await clientsApi.update(id, payload);
    await loadClients();
  }, [loadClients]);

  const deleteClient = useCallback(async (id) => {
    await clientsApi.delete(id);
    setClients((current) => current.filter((client) => client.id !== id));
  }, []);

  const importClients = useCallback(async (rows) => {
    const result = await clientsApi.import(rows);
    await loadClients();
    return result;
  }, [loadClients]);

  const importVehicles = useCallback(async (rows) => {
    const result = await clientsApi.importVehicles(rows);
    await loadClients();
    return result;
  }, [loadClients]);

  const importMaintenance = useCallback(async (rows) => {
    const result = await clientsApi.importMaintenance(rows);
    await loadClients();
    return result;
  }, [loadClients]);

  const createVehicle = useCallback(async (payload) => {
    await clientsApi.createVehicle(payload);
    await loadClients();
  }, [loadClients]);

  const updateVehicle = useCallback(async (id, payload) => {
    await clientsApi.updateVehicle(id, payload);
    await loadClients();
  }, [loadClients]);

  const deleteVehicle = useCallback(async (id) => {
    await clientsApi.deleteVehicle(id);
    await loadClients();
  }, [loadClients]);

  const stats = useMemo(
    () => ({
      total: clients.length,
      withVehicles: clients.filter((client) => client.vehicles.length).length,
      vehicles: clients.reduce((acc, client) => acc + client.vehicles.length, 0),
    }),
    [clients]
  );

  return {
    clients,
    options,
    loading,
    error,
    stats,
    createClient,
    updateClient,
    deleteClient,
    importClients,
    importVehicles,
    importMaintenance,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    reload: loadClients,
  };
}
