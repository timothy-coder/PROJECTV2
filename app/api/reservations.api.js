import { apiFetch } from "./client";

export const reservationsApi = {
  list: () => apiFetch("/api/reservations"),
  detail: (id) => apiFetch(`/api/reservations/items/${id}`),
  update: (id, payload) => apiFetch(`/api/reservations/items/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
};
