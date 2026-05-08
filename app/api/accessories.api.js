import { apiFetch } from "./client";

export const accessoriesApi = {
  list: () => apiFetch("/api/accessories"),
  create: (payload) => apiFetch("/api/accessories/items", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, payload) => apiFetch(`/api/accessories/items/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  delete: (id) => apiFetch(`/api/accessories/items/${id}`, { method: "DELETE" }),
};
