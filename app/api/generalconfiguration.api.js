import { apiFetch } from "./client";

export const generalConfigurationApi = {
  centros: () => apiFetch("/api/generalconfiguration/centros"),
  createCentro: ({ nombre }) =>
    apiFetch("/api/generalconfiguration/centros", {
      method: "POST",
      body: JSON.stringify({ nombre }),
    }),
  updateCentro: (id, { nombre }) =>
    apiFetch(`/api/generalconfiguration/centros/${id}`, {
      method: "PUT",
      body: JSON.stringify({ nombre }),
    }),
  deleteCentro: (id) =>
    apiFetch(`/api/generalconfiguration/centros/${id}`, {
      method: "DELETE",
    }),
  talleres: (centroId) =>
    apiFetch(`/api/generalconfiguration/talleres?centroId=${centroId}`),
  createTaller: ({ centroId, nombre }) =>
    apiFetch("/api/generalconfiguration/talleres", {
      method: "POST",
      body: JSON.stringify({ centroId, nombre }),
    }),
  updateTaller: (id, { centroId, nombre }) =>
    apiFetch(`/api/generalconfiguration/talleres/${id}`, {
      method: "PUT",
      body: JSON.stringify({ centroId, nombre }),
    }),
  deleteTaller: (id) =>
    apiFetch(`/api/generalconfiguration/talleres/${id}`, {
      method: "DELETE",
    }),
  mostradores: (centroId) =>
    apiFetch(`/api/generalconfiguration/mostradores?centroId=${centroId}`),
  createMostrador: ({ centroId, nombre }) =>
    apiFetch("/api/generalconfiguration/mostradores", {
      method: "POST",
      body: JSON.stringify({ centroId, nombre }),
    }),
  updateMostrador: (id, { centroId, nombre }) =>
    apiFetch(`/api/generalconfiguration/mostradores/${id}`, {
      method: "PUT",
      body: JSON.stringify({ centroId, nombre }),
    }),
  deleteMostrador: (id) =>
    apiFetch(`/api/generalconfiguration/mostradores/${id}`, {
      method: "DELETE",
    }),
  motivosCitas: () => apiFetch("/api/generalconfiguration/motivos-citas"),
  createMotivoCita: ({ nombre, isActive = true }) =>
    apiFetch("/api/generalconfiguration/motivos-citas", {
      method: "POST",
      body: JSON.stringify({ nombre, isActive }),
    }),
  updateMotivoCita: (id, { nombre, isActive = true }) =>
    apiFetch(`/api/generalconfiguration/motivos-citas/${id}`, {
      method: "PUT",
      body: JSON.stringify({ nombre, isActive }),
    }),
  deleteMotivoCita: (id) =>
    apiFetch(`/api/generalconfiguration/motivos-citas/${id}`, {
      method: "DELETE",
    }),
  createSubmotivoCita: ({ motivoId, nombre, isActive = true }) =>
    apiFetch("/api/generalconfiguration/submotivos-citas", {
      method: "POST",
      body: JSON.stringify({ motivoId, nombre, isActive }),
    }),
  updateSubmotivoCita: (id, { motivoId, nombre, isActive = true }) =>
    apiFetch(`/api/generalconfiguration/submotivos-citas/${id}`, {
      method: "PUT",
      body: JSON.stringify({ motivoId, nombre, isActive }),
    }),
  deleteSubmotivoCita: (id) =>
    apiFetch(`/api/generalconfiguration/submotivos-citas/${id}`, {
      method: "DELETE",
    }),
  origenesCitas: () => apiFetch("/api/generalconfiguration/origenes-citas"),
  createOrigenCita: ({ name, isActive = true }) =>
    apiFetch("/api/generalconfiguration/origenes-citas", {
      method: "POST",
      body: JSON.stringify({ name, isActive }),
    }),
  updateOrigenCita: (id, { name, isActive = true }) =>
    apiFetch(`/api/generalconfiguration/origenes-citas/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, isActive }),
    }),
  deleteOrigenCita: (id) =>
    apiFetch(`/api/generalconfiguration/origenes-citas/${id}`, {
      method: "DELETE",
    }),
  suborigenesCitas: (origenId = "") =>
    apiFetch(`/api/generalconfiguration/suborigenes-citas?origenId=${origenId}`),
  createSuborigenCita: ({ origenId, name, isActive = true }) =>
    apiFetch("/api/generalconfiguration/suborigenes-citas", {
      method: "POST",
      body: JSON.stringify({ origenId, name, isActive }),
    }),
  updateSuborigenCita: (id, { origenId, name, isActive = true }) =>
    apiFetch(`/api/generalconfiguration/suborigenes-citas/${id}`, {
      method: "PUT",
      body: JSON.stringify({ origenId, name, isActive }),
    }),
  deleteSuborigenCita: (id) =>
    apiFetch(`/api/generalconfiguration/suborigenes-citas/${id}`, {
      method: "DELETE",
    }),
  monedas: () => apiFetch("/api/generalconfiguration/monedas"),
  createMoneda: ({ codigo, nombre, simbolo, isActive = true }) =>
    apiFetch("/api/generalconfiguration/monedas", {
      method: "POST",
      body: JSON.stringify({ codigo, nombre, simbolo, isActive }),
    }),
  updateMoneda: (id, { codigo, nombre, simbolo, isActive = true }) =>
    apiFetch(`/api/generalconfiguration/monedas/${id}`, {
      method: "PUT",
      body: JSON.stringify({ codigo, nombre, simbolo, isActive }),
    }),
  deleteMoneda: (id) =>
    apiFetch(`/api/generalconfiguration/monedas/${id}`, {
      method: "DELETE",
    }),
  impuestos: () => apiFetch("/api/generalconfiguration/impuestos"),
  createImpuesto: ({ nombre, porcentaje, isActive = true }) =>
    apiFetch("/api/generalconfiguration/impuestos", {
      method: "POST",
      body: JSON.stringify({ nombre, porcentaje, isActive }),
    }),
  updateImpuesto: (id, { nombre, porcentaje, isActive = true }) =>
    apiFetch(`/api/generalconfiguration/impuestos/${id}`, {
      method: "PUT",
      body: JSON.stringify({ nombre, porcentaje, isActive }),
    }),
  deleteImpuesto: (id) =>
    apiFetch(`/api/generalconfiguration/impuestos/${id}`, {
      method: "DELETE",
    }),
  tarifas: (tipo) => apiFetch(`/api/generalconfiguration/tarifas?tipo=${tipo}`),
  createTarifa: ({ tipo, monedaId, nombre, precioHora, activo = true }) =>
    apiFetch("/api/generalconfiguration/tarifas", {
      method: "POST",
      body: JSON.stringify({ tipo, monedaId, nombre, precioHora, activo }),
    }),
  updateTarifa: (id, { tipo, monedaId, nombre, precioHora, activo = true }) =>
    apiFetch(`/api/generalconfiguration/tarifas/${id}`, {
      method: "PUT",
      body: JSON.stringify({ tipo, monedaId, nombre, precioHora, activo }),
    }),
  deleteTarifa: (id) =>
    apiFetch(`/api/generalconfiguration/tarifas/${id}`, {
      method: "DELETE",
    }),
};
