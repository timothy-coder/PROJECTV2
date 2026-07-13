"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { configInventoryApi } from "@/app/api/configinventory.api";

export function useConfigInventory() {
  const [types, setTypes] = useState([]);
  const [measureTypes, setMeasureTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [data, settingsData, measureTypesData, currenciesData, voucherTypesData] = await Promise.all([
      configInventoryApi.list(),
      configInventoryApi.getSettings(),
      configInventoryApi.listMeasureTypes(),
      configInventoryApi.listCurrencies(),
      configInventoryApi.listVoucherTypes(),
    ]);
    setTypes(data.types || []);
    setSettings(settingsData.settings || null);
    setMeasureTypes(measureTypesData.measureTypes || []);
    setCurrencies(currenciesData.currencies || []);
    setVoucherTypes(voucherTypesData.voucherTypes || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const actions = useMemo(() => ({
    createType: async (payload) => { await configInventoryApi.createType(payload); await reload(); },
    updateType: async (id, payload) => { await configInventoryApi.updateType(id, payload); await reload(); },
    deleteType: async (id) => { await configInventoryApi.deleteType(id); await reload(); },
    updateSettings: async (payload) => {
      const data = await configInventoryApi.updateSettings(payload);
      setSettings(data.settings || null);
      return data.settings;
    },
    updateCurrencies: async (payload) => {
      const data = await configInventoryApi.updateCurrencies(payload);
      setCurrencies(data.currencies || []);
      return data.currencies;
    },
    createMeasureType: async (payload) => { await configInventoryApi.createMeasureType(payload); await reload(); },
    updateMeasureType: async (id, payload) => { await configInventoryApi.updateMeasureType(id, payload); await reload(); },
    deleteMeasureType: async (id) => { await configInventoryApi.deleteMeasureType(id); await reload(); },
    createVoucherType: async (payload) => { await configInventoryApi.createVoucherType(payload); await reload(); },
    updateVoucherType: async (id, payload) => { await configInventoryApi.updateVoucherType(id, payload); await reload(); },
    deleteVoucherType: async (id) => { await configInventoryApi.deleteVoucherType(id); await reload(); },
  }), [reload]);

  return { types, measureTypes, currencies, voucherTypes, settings, loading, stats: { total: types.length, totalMeasureTypes: measureTypes.length, totalVoucherTypes: voucherTypes.length }, reload, ...actions };
}
