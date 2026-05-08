import { apiFetch } from "./client";

export const configInventoryApi = {
  list: () => apiFetch("/api/configinventory"),
  createType: (payload) => apiFetch("/api/configinventory/types", { method: "POST", body: JSON.stringify(payload) }),
  updateType: (id, payload) => apiFetch(`/api/configinventory/types/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteType: (id) => apiFetch(`/api/configinventory/types/${id}`, { method: "DELETE" }),
};
