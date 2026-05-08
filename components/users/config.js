export const USER_PERMISSION_GROUPS = [
  { key: "home", label: "Home", actions: ["view"] },
  { key: "usuarios", label: "Usuarios", actions: ["view", "create", "edit", "delete"] },
  { key: "clientes", label: "Clientes", actions: ["view", "create", "edit", "delete"] },
  { key: "marcas", label: "Marcas", actions: ["view", "create", "edit", "delete"] },
  { key: "modelos", label: "Modelos", actions: ["view", "create", "edit", "delete"] },
  { key: "clases", label: "Clases de Vehiculos", actions: ["view", "create", "edit", "delete"] },
  { key: "algoritmo_visita", label: "F. de mantenimiento", actions: ["view", "create", "edit", "delete"] },
  { key: "inventario", label: "Inventario", actions: ["view", "create", "edit", "delete"] },
  { key: "combomantenimiento", label: "Mantenimientos", actions: ["view", "create", "edit", "delete"] },
  { key: "submantenimiento", label: "Submantenimientos", actions: ["view", "create", "edit", "delete"] },
  { key: "configinventario", label: "Config. Inventario", actions: ["view", "create", "edit", "delete"] },
  { key: "inventariocarros", label: "Precios de Carros", actions: ["view", "create", "edit", "delete", "import", "export", "history"] },
  { key: "catalogoventa", label: "Catalogo Venta", actions: ["view", "create", "edit", "delete", "import", "export"] },
  { key: "accesoriosventa", label: "Accesorios Venta", actions: ["view", "create", "edit", "delete"] },
  { key: "regalosventa", label: "Regalos Venta", actions: ["view", "create", "edit", "delete"] },
  { key: "prospeccion", label: "Auto prospeccion", actions: ["view", "create", "edit", "delete"] },
  { key: "citas", label: "Citas", actions: ["view", "create", "edit", "delete", "viewall"] },
  { key: "oportunidadespv", label: "Oportunidades PosVenta", actions: ["view", "create", "edit", "delete", "viewall", "asignar"] },
  { key: "leadspv", label: "Leads PostVenta", actions: ["view", "create", "edit", "delete", "viewall", "asignar"] },
  { key: "cotizacion", label: "Cotizacion", actions: ["view", "create", "edit", "delete"] },
  { key: "agenda", label: "Agenda", actions: ["view", "create", "edit", "viewall"] },
  { key: "oportunidades", label: "Oportunidades", actions: ["view", "create", "edit", "delete", "viewall", "asignar"] },
  { key: "leads", label: "Leads", actions: ["view", "create", "edit", "delete", "viewall", "asignar"] },
  { key: "reservas", label: "Reservas", actions: ["view", "viewall", "review", "firm", "edit"] },
  { key: "configagenda", label: "Config. Ventas", actions: ["view", "create", "edit", "delete"] },
  { key: "configcotizacion", label: "Config. Citas", actions: ["view", "create", "edit", "delete"] },
  { key: "mensajes", label: "Mensajes", actions: ["view", "create", "edit", "delete"] },
  { key: "configuracion", label: "Configuracion", actions: ["view", "create", "edit", "delete"] },
  { key: "configuracion_centros", label: "Config. Centros", actions: ["view", "create", "edit", "delete"] },
  { key: "configuracion_talleres", label: "Config. Talleres", actions: ["view", "create", "edit", "delete"] },
  { key: "configuracion_mostradores", label: "Config. Mostradores", actions: ["view", "create", "edit", "delete"] },
  { key: "configuracion_monedas", label: "Config. Monedas", actions: ["view", "create", "edit", "delete"] },
  { key: "configuracion_impuestos", label: "Config. Impuestos", actions: ["view", "create", "edit", "delete"] },
  { key: "configuracion_tarifas_mano_obra", label: "Config. Mano de Obra", actions: ["view", "create", "edit", "delete"] },
  { key: "configuracion_tarifas_panos", label: "Config. Panos", actions: ["view", "create", "edit", "delete"] },
];

export const WORK_DAYS = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miercoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sabado" },
  { key: "sunday", label: "Domingo" },
];

export function defaultWorkSchedule() {
  return Object.fromEntries(
    WORK_DAYS.map((day) => [
      day.key,
      { active: ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(day.key), start: "08:00", end: "18:00" },
    ])
  );
}
