import { apiFetch } from "./client";

export const postInventoryApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.context) query.set("context", params.context);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiFetch(`/api/postinventory${suffix}`);
  },
  listTypes: () => apiFetch("/api/configinventory"),
  createProduct: (payload) => apiFetch("/api/postinventory/products", { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: (id, payload) => apiFetch(`/api/postinventory/products/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteProduct: (id) => apiFetch(`/api/postinventory/products/${id}`, { method: "DELETE" }),
  createLot: (payload) => apiFetch("/api/postinventory/lots", { method: "POST", body: JSON.stringify(payload) }),
  updateLot: (id, payload) => apiFetch(`/api/postinventory/lots/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteLot: (id) => apiFetch(`/api/postinventory/lots/${id}`, { method: "DELETE" }),
  importProducts: (rows) => apiFetch("/api/postinventory/products/import", { method: "POST", body: JSON.stringify({ rows }) }),
  createSoldProduct: (payload) => apiFetch("/api/postinventory/sold-products", { method: "POST", body: JSON.stringify(payload) }),
  updateSoldProduct: (id, payload) => apiFetch(`/api/postinventory/sold-products/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteSoldProduct: (id) => apiFetch(`/api/postinventory/sold-products/${id}`, { method: "DELETE" }),
  importSoldProducts: (rows) => apiFetch("/api/postinventory/sold-products/import", { method: "POST", body: JSON.stringify({ rows }) }),
  createCombo: (payload) => apiFetch("/api/postinventory/combos", { method: "POST", body: JSON.stringify(payload) }),
  updateCombo: (id, payload) => apiFetch(`/api/postinventory/combos/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCombo: (id) => apiFetch(`/api/postinventory/combos/${id}`, { method: "DELETE" }),
  createStock: (payload) => apiFetch("/api/postinventory/stock", { method: "POST", body: JSON.stringify(payload) }),
  importStock: (rows) => apiFetch("/api/postinventory/stock/import", { method: "POST", body: JSON.stringify({ rows }) }),
  updateStock: (id, payload) => apiFetch(`/api/postinventory/stock/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteStock: (id) => apiFetch(`/api/postinventory/stock/${id}`, { method: "DELETE" }),
};
