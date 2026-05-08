import { apiFetch } from "./client";

export const pricesApi = {
  list: () => apiFetch("/api/prices"),
  save: (payload) => apiFetch("/api/prices", { method: "POST", body: JSON.stringify(payload) }),
};
