"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { usersApi } from "@/app/api/users.api";

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [options, setOptions] = useState({
    roles: [],
    centros: [],
    talleres: [],
    mostradores: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await usersApi.list();
      setUsers(data.users || []);
      setOptions(data.options || { roles: [], centros: [], talleres: [], mostradores: [] });
    } catch (err) {
      setError(err.message || "No se pudieron cargar los usuarios.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.resolve()
      .then(() => usersApi.list())
      .then((data) => {
        if (!mounted) return;
        setUsers(data.users || []);
        setOptions(data.options || { roles: [], centros: [], talleres: [], mostradores: [] });
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "No se pudieron cargar los usuarios.");
        setUsers([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const createUser = useCallback(async (payload) => {
    await usersApi.create(payload);
    await loadUsers();
  }, [loadUsers]);

  const updateUser = useCallback(async (id, payload) => {
    await usersApi.update(id, payload);
    await loadUsers();
  }, [loadUsers]);

  const deleteUser = useCallback(async (id) => {
    await usersApi.delete(id);
    setUsers((current) => current.filter((user) => user.id !== id));
  }, []);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.isActive).length,
      inactive: users.filter((user) => !user.isActive).length,
    }),
    [users]
  );

  return {
    users,
    options,
    loading,
    error,
    stats,
    createUser,
    updateUser,
    deleteUser,
    reload: loadUsers,
  };
}
