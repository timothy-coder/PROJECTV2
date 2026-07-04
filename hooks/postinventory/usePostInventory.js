"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { postInventoryApi } from "@/app/api/postinventory.api";

export function usePostInventory() {
  const [data, setData] = useState({
    products: [],
    combos: [],
    soldProducts: [],
    stocks: [],
    options: {
      settings: {},
      types: [],
      measureTypes: [],
      providers: [],
      currencies: [],
      centers: [],
      workshops: [],
      counters: [],
      lots: [],
      shelves: [],
      shelfLevels: [],
      shelfPositions: [],
    },
  });
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
      combos: next.combos || [],
      soldProducts: next.soldProducts || [],
      stocks: next.stocks || [],
      options: {
        settings: next.options?.settings || {},
        types: next.options?.types || [],
        measureTypes: next.options?.measureTypes || [],
        providers: next.options?.providers || [],
        currencies: next.options?.currencies || [],
        centers: next.options?.centers || [],
        workshops: next.options?.workshops || [],
        counters: next.options?.counters || [],
        lots: next.options?.lots || [],
        shelves: next.options?.shelves || [],
        shelfLevels: next.options?.shelfLevels || [],
        shelfPositions: next.options?.shelfPositions || [],
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
      combos: data.combos.length,
      soldProducts: data.soldProducts.length,
      totalStock,
      lowStock: 0,
      totalValue,
    };
  }, [data]);

  const actions = useMemo(() => ({
    createProduct: async (payload) => { await postInventoryApi.createProduct(payload); await reload(); },
    updateProduct: async (id, payload) => { await postInventoryApi.updateProduct(id, payload); await reload(); },
    deleteProduct: async (id) => { await postInventoryApi.deleteProduct(id); await reload(); },
    createLot: async (payload) => { await postInventoryApi.createLot(payload); await reload(); },
    updateLot: async (id, payload) => { await postInventoryApi.updateLot(id, payload); await reload(); },
    deleteLot: async (id) => { await postInventoryApi.deleteLot(id); await reload(); },
    importProducts: async (rows) => { const result = await postInventoryApi.importProducts(rows); await reload(); return result; },
    createSoldProduct: async (payload) => { await postInventoryApi.createSoldProduct(payload); await reload(); },
    updateSoldProduct: async (id, payload) => { await postInventoryApi.updateSoldProduct(id, payload); await reload(); },
    deleteSoldProduct: async (id) => { await postInventoryApi.deleteSoldProduct(id); await reload(); },
    importSoldProducts: async (rows) => { const result = await postInventoryApi.importSoldProducts(rows); await reload(); return result; },
    createCombo: async (payload) => { await postInventoryApi.createCombo(payload); await reload(); },
    updateCombo: async (id, payload) => { await postInventoryApi.updateCombo(id, payload); await reload(); },
    deleteCombo: async (id) => { await postInventoryApi.deleteCombo(id); await reload(); },
    createStock: async (payload) => { await postInventoryApi.createStock(payload); await reload(); },
    importStock: async (rows) => { const result = await postInventoryApi.importStock(rows); await reload(); return result; },
    updateStock: async (id, payload) => { await postInventoryApi.updateStock(id, payload); await reload(); },
    deleteStock: async (id) => { await postInventoryApi.deleteStock(id); await reload(); },
  }), [reload]);

  return { ...data, loading, stats, reload, ...actions };
}
