import { apiFetch } from "./client";

export const clientsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiFetch(`/api/clients${suffix}`);
  },
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
  import: (rows) =>
    apiFetch("/api/clients/import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
  importVehicles: (rows) =>
    apiFetch("/api/clients/vehicles/import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
  importMaintenance: (rows) =>
    apiFetch("/api/clients/vehicles/maintenance/import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
  recalculateVehicleMaintenance: () =>
    apiFetch("/api/clients/vehicles/maintenance/recalculate", {
      method: "POST",
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
  addVehicleMaintenance: (id, payload) =>
    apiFetch(`/api/clients/vehicles/${id}/maintenance`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
