"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { pricesApi } from "@/app/api/prices.api";

function keyOf(modelId, submantenimientoId) {
  return `${modelId}:${submantenimientoId}`;
}

export function usePrices() {
  const [data, setData] = useState({ maintenances: [], submaintenances: [], models: [], prices: [] });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const timersRef = useRef(new Map());

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await pricesApi.list();
    setData(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const priceMap = useMemo(() => {
    const map = new Map();
    data.prices.forEach((price) => map.set(keyOf(price.modeloId, price.submantenimientoId), price.precio));
    return map;
  }, [data.prices]);

  const savePrice = useCallback((payload) => {
    const key = keyOf(payload.modeloId, payload.submantenimientoId);
    setSavingKey(key);
    setData((current) => {
      const prices = current.prices.filter((price) => keyOf(price.modeloId, price.submantenimientoId) !== key);
      return { ...current, prices: [...prices, payload] };
    });

    clearTimeout(timersRef.current.get(key));
    const timer = setTimeout(async () => {
      await pricesApi.save(payload);
      setSavingKey("");
    }, 450);
    timersRef.current.set(key, timer);
  }, []);

  return { ...data, loading, priceMap, savingKey, reload, savePrice };
}
