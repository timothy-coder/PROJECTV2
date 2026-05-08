import { apiFetch } from "./client";

export const prospeccionApi = {
  list: () => apiFetch("/api/prospeccion"),
  create: (payload) => apiFetch("/api/prospeccion", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, payload) => apiFetch(`/api/prospeccion/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  delete: (id) => apiFetch(`/api/prospeccion/${id}`, { method: "DELETE" }),
};
