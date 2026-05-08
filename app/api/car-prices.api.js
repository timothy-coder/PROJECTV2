import { apiFetch } from "./client";

export const carPricesApi = {
  list: () => apiFetch("/api/car-prices"),
  create: (payload) => apiFetch("/api/car-prices/items", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, payload) => apiFetch(`/api/car-prices/items/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  delete: (id) => apiFetch(`/api/car-prices/items/${id}`, { method: "DELETE" }),
  import: (rows) => apiFetch("/api/car-prices/import", { method: "POST", body: JSON.stringify({ rows }) }),
  createHistory: (payload) => apiFetch("/api/car-prices/history", { method: "POST", body: JSON.stringify(payload) }),
};
