import { apiFetch } from "./client";

export const maintenanceApi = {
  list: () => apiFetch("/api/maintenance"),
  createMaintenance: (payload) => apiFetch("/api/maintenance/items", { method: "POST", body: JSON.stringify(payload) }),
  updateMaintenance: (id, payload) => apiFetch(`/api/maintenance/items/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteMaintenance: (id) => apiFetch(`/api/maintenance/items/${id}`, { method: "DELETE" }),
  createSubmaintenance: (payload) => apiFetch("/api/maintenance/subitems", { method: "POST", body: JSON.stringify(payload) }),
  updateSubmaintenance: (id, payload) => apiFetch(`/api/maintenance/subitems/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteSubmaintenance: (id) => apiFetch(`/api/maintenance/subitems/${id}`, { method: "DELETE" }),
};
