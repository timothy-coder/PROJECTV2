"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { generalConfigurationApi } from "@/app/api/generalconfiguration.api";

function sortLinks(items) {
  return [...items].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

export function useConfigurationLinks() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await generalConfigurationApi.links();
      setLinks(sortLinks(data.links || []));
    } catch (err) {
      setError(err.message || "No se pudieron cargar los links.");
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.resolve()
      .then(() => generalConfigurationApi.links())
      .then((data) => {
        if (!mounted) return;
        setLinks(sortLinks(data.links || []));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "No se pudieron cargar los links.");
        setLinks([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const createLink = useCallback(async (payload) => {
    const data = await generalConfigurationApi.createLink(payload);
    setLinks((current) => sortLinks([...current, data.link]));
    return data.link;
  }, []);

  const updateLink = useCallback(async (id, payload) => {
    const data = await generalConfigurationApi.updateLink(id, payload);
    setLinks((current) => sortLinks(current.map((item) => (item.id === id ? data.link : item))));
    return data.link;
  }, []);

  const deleteLink = useCallback(async (id) => {
    await generalConfigurationApi.deleteLink(id);
    setLinks((current) => current.filter((item) => item.id !== id));
  }, []);

  const stats = useMemo(
    () => ({
      total: links.length,
      desktop: links.filter((item) => item.isForDesktop).length,
      mobile: links.filter((item) => item.isForMobile).length,
    }),
    [links]
  );

  return { links, loading, error, stats, createLink, updateLink, deleteLink, reload: loadLinks };
}
