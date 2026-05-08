import { apiFetch } from "./client";

export const salesSettingsApi = {
  list: (scope) => apiFetch(`/api/sales-settings/${scope}`),
  save: (scope, payload) => apiFetch(`/api/sales-settings/${scope}`, { method: "POST", body: JSON.stringify(payload) }),
};
