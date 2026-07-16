export const USER_PERMISSION_GROUPS = [
  { section: "Inicio", key: "home", label: "Inicio", actions: ["ventasview", "ventasviewall", "posventaview", "posventaviewall"] },

  { section: "Administracion", key: "usuarios", label: "Usuarios", actions: ["view", "create", "edit", "delete"] },
  { section: "Administracion", key: "clientes", label: "Clientes", actions: ["view", "viewall", "create", "edit", "delete", "vehicles", "import", "export", "vehicles_import", "vehicles_export", "maintenance_import", "maintenance_export"] },
  { section: "Administracion", key: "proveedores", label: "Proveedores", actions: ["view", "create", "edit", "delete"] },
  { section: "Administracion", key: "marcas", label: "Marcas", actions: ["view", "create", "edit", "delete"] },
  { section: "Administracion", key: "modelos", label: "Modelos", actions: ["view", "create", "edit", "delete"] },
  { section: "Administracion", key: "clases", label: "Clases de Vehiculos", actions: ["view", "create", "edit", "delete"] },

  { section: "Ventas", key: "inventariocarros", label: "Precios e inventario de carros", actions: ["view", "create", "edit", "delete", "import", "export", "history", "history_create", "history_edit", "history_import", "history_export", "delivered", "pending_purchase"] },
  { section: "Ventas", key: "catalogoventa", label: "Catalogo de venta", actions: ["view", "create", "edit", "delete", "import", "export"] },
  { section: "Ventas", key: "accesoriosventa", label: "Accesorios de venta", actions: ["view", "create", "edit", "delete"] },
  { section: "Ventas", key: "regalosventa", label: "Regalos de venta", actions: ["view", "create", "edit", "delete"] },
  { section: "Ventas", key: "agenda", label: "Agenda de ventas", actions: ["view", "create", "edit", "viewall"] },
  { section: "Ventas", key: "oportunidades", label: "Oportunidades de venta", actions: ["view", "create", "edit", "delete", "viewall", "asignar"] },
  { section: "Ventas", key: "leads", label: "Leads de venta", actions: ["view", "create", "edit", "delete", "viewall", "asignar"] },
  { section: "Ventas", key: "leads_ford", label: "Leads Ford", actions: ["view", "sync", "create", "edit", "manual_import"] },
  { section: "Ventas", key: "cotizacion", label: "Cotizaciones", actions: ["view", "viewall", "create", "edit", "delete", "status"] },
  { section: "Ventas", key: "cotizacion_ford", label: "Cotizaciones Ford", actions: ["view"] },
  { section: "Ventas", key: "cotizacion_otros", label: "Cotizaciones otras marcas", actions: ["view"] },
  { section: "Ventas", key: "reservas", label: "Notas de pedido", actions: ["view", "viewall", "review", "firm", "edit", "car_data", "send_signature", "observe", "subsanate", "sign"] },

  { section: "Posventa", key: "citas", label: "Agenda posventa", actions: ["view", "create", "edit", "delete", "viewall"] },
  { section: "Posventa", key: "citas_nueva", label: "Nueva cita posventa", actions: ["view"] },
  { section: "Posventa", key: "proximosmantenimientos", label: "Proximos mantenimientos", actions: ["view", "viewall"] },
  { section: "Posventa", key: "oportunidadespv", label: "Oportunidades posventa", actions: ["view", "create", "edit", "delete", "viewall", "asignar"] },
  { section: "Posventa", key: "leadspv", label: "Leads posventa", actions: ["view", "create", "edit", "delete", "viewall", "asignar"] },
  { section: "Posventa", key: "ordenespv", label: "Ordenes posventa", actions: ["view", "viewall", "create", "edit", "delete"] },
  { section: "Posventa", key: "planeador_tallerpv", label: "Planeador de taller", actions: ["view", "viewall", "create", "edit", "delete"] },
  { section: "Posventa", key: "inventario", label: "Inventario posventa", actions: ["view", "create", "edit", "delete", "lotes", "lotes_view", "lotes_viewall", "lotes_edit", "lotes_editall"] },
  { section: "Posventa", key: "ubicacion_inventario", label: "Ubicacion de inventario", actions: ["view", "create", "edit", "delete", "import"] },
  { section: "Posventa", key: "combomantenimiento", label: "Mantenimientos", actions: ["view", "create", "edit", "delete"] },
  { section: "Posventa", key: "submantenimiento", label: "Submantenimientos", actions: ["view", "create", "edit", "delete"] },
  { section: "Posventa", key: "prospeccion", label: "Auto prospeccion", actions: ["view", "create", "edit", "delete"] },

  { section: "Punto de venta", key: "puntoventa", label: "Punto de venta", actions: ["view", "scan", "sell_any_price"] },
  { section: "Punto de venta", key: "puntoventa_cotizaciones", label: "Cotizaciones de punto de venta", actions: ["view", "viewteam", "viewall", "edit", "delete", "sell"] },
  { section: "Punto de venta", key: "puntoventa_anticipos", label: "Anticipos de punto de venta", actions: ["view", "viewteam", "viewall"] },

  { section: "Reportes y comunicacion", key: "reportes", label: "Reportes", actions: ["view"] },
  { section: "Reportes y comunicacion", key: "mensajes", label: "Mensajes", actions: ["view", "create", "edit", "delete"] },
  { section: "Reportes y comunicacion", key: "notificaciones", label: "Notificaciones", actions: ["send"] },
  { section: "Reportes y comunicacion", key: "sistema_logistico", label: "Sistema logistico", actions: ["view"] },
  { section: "Reportes y comunicacion", key: "external_api", label: "API externa", actions: ["view"] },

  { section: "Configuracion", key: "configuracion", label: "Configuracion general", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_roles", label: "Roles", actions: ["view", "create"] },
  { section: "Configuracion", key: "configuracion_perfiles_permisos", label: "Perfiles de permisos", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_datos_fiscales_punto", label: "Datos fiscales por punto", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_centros", label: "Centros", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_talleres", label: "Talleres", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_mostradores", label: "Mostradores", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_monedas", label: "Monedas", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_impuestos", label: "Impuestos", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_links", label: "Links", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configagenda", label: "Configuracion de ventas", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_horas", label: "Horas", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_usuario_counts", label: "Conteos de usuarios", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "config_testdrive", label: "Configuracion test drive", actions: ["view", "edit"] },
  { section: "Configuracion", key: "config_ventas_plantillas", label: "Plantillas de venta", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configcotizacion", label: "Configuracion de citas", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configinventario", label: "Configuracion de inventario", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "config_posventa_monedas", label: "Monedas de inventario posventa", actions: ["view", "edit"] },
  { section: "Configuracion", key: "config_tipos_comprobante", label: "Tipos de comprobante", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "config_anaqueles", label: "Anaqueles", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "config_posventa_cierres", label: "Cierres posventa", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "config_tipos_medida", label: "Tipos de medida", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "config_puntoventa", label: "Punto de venta", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_motivos_citas", label: "Motivos de citas", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_submotivos_citas", label: "Submotivos de citas", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_origenes_citas", label: "Origenes de citas", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_suborigenes_citas", label: "Suborigenes de citas", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_tarifas_mano_obra", label: "Mano de obra", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_tarifas_panos", label: "Panos", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "configuracion_frecuencia", label: "Frecuencia", actions: ["view", "create", "edit", "delete"] },
  { section: "Configuracion", key: "algoritmo_visita", label: "Frecuencia de mantenimiento", actions: ["view", "create", "edit", "delete"] },
];

export function getPermissionSections(groups = USER_PERMISSION_GROUPS) {
  const sectionMap = new Map();

  for (const group of groups) {
    const section = group.section || "Otros";
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    sectionMap.get(section).push(group);
  }

  return Array.from(sectionMap, ([label, items]) => ({ label, items }));
}

export const PERMISSION_ACTION_LABELS = {
  view: "Ingresar",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  viewteam: "Ver mismo taller/mostrador",
  viewall: "Ver todo",
  ventasview: "Ver ventas propias",
  ventasviewall: "Ver todas las ventas",
  posventaview: "Ver posventa propia",
  posventaviewall: "Ver toda posventa",
  vehicles: "Ver vehiculos",
  import: "Importar",
  export: "Exportar",
  vehicles_import: "Importar vehiculos",
  vehicles_export: "Exportar vehiculos",
  maintenance_import: "Importar mantenimientos",
  maintenance_export: "Exportar mantenimientos",
  lotes: "Gestionar lotes",
  lotes_view: "Ver lotes propios",
  lotes_viewall: "Ver todos los lotes",
  lotes_edit: "Editar lotes propios",
  lotes_editall: "Editar todos los lotes",
  history: "Ver historial",
  history_create: "Crear carro",
  history_edit: "Editar historial",
  history_import: "Importar historial",
  history_export: "Exportar historial",
  delivered: "Carros entregados",
  pending_purchase: "Pendientes de compra",
  status: "Cambiar estado",
  asignar: "Asignar",
  sync: "Sincronizar",
  manual_import: "Importacion manual",
  review: "Revisar",
  firm: "Firmar",
  car_data: "Datos del carro",
  send_signature: "Enviar a firma",
  observe: "Observar",
  subsanate: "Subsanar",
  sign: "Marcar firmado",
  send: "Enviar",
  scan: "Escanear",
  sell_any_price: "Vender a cualquier precio",
  sell: "Pasar a ventas",
};

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
      {
        active: ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(day.key),
        start: "08:00",
        end: "18:00",
        slots: [{ start: "08:00", end: "18:00" }],
      },
    ])
  );
}
