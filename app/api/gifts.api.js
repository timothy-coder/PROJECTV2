import { apiFetch } from "./client";

export const giftsApi = {
  list: () => apiFetch("/api/gifts"),
  create: (payload) => apiFetch("/api/gifts/items", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, payload) => apiFetch(`/api/gifts/items/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  delete: (id) => apiFetch(`/api/gifts/items/${id}`, { method: "DELETE" }),
};
