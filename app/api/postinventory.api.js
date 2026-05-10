import { apiFetch } from "./client";

export const postInventoryApi = {
  list: () => apiFetch("/api/postinventory"),
  listTypes: () => apiFetch("/api/configinventory"),
  createProduct: (payload) => apiFetch("/api/postinventory/products", { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: (id, payload) => apiFetch(`/api/postinventory/products/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteProduct: (id) => apiFetch(`/api/postinventory/products/${id}`, { method: "DELETE" }),
  createCombo: (payload) => apiFetch("/api/postinventory/combos", { method: "POST", body: JSON.stringify(payload) }),
  updateCombo: (id, payload) => apiFetch(`/api/postinventory/combos/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCombo: (id) => apiFetch(`/api/postinventory/combos/${id}`, { method: "DELETE" }),
  createStock: (payload) => apiFetch("/api/postinventory/stock", { method: "POST", body: JSON.stringify(payload) }),
  updateStock: (id, payload) => apiFetch(`/api/postinventory/stock/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteStock: (id) => apiFetch(`/api/postinventory/stock/${id}`, { method: "DELETE" }),
};
