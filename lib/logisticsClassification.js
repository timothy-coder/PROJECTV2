export const LOGISTICS_MONTH_KEYS = Array.from({ length: 12 }, (_, index) => `m${index + 1}`);

export function toLogisticsNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sold(value) {
  return toLogisticsNumber(value) > 0 ? 1 : 0;
}

export function calculateLogisticsRow(row) {
  const m4 = ["m1", "m2", "m3", "m4"].reduce((sum, key) => sum + sold(row?.[key]), 0);
  const m12 = LOGISTICS_MONTH_KEYS.reduce((sum, key) => sum + sold(row?.[key]), 0);
  const m8 = ["m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12"].reduce((sum, key) => sum + sold(row?.[key]), 0);

  let tipo = "";
  if (m12 === 0) tipo = "D";
  else if (m4 === 0 && m8 > 0) tipo = "C";
  else if (m4 === 4) tipo = "A";
  else if (m4 === 2 || m4 === 3) tipo = "B";
  else if (m4 === 1) tipo = "C";

  const subf1 = `${tipo}${m4}${m12}`;
  const posible = tipo === "D" && toLogisticsNumber(row?.diasAlmacen) > 365 ? "POSIBLE" : "";
  const nuevo = posible && toLogisticsNumber(row?.stockActual) > 0 ? "N" : "";
  const respuestaFinal = nuevo || subf1;

  return { tipo, respuestaFinal };
}

export function logisticsTypeCode(value) {
  const text = String(value || "").trim().toUpperCase();
  return text.match(/^[ABCDN]/)?.[0] || "";
}
