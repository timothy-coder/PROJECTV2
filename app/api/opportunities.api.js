import { apiFetch } from "./client";

export const opportunitiesApi = {
  list: (kind = "opportunity") => apiFetch(`/api/opportunities?kind=${kind}`),
  create: (payload, kind = "opportunity") => apiFetch(`/api/opportunities?kind=${kind}`, { method: "POST", body: JSON.stringify({ ...payload, kind }) }),
  update: (id, payload) => apiFetch(`/api/opportunities/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  assign: (id, payload) => apiFetch(`/api/opportunities/${id}/assign`, { method: "PUT", body: JSON.stringify(payload) }),
};
