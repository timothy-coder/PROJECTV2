"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { postInventoryApi } from "@/app/api/postinventory.api";

export function usePostInventory() {
  const [data, setData] = useState({ products: [], stocks: [], options: { types: [], centers: [], workshops: [], counters: [] } });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await postInventoryApi.list();
    if (!next.options?.types?.length) {
      const inventoryConfig = await postInventoryApi.listTypes();
      next.options = {
        ...(next.options || {}),
        types: inventoryConfig.types || [],
      };
    }
    setData({
      products: next.products || [],
      stocks: next.stocks || [],
      options: {
        types: next.options?.types || [],
        centers: next.options?.centers || [],
        workshops: next.options?.workshops || [],
        counters: next.options?.counters || [],
      },
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const stats = useMemo(() => {
    const totalStock = data.products.reduce((sum, item) => sum + Number(item.stockTotal || 0), 0);
    const totalValue = data.products.reduce((sum, product) => {
      const stock = Number(product.stockDisponible ?? product.stockTotal ?? 0);
      return sum + stock * Number(product.precioVenta || 0);
    }, 0);
    return {
      products: data.products.length,
      totalStock,
      lowStock: 0,
      totalValue,
    };
  }, [data]);

  const actions = useMemo(() => ({
    createProduct: async (payload) => { await postInventoryApi.createProduct(payload); await reload(); },
    updateProduct: async (id, payload) => { await postInventoryApi.updateProduct(id, payload); await reload(); },
    deleteProduct: async (id) => { await postInventoryApi.deleteProduct(id); await reload(); },
    createStock: async (payload) => { await postInventoryApi.createStock(payload); await reload(); },
    updateStock: async (id, payload) => { await postInventoryApi.updateStock(id, payload); await reload(); },
    deleteStock: async (id) => { await postInventoryApi.deleteStock(id); await reload(); },
  }), [reload]);

  return { ...data, loading, stats, reload, ...actions };
}
