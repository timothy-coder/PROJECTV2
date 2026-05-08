import { apiFetch } from "./client";

export const usersApi = {
  list: () => apiFetch("/api/users"),
  create: (payload) =>
    apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    apiFetch(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  delete: (id) =>
    apiFetch(`/api/users/${id}`, {
      method: "DELETE",
    }),
};
