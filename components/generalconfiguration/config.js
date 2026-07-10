import {
  Banknote,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Factory,
  HandCoins,
  Link,
  MapPin,
  MessageSquareText,
  Package,
  ShieldCheck,
} from "lucide-react";

export const configurationTabs = [
  {
    id: "centros",
    label: "Centros",
    icon: Building2,
    perm: ["configuracion_centros", "view"],
    actions: {
      create: ["configuracion_centros", "create"],
      edit: ["configuracion_centros", "edit"],
      delete: ["configuracion_centros", "delete"],
    },
  },
  {
    id: "talleres",
    label: "Talleres / Mostradores",
    icon: Factory,
    perms: [
      ["configuracion_talleres", "view"],
      ["configuracion_mostradores", "view"],
    ],
    actions: {
      createTaller: ["configuracion_talleres", "create"],
      editTaller: ["configuracion_talleres", "edit"],
      deleteTaller: ["configuracion_talleres", "delete"],
      createMostrador: ["configuracion_mostradores", "create"],
      editMostrador: ["configuracion_mostradores", "edit"],
      deleteMostrador: ["configuracion_mostradores", "delete"],
    },
  },
  {
    id: "motivos",
    label: "Motivos",
    icon: MessageSquareText,
    perms: [
      ["configuracion_motivos_citas", "view"],
      ["configuracion_submotivos_citas", "view"],
    ],
    actions: {
      createMotivo: ["configuracion_motivos_citas", "create"],
      editMotivo: ["configuracion_motivos_citas", "edit"],
      deleteMotivo: ["configuracion_motivos_citas", "delete"],
      createSubmotivo: ["configuracion_submotivos_citas", "create"],
      editSubmotivo: ["configuracion_submotivos_citas", "edit"],
      deleteSubmotivo: ["configuracion_submotivos_citas", "delete"],
    },
  },
  {
    id: "origenes",
    label: "Origenes",
    icon: MapPin,
    perm: ["configuracion_origenes_citas", "view"],
    actions: {
      create: ["configuracion_origenes_citas", "create"],
      edit: ["configuracion_origenes_citas", "edit"],
      delete: ["configuracion_origenes_citas", "delete"],
    },
  },
  {
    id: "sub-origenes",
    label: "Sub Origenes",
    icon: MapPin,
    perm: ["configuracion_suborigenes_citas", "view"],
    actions: {
      create: ["configuracion_suborigenes_citas", "create"],
      edit: ["configuracion_suborigenes_citas", "edit"],
      delete: ["configuracion_suborigenes_citas", "delete"],
    },
  },
  {
    id: "mano-obra",
    label: "Mano de Obra",
    icon: HandCoins,
    perm: ["configuracion_tarifas_mano_obra", "view"],
    tariffType: "mano_obra",
    actions: {
      create: ["configuracion_tarifas_mano_obra", "create"],
      edit: ["configuracion_tarifas_mano_obra", "edit"],
      delete: ["configuracion_tarifas_mano_obra", "delete"],
    },
  },
  {
    id: "panos",
    label: "Panos",
    icon: Package,
    perm: ["configuracion_tarifas_panos", "view"],
    tariffType: "panos",
    actions: {
      create: ["configuracion_tarifas_panos", "create"],
      edit: ["configuracion_tarifas_panos", "edit"],
      delete: ["configuracion_tarifas_panos", "delete"],
    },
  },
  {
    id: "moneda",
    label: "Moneda",
    icon: CircleDollarSign,
    perms: [
      ["configuracion_monedas", "view"],
      ["configuracion_impuestos", "view"],
    ],
    actions: {
      create: ["configuracion_monedas", "create"],
      edit: ["configuracion_monedas", "edit"],
      delete: ["configuracion_monedas", "delete"],
      createImpuesto: ["configuracion_impuestos", "create"],
      editImpuesto: ["configuracion_impuestos", "edit"],
      deleteImpuesto: ["configuracion_impuestos", "delete"],
    },
  },
  {
    id: "links",
    label: "Links",
    icon: Link,
    perm: ["configuracion_links", "view"],
    actions: {
      create: ["configuracion_links", "create"],
      edit: ["configuracion_links", "edit"],
      delete: ["configuracion_links", "delete"],
    },
  },
  {
    id: "roles",
    label: "Roles",
    icon: ShieldCheck,
    perm: ["configuracion_roles", "view"],
    actions: {
      create: ["configuracion_roles", "create"],
    },
  },
  {
    id: "perfiles-permisos",
    label: "Perfiles permisos",
    icon: ShieldCheck,
    perm: ["configuracion_perfiles_permisos", "view"],
    actions: {
      create: ["configuracion_perfiles_permisos", "create"],
      edit: ["configuracion_perfiles_permisos", "edit"],
      delete: ["configuracion_perfiles_permisos", "delete"],
    },
  },
];

export const statItems = [
  { key: "total", label: "Total", icon: Building2, tone: "blue" },
  { key: "activos", label: "Activas", icon: MessageSquareText, tone: "green" },
  { key: "inactivos", label: "Inactivas", icon: Banknote, tone: "slate" },
  { key: "promedio", label: "Promedio", icon: CalendarClock, tone: "orange" },
];
