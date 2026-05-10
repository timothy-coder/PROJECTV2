"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { salesDocumentTemplatesApi } from "@/app/api/sales-document-templates.api";

export function useSalesDocumentTemplates(enabled = true) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await salesDocumentTemplatesApi.list();
      setTemplates(data.templates || []);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    const timer = setTimeout(() => reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);

  return useMemo(
    () => ({
      templates,
      loading,
      reload,
      create: async (payload) => {
        await salesDocumentTemplatesApi.create(payload);
        await reload();
      },
      save: async (payload) => {
        await salesDocumentTemplatesApi.save(payload);
        await reload();
      },
      uploadImage: salesDocumentTemplatesApi.uploadImage,
    }),
    [loading, reload, templates]
  );
}
