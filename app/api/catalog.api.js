import { apiFetch } from "./client";

async function upload(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/catalog/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Error HTTP ${res.status}`);
  return data;
}

export const catalogApi = {
  list: () => apiFetch("/api/catalog"),
  createGroup: (payload) => apiFetch("/api/catalog/groups", { method: "POST", body: JSON.stringify(payload) }),
  updateGroup: (id, payload) => apiFetch(`/api/catalog/groups/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteGroup: (id) => apiFetch(`/api/catalog/groups/${id}`, { method: "DELETE" }),
  createItem: (payload) => apiFetch("/api/catalog/items", { method: "POST", body: JSON.stringify(payload) }),
  updateItem: (id, payload) => apiFetch(`/api/catalog/items/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteItem: (id) => apiFetch(`/api/catalog/items/${id}`, { method: "DELETE" }),
  import: (rows) => apiFetch("/api/catalog/import", { method: "POST", body: JSON.stringify({ rows }) }),
  upload,
};
