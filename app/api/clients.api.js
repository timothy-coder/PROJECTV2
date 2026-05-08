import { apiFetch } from "./client";

export const clientsApi = {
  list: () => apiFetch("/api/clients"),
  create: (payload) =>
    apiFetch("/api/clients", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    apiFetch(`/api/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  delete: (id) =>
    apiFetch(`/api/clients/${id}`, {
      method: "DELETE",
    }),
  createVehicle: (payload) =>
    apiFetch("/api/clients/vehicles", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateVehicle: (id, payload) =>
    apiFetch(`/api/clients/vehicles/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteVehicle: (id) =>
    apiFetch(`/api/clients/vehicles/${id}`, {
      method: "DELETE",
    }),
};
