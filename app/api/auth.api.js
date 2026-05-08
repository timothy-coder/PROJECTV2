import { apiFetch } from "./client";

export const authApi = {
  login: ({ username, password }) =>
    apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    apiFetch("/api/auth/logout", {
      method: "POST",
    }),

  me: () => apiFetch("/api/auth/me"),
};