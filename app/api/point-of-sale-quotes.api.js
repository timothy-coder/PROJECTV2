import { apiFetch } from "./client";

export const pointOfSaleQuotesApi = {
  list: (params = {}) => {
    const search = new URLSearchParams();
    if (params.estado) search.set("estado", params.estado);
    const query = search.toString();
    return apiFetch(`/api/point-of-sale-quotes${query ? `?${query}` : ""}`);
  },
  get: (id) => apiFetch(`/api/point-of-sale-quotes/${id}`),
  create: (payload) => apiFetch("/api/point-of-sale-quotes", { method: "POST", body: JSON.stringify(payload) }),
  createMovement: (payload) => apiFetch("/api/point-of-sale-movement-quotes", { method: "POST", body: JSON.stringify(payload) }),
  createSale: (payload) => apiFetch("/api/point-of-sale-sales", { method: "POST", body: JSON.stringify(payload) }),
  updateStatus: (id, estado) => apiFetch(`/api/point-of-sale-quotes/${id}`, { method: "PATCH", body: JSON.stringify({ estado }) }),
  delete: (id) => apiFetch(`/api/point-of-sale-quotes/${id}`, { method: "DELETE" }),
};
