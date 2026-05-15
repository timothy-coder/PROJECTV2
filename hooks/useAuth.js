"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi } from "@/app/api/auth.api";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      setUser(user);
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
        return;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } finally {
        setBooting(false);
      }
    })();
  }, [refresh]);

  const login = useCallback(async ({ username, password }) => {
    const { user } = await authApi.login({ username, password });
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return useMemo(
    () => ({
      user,
      booting,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refresh,
    }),
    [user, booting, login, logout, refresh]
  );
}
