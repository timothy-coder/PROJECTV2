import { apiFetch } from "./client";

export const brandsModelsApi = {
  list: () => apiFetch("/api/brandsmodels"),
  createBrand: (payload) => apiFetch("/api/brandsmodels/brands", { method: "POST", body: JSON.stringify(payload) }),
  updateBrand: (id, payload) => apiFetch(`/api/brandsmodels/brands/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteBrand: (id) => apiFetch(`/api/brandsmodels/brands/${id}`, { method: "DELETE" }),
  createModel: (payload) => apiFetch("/api/brandsmodels/models", { method: "POST", body: JSON.stringify(payload) }),
  updateModel: (id, payload) => apiFetch(`/api/brandsmodels/models/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteModel: (id) => apiFetch(`/api/brandsmodels/models/${id}`, { method: "DELETE" }),
  createClass: (payload) => apiFetch("/api/brandsmodels/classes", { method: "POST", body: JSON.stringify(payload) }),
  updateClass: (id, payload) => apiFetch(`/api/brandsmodels/classes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteClass: (id) => apiFetch(`/api/brandsmodels/classes/${id}`, { method: "DELETE" }),
  createMaintenance: (payload) => apiFetch("/api/brandsmodels/maintenance", { method: "POST", body: JSON.stringify(payload) }),
  updateMaintenance: (id, payload) => apiFetch(`/api/brandsmodels/maintenance/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteMaintenance: (id) => apiFetch(`/api/brandsmodels/maintenance/${id}`, { method: "DELETE" }),
};
