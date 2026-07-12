import { apiFetch } from "./client";

export const pointOfSaleConfigApi = {
  list: () => apiFetch("/api/point-of-sale-config"),
  create: (payload) => apiFetch("/api/point-of-sale-config", { method: "POST", body: JSON.stringify(payload) }),
  close: (payload) => apiFetch("/api/point-of-sale-config", { method: "PUT", body: JSON.stringify(payload) }),
  update: (id, payload) => apiFetch(`/api/point-of-sale-config/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  delete: (id) => apiFetch(`/api/point-of-sale-config/${id}`, { method: "DELETE" }),
};
