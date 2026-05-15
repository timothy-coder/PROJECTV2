import {
  Users, DollarSign, UserRound, Package, Boxes, Settings, Car,
  CalendarCheck, ClipboardList, Receipt, SquareDashedMousePointer, FileText, Home, Wrench, Coins, Calendar, MessageCircle, ShoppingCart, BookOpen, SlidersHorizontal,
  CalendarDays, CalendarRange, TableProperties
} from "lucide-react";
export const HOME_ITEM = { to: "/home", label: "Panel de Control", icon: Home, perm: ["home", "view"] };
const GENERAL_CONFIGURATION_PERMS = [
  ["configuracion", "view"],
  ["configuracion_centros", "view"],
  ["configuracion_talleres", "view"],
  ["configuracion_mostradores", "view"],
  ["configuracion_motivos_citas", "view"],
  ["configuracion_submotivos_citas", "view"],
  ["configuracion_origenes_citas", "view"],
  ["configuracion_suborigenes_citas", "view"],
  ["configuracion_monedas", "view"],
  ["configuracion_impuestos", "view"],
  ["configuracion_tarifas_mano_obra", "view"],
  ["configuracion_tarifas_panos", "view"],
  ["configuracion_frecuencia", "view"],
];
const BRANDS_MODELS_PERMS = [
  ["marcas", "view"],
  ["modelos", "view"],
  ["clases", "view"],
  ["algoritmo_visita", "view"],
];

export const NAV_TREE = [
  {
    key: "admin",
    label: "Administración General",
    items: [
      { to: "/users", label: "Usuarios", icon: Users, perm: ["usuarios", "view"] },
      { to: "/clients", label: "Clientes", icon: UserRound, perm: ["clientes", "view"] },
      { to: "/brandsmodels", label: "Marcas & Modelos", icon: Car, perms: BRANDS_MODELS_PERMS },
    ],
  },
  {
    key: "ppventa",
    label: "Inventario PosVenta",
    items: [
      { to: "/combomantenimiento", label: "Mantenimiento", icon: Wrench, perms: [["combomantenimiento", "view"], ["submantenimiento", "view"]] },
      { to: "/precios", label: "Precios", icon: Coins, perm: ["precios", "view"] },
      { to: "/inventario", label: "Inventario", icon: Package, perm: ["inventario", "view"] },

    ],
  },
  {
    key: "pventa",
    label: "Inventario Venta",
    items: [
      { to: "/carros", label: "Precios de Carros", icon: DollarSign, perm: ["inventariocarros", "view"] },
      { to: "/accesorios", label: "Accesorios", icon: Boxes, perm: ["accesoriosventa", "view"] },
      { to: "/regalos", label: "Regalos", icon: Boxes, perm: ["regalosventa", "view"] },
      { to: "/ventas/catalogo", label: "Catálogo", icon: BookOpen, perm: ["catalogoventa", "view"] },
    ],
  },
  {
    key: "citas",
    label: "PosVenta",
    items: [
      { to: "/panelpostventa", label: "Panel de PosVenta", icon: Calendar, perm: ["oportunidadespv", "view"] },
      { to: "/proximosmantenimientos", label: "Proximos mantenimientos", icon: CalendarCheck, perm: ["oportunidadespv", "view"] },
      { to: "/citas", label: "Citas", icon: Calendar, perm: ["citas", "view"] },
      { to: "/recepcion", label: "Recepción", icon: CalendarCheck, perm: ["recepcion", "view"] },
      { to: "/oportunidadespv", label: "Oportunidades", icon: Calendar, perm: ["oportunidadespv", "view"] },
      { to: "/leadspv", label: "Leads", icon: Calendar, perm: ["leadspv", "view"] },
      { to: "/cotizacion", label: "Cotizacion", icon: Receipt, perm: ["cotizacion", "view"] }
      
    ],
  },
  {
    key: "agenda",
    label: "Ventas",
    items: [
      { to: "/paneloportunidad", label: "Panel de Ventas ", icon: Calendar, perm: ["agenda", "view"] },
      { to: "/agenda", label: "Agenda", icon: Calendar, perm: ["agenda", "view"] },
      { to: "/oportunidades", label: "Oportunidades", icon: CalendarDays, perm: ["oportunidades", "view"] },
      { to: "/leads", label: "Leads", icon: CalendarRange, perm: ["leads", "view"]},
      { to: "/reservas", label: "Reservas", icon: Calendar, perm: ["reservas", "view"] },
    ],
  },
  {
    key: "mensajes",
    label: "Mensajes",
    items: [
      { to: "/mensajes", label: "Mensajes", icon: MessageCircle, perm: ["mensajes", "view"] },
      { to: "/followups", label: "Follow-up 3-3-3", icon: MessageCircle, perm: ["mensajes", "view"] },
      { to: "/enviosmasivos", label: "Envíos masivos", icon: MessageCircle, perm: ["mensajes", "view"] },
      { to: "/ventas/leads", label: "Leads Capturados", icon: ShoppingCart, perm: ["mensajes", "view"] },
    ],
  },
  {
    key: "pyp",
    label: "Planchado y Pintura",
    items: [
      { to: "/ordenes/pyp", label: "OT´s", icon: ClipboardList, perm: ["ordenespv", "view"] },
      { to: "/cotizacion/pyp", label: "Cotización", icon: Receipt, perm: ["ordenespv", "view"] },
      { to: "/picaje/pyp", label: "Picaje", icon: SquareDashedMousePointer, perm: ["ordenespv", "view"] },
    ],
  },
  {
    key: "general",
    label: "Taller",
    items: [
      { to: "/ordenes/taller", label: "OT´s", icon: ClipboardList, perm: ["tallerpv", "view"] },
      { to: "/cotizacion/taller", label: "Cotización", icon: Receipt, perm: ["tallerpv", "view"] },
      { to: "/picaje/taller", label: "Picaje", icon: SquareDashedMousePointer, perm: ["tallerpv", "view"] },
    ],
  },
  {
    key: "comercial",
    label: "Reportes",
    items: [
      { to: "/reportes", label: "Reportes", icon: FileText, perm: ["reportes", "view"] },
      { to: "/sistema-logistico", label: "Sistema Logistico", icon: TableProperties, perm: ["sistema_logistico", "view"] },
    ],
  },
  {
    key: "configuracion",
    label: "Configuración",
    items: [
      { to: "/generalconfiguration", label: "Configuración", icon: Settings, perms: GENERAL_CONFIGURATION_PERMS },
      { to: "/prospeccion", label: "Auto prospección", icon: Settings, perm: ["prospeccion", "view"] },
      { to: "/configagenda", label: "Configuración de Ventas", icon: Settings, perm: ["configagenda", "view"] },
      { to: "/configpostventa", label: "Configuración de PosVenta", icon: Settings, perm: ["configcotizacion", "view"] },
      { to: "/configinventario", label: "Configuración de Inventario", icon: Settings, perm: ["configinventario", "view"] },
      { to: "/ventas/configuracion", label: "Configuración del agente", icon: SlidersHorizontal, perm: ["mensajes", "view"] },
      { to: "/alertas-config", label: "Alertas IA", icon: SlidersHorizontal, perm: ["mensajes", "view"] },
      { to: "/roles-chatwoot", label: "Roles ↔ Chatwoot", icon: SlidersHorizontal, perm: ["configuracion", "view"] },
      
    ],
  }
];
