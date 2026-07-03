import { apiFetch } from "./client";

export const warehouseLocationsApi = {
  list: () => apiFetch("/api/warehouse-locations"),
  createShelf: (payload) => apiFetch("/api/warehouse-locations/shelves", { method: "POST", body: JSON.stringify(payload) }),
  updateShelf: (id, payload) => apiFetch(`/api/warehouse-locations/shelves/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteShelf: (id) => apiFetch(`/api/warehouse-locations/shelves/${id}`, { method: "DELETE" }),
  createLevel: (payload) => apiFetch("/api/warehouse-locations/levels", { method: "POST", body: JSON.stringify(payload) }),
  updateLevel: (id, payload) => apiFetch(`/api/warehouse-locations/levels/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteLevel: (id) => apiFetch(`/api/warehouse-locations/levels/${id}`, { method: "DELETE" }),
  createPosition: (payload) => apiFetch("/api/warehouse-locations/positions", { method: "POST", body: JSON.stringify(payload) }),
  updatePosition: (id, payload) => apiFetch(`/api/warehouse-locations/positions/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePosition: (id) => apiFetch(`/api/warehouse-locations/positions/${id}`, { method: "DELETE" }),
};
