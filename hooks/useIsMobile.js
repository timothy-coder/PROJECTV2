"use client";

import { useEffect, useState } from "react";

/**
 * Hook para detectar si el viewport está en modo "mobile".
 * @param {number} breakpoint - ancho (px) a partir del cual ya NO se considera mobile.
 * Ej: 768 => mobile si width < 768 (equivalente a tailwind md).
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // SSR safe: corre solo en cliente
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

    const update = () => setIsMobile(mql.matches);

    // inicial
    update();

    // listener
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }

    // fallback (Safari viejo)
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, [breakpoint]);

  return isMobile;
}