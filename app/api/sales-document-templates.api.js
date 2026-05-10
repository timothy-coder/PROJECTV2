import { apiFetch } from "./client";

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/sales-document-templates/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Error HTTP ${res.status}`);
  return data;
}

export const salesDocumentTemplatesApi = {
  list: () => apiFetch("/api/sales-document-templates"),
  create: (payload) => apiFetch("/api/sales-document-templates", { method: "POST", body: JSON.stringify(payload) }),
  save: (payload) => apiFetch("/api/sales-document-templates/items", { method: "POST", body: JSON.stringify(payload) }),
  uploadImage,
};
