import { apiFetch } from "./client";

export const postventaQuotesApi = {
  list: (tipo = "taller") => apiFetch(`/api/postventa-quotes?tipo=${encodeURIComponent(tipo)}`),
  detail: (id) => apiFetch(`/api/postventa-quotes/${id}`),
  create: (payload) => apiFetch("/api/postventa-quotes", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, payload) => apiFetch(`/api/postventa-quotes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  delete: (id) => apiFetch(`/api/postventa-quotes/${id}`, { method: "DELETE" }),
  publicDetail: (token) => apiFetch(`/api/postventa-quotes/public/${token}`),
};
