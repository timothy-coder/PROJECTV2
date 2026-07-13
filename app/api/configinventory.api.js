import { apiFetch } from "./client";

export const configInventoryApi = {
  list: () => apiFetch("/api/configinventory"),
  getSettings: () => apiFetch("/api/configinventory/settings"),
  updateSettings: (payload) => apiFetch("/api/configinventory/settings", { method: "PUT", body: JSON.stringify(payload) }),
  listCurrencies: () => apiFetch("/api/configinventory/currencies"),
  updateCurrencies: (payload) => apiFetch("/api/configinventory/currencies", { method: "PUT", body: JSON.stringify(payload) }),
  listMeasureTypes: () => apiFetch("/api/configinventory/measure-types"),
  createMeasureType: (payload) => apiFetch("/api/configinventory/measure-types", { method: "POST", body: JSON.stringify(payload) }),
  updateMeasureType: (id, payload) => apiFetch(`/api/configinventory/measure-types/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteMeasureType: (id) => apiFetch(`/api/configinventory/measure-types/${id}`, { method: "DELETE" }),
  listVoucherTypes: () => apiFetch("/api/configinventory/voucher-types"),
  createVoucherType: (payload) => apiFetch("/api/configinventory/voucher-types", { method: "POST", body: JSON.stringify(payload) }),
  updateVoucherType: (id, payload) => apiFetch(`/api/configinventory/voucher-types/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteVoucherType: (id) => apiFetch(`/api/configinventory/voucher-types/${id}`, { method: "DELETE" }),
  createType: (payload) => apiFetch("/api/configinventory/types", { method: "POST", body: JSON.stringify(payload) }),
  updateType: (id, payload) => apiFetch(`/api/configinventory/types/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteType: (id) => apiFetch(`/api/configinventory/types/${id}`, { method: "DELETE" }),
};
