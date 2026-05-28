"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronsUpDown, Edit3, Info, Loader2, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STATUS_OPTIONS = ["New", "Certified", "Seller", "Order", "Signed", "Billing", "Contacted", "Assigned", "Warming", "Agency Classification", "ChatBot Classification", "Rescheduled", "SalesManager", "ContactFail", "Test-Drive", "Negotiating", "OnVisit", "Quotation", "Purchase Order", "Closed Won", "Closed Lost"];
const CONTACT_PREFERENCE_OPTIONS = ["Phone", "Email", "Mobile message", "WhatsApp", "Mobile"];
const DOCUMENT_TYPE_OPTIONS = ["CPF", "CNPJ", "CUIT", "CUIL", "DNI", "RUC", "RUT", "NIT", "Identity Card", "Passport", "Foreign Card"];
const COUNTRY_OPTIONS = ["ARG", "BRA", "CHL", "COL", "PER"];
const YES_NO_OPTIONS = ["YES", "NO"];
const BOOLEAN_OPTIONS = ["true", "false"];
const TEST_DRIVE_STATUS_OPTIONS = ["Scheduled", "Cancelled", "Done"];
const TEST_DRIVE_CONDUCTED_OPTIONS = ["NO", "YES"];
const OPPORTUNITY_STAGE_OPTIONS = ["Created", "In Attendance", "Test Drive", "Quotation", "Pre-Order", "Order", "Facturada", "Billed", "Vehicle Delivered", "No Interest", "Closed Lost"];
const FACEBOOK_PLATFORM_OPTIONS = ["META"];
const FACEBOOK_SUB_PLATFORM_OPTIONS = ["FB", "IG"];
const LEAD_ORIGIN_OPTIONS = ["Manual", "Web", "Ford Credit", "Event", "Oportunidade Credit", "Smart Lab", "Compre sem sair de casa", "EcoSport - Incentivo Tabela FIPE", "Leads Enriquecidos por Parceiros", "Ford Go", "Oportunidade Ford Credit", "One Click To Lead", "Ford Go - Resgate", "Ford Digital Chile", "Dealer Digital Chile", "Manual Chile", "Event Chile", "Financial Chile", "Ford Digital Colombia", "Dealer Digital Colombia", "Ford Analog Colombia", "Dealer Analog Colombia", "Financial Colombia", "Ford Digital Peru", "Dealer Digital Peru", "Ford Analog Peru", "Dealer Analog Peru", "Financial Peru", "Distributor", "WhatsApp", "Digital Ford", "Digital"];
const LEAD_SUB_ORIGIN_OPTIONS = ["Website", "Hotsite", "Facebook", "Phone", "Showroom", "Ford Credit", "Linkedin", "Instagram", "Direct Sales Fleet", "Edge Leads Especiais", "Ford Sempre", "Agrishow", "BOT", "Test Drive Delivery", "Prospecção", "Quote Peru", "Form at Site Ford Peru", "Form at Forum Peru", "Website Peru", "Phone Peru", "Facebook Peru", "Showroom Peru", "Landing Page Peru", "Event Peru", "SMS Peru", "Website Ford Chile", "Website Chile", "Phone Chile", "Facebook Chile", "Showroom Chile", "Landing Page", "Event Chile", "Media Chile", "Form at Site Ford.cl Chile", "Form at Forum.cl Chile", "Website Colombia", "Web Page Colombia", "Phone Colombia", "Showroom Colombia", "Landing Page Colombia", "SMS Colombia", "Event + Sales Beach Colombia", "Database Colombia", "Clients Workshop Colombia", "Social Media Colombia", "Ford Call Center Telephone Event Colombia", "Form at SUFI.com.co Colombia", "Form at Ford.com.co Colombia", "Praia da grama", "VIPs Ford", "Fazenda Boa Vista", "Shopping Cidade Jardim", "Resgate", "Social Networks", "Recommended", "Expointer", "Geral", "Genérica", "Agrotins", "Bahia Farm Show", "Norte Show", "Expoingá", "Agrobrasilia", "Rondonia Rural Show", "Expoama", "Ranger Day Campo Grande", "Ranger Day Goiânia", "Ranger Day Salvador", "Ranger Day Bauru", "Event", "Transposul", "Fordi", "Bike Series", "FIPAN", "Ranger Day São José do Rio Preto", "Superminas", "Fleet", "SMS Chile", "SMS", "Chatbot", "Website Oval Plan", "Landing Page"];
const LEAD_SUB_ORIGIN2_OPTIONS = ["Organic", "Email Campaign", "Facebook Campaign", "Instagram Campaign", "Xaxis Campaign", "YouTube Campaign", "Adwords Campaign", "Red Display Campaign", "Facebook Lead Ads", "Whatsapp/SMS Campaign", "Display Campaign", "Chatbot / Chat online", "Chatbot", "Specialized Portal Campaigns", "Quote", "Test Drive", "Remote Purchase", "Facebook", "Instagram", "Twitter", "e-Agro"];
const PLAN_CODE_OPTIONS = ["EMP10", "MAFI1", "MAFI3", "PRFT2", "PRFT4", "PRXL3", "PRXL5", "RAFI1", "RAFI2", "RAFI5", "RAFI6", "TEFI2", "TEFI4"];
const FORD_CREATE_STATUS_OPTIONS = ["Assigned"];
const FORD_PATCH_STATUS_OPTIONS = ["New", "Contacted", "Closed Won", "Closed Lost"];
const FORD_DOCUMENT_TYPE_OPTIONS = ["DNI", "RUC", "RUT", "Cédula de identidad", "Pasaporte"];
const FORD_MOBILE_PHONE_TYPE_OPTIONS = ["Personal", "Casa", "Otro", "Trabajo"];
const FORD_COUNTRY_OPTIONS = ["PER"];
const FORD_ADDRESS_COUNTRY_OPTIONS = ["Unknown", "PER"];
const FORD_VEHICLE_MODEL_OPTIONS = ["Mustang Peru", "Territory Peru", "Escape Peru", "Edge Peru", "Explorer Peru", "Expedition Peru", "Ranger Peru", "F150 Peru", "Bronco Sport Peru", "Maverick Peru", "Maverick Hibrida"];
const FORD_LEAD_SOURCE_OPTIONS = {
  "Digital Dealer": ["Sitio Web", "Facebook", "Landing Page"],
  Manual: ["Telefónico", "Piso", "Evento"],
};
const FORD_ORIGIN_OPTIONS = Object.keys(FORD_LEAD_SOURCE_OPTIONS);
const FORD_SUB_ORIGIN_OPTIONS = Object.values(FORD_LEAD_SOURCE_OPTIONS).flat();

const DEFAULT_CREATE_LEAD = {
  status: "Assigned",
  contact: {
    name: "Renato Machado",
    documentType: "CPF",
    documentNumber: "84730242300",
    country: "BRA",
    email: "renatomachado@gmail.com",
    rg: "159674001",
    phone: "9926526161",
    mobilePhone: "4728332218",
    businessPhone: "6735843739",
    fax: "1637821406",
    contactPreference: "Phone",
    description: "Renato Machado",
    maritalStatus: "Married",
    personBirthdate: "1990-07-14",
    gender: "Male",
    address: {
      city: "São Paulo",
      countryCode: "BRA",
      postalCode: "5555",
      state: "SP",
      street: "Avenida Paulista",
    },
  },
  vehicle: {
    model: "Ecosport Chile",
    tma: "7BC",
    accessories: "wheel",
    vin: "3FMCR9E93PRD58746",
  },
  preferenceDealer: {
    code: "123456",
  },
  leadSource: {
    origin: "Manual",
    subOrigin: "Website",
    subOrigin2: "Organic",
  },
  testDrive: {
    product: {
      tma: "CUB",
      catalog: "XZA1",
    },
    conducted: "NO",
    date: "2023-08-01T08:00:00Z",
    periodOfDay: "Manhã",
    reasonNo: "Lost automatically",
    otherReasonNo: "Lost interest",
    status: "Scheduled",
  },
  buyingUnderSomeoneElseName: "YES",
  buyer: {
    firstName: "Carlos",
    lastName: "Francisco",
    documentType: "CPF",
    documentNumber: "13887841301",
    email: "carlos.franscisco@gmail.com",
    address: "Rua H, 320",
    zip: "60165090",
    city: "Fortaleza",
    state: "CE",
    postalCode: "12345",
    street: "123 Main St",
  },
  vehicleAsPartPayment: true,
  vehicleUsed: {
    brand: "north",
    model: "KA",
    year: "2020",
    price: 30000,
    plate: "ABC123",
  },
  billingAddress: {
    street: "Rua Norte",
    number: "366",
    complement: "casa",
    neighborhood: "Helena maria",
    city: "São Paulo",
    country: "Brasil",
    zip: "60165090",
    state: "SP",
  },
  opportunity: {
    name: "Tiago Carvalho",
    stage: "In Attendance",
    closeDate: "2023-09-26",
    quotation: {
      name: "Quote 1",
      expirationDate: "2024-01-01",
      deliveryDateNegotiated: "2023-09-01",
      paymentMethods: "Money",
      signalValue: "100.50",
      financingType: "Leasing",
      numberOfInstallments: "1000",
      valueOfInstallments: "100",
      financingTax: "123",
    },
  },
  previousContactAttempts: "1",
  catalog: "QWDS",
  purchaseDate: "2023-10-01",
  seller: {
    email: "renata@kolekto.com.br.invalid",
  },
  deliveryDate: "2023-09-20",
  eagro: {
    id: "1198792482321",
    createdDate: "2025-04-14",
  },
  facebook: {
    id: "477930011987924",
    formId: "543978538344729",
    plaform: "META",
    subPlaform: "IG",
    createdTime: "2024-12-21T00:00:00",
  },
};

const FIELD_INFO = {
  id: "Minimo de caracteres: 18. Maximo de caracteres: 18.",
  status: "Valores permitidos: New, Certified, Seller, Order, Signed, Billing, Contacted, Assigned, Warming, Agency Classification, ChatBot Classification, Rescheduled, SalesManager, ContactFail, Test-Drive, Negotiating, OnVisit, Quotation, Purchase Order, Closed Won, Closed Lost. Maximo: 255 caracteres.",
  mediaOption: "String. Maximo: 50 caracteres.",
  "contact.firstName": "String. Maximo: 40 caracteres. Ejemplo: John.",
  "contact.lastName": "String. Maximo: 80 caracteres. Ejemplo: Doe.",
  "contact.phone": "String. Maximo: 40 caracteres.",
  "contact.phoneAreaCode": "String. Maximo: 40 caracteres.",
  "contact.mobilePhone": "String. Maximo: 40 caracteres.",
  "contact.mobilePhoneType": "String. Maximo: 40 caracteres. Valores: Casa, Otros, Personal, Trabajo.",
  "contact.documentType": "Document Type. Brazil: CPF/CNPJ. Argentina: CUIT/CUIL. Chile: RUT. Colombia: NIT. Peru: DNI/RUC. Patron: ^[a-zA-Z0-9\\- ]+$. Maximo: 255 caracteres.",
  "contact.documentNumber": "String o null. Document Id Number.",
  "contact.email": "E-mail address. Maximo: 80 caracteres. Ejemplo: john.doe@ford.invalid.",
  "contact.contactPreference": "Requerido. Valores: Phone, Email, Mobile message, WhatsApp, Mobile. Maximo: 255 caracteres.",
  "contact.address": "String u objeto de direccion. Maximo de referencia: 255 caracteres.",
  "contact.company": "String. Maximo: 255 caracteres.",
  "vehicle.model": "Vehicle model. Verificar si el modelo esta disponible en el pais. Patron: ^[a-zA-ZÀ-ÿ0-9\\-.+/:_ ]*$. Maximo: 50 caracteres.",
  "vehicle.version": "String. Maximo: 255 caracteres.",
  "vehicle.tma": "String. Maximo: 50 caracteres.",
  "vehicle.seq": "String. Maximo: 50 caracteres.",
  "vehicle.accessories": "String. Maximo: 255 caracteres.",
  "preferenceDealer.code": "Requerido. Patron: ^[a-zA-Z0-9]+$. Maximo: 20 caracteres.",
  "preferenceDealer.uniqueCode": "Requerido. Identificador unico formado por codigo dealer y pais. Maximo: 20 caracteres.",
  "preferenceDealer.name": "Account Name. Maximo: 255 caracteres.",
  "leadSource.origin": "String. Patron: ^[a-zA-ZÀ-ÿ0-9\\-.+/ ]*$. Maximo: 255 caracteres.",
  "leadSource.subOrigin": "String. Patron: ^[a-zA-ZÀ-ÿ0-9\\-.+// ]*$. Maximo: 255 caracteres.",
  "leadSource.subOrigin2": "String. Patron: ^[a-zA-ZÀ-ÿ0-9\\-.+/ ]*$. Maximo: 255 caracteres.",
  campaignName: "String. Maximo: 100 caracteres.",
  "fleet.numberUnits": "String. Maximo: 255 caracteres.",
  classification: "String. Maximo: 255 caracteres.",
  preferredContactTime: "String. Maximo: 255 caracteres.",
  "plan.planCode": "String. Valores: EMP10, MAFI1, MAFI3, PRFT2, PRFT4, PRXL3, PRXL5, RAFI1, RAFI2, RAFI5, RAFI6, TEFI2, TEFI4. Maximo: 255 caracteres.",
  description: "String. Maximo: 32000 caracteres.",
  lostReason: "String. Patron: ^[a-zA-ZÀ-ÿ0-9\\-.+/ ]*$. Maximo: 255 caracteres.",
  "eagro.id": "Requerido. eAgro lead unique identification. Maximo: 250 caracteres.",
  "eagro.createdDate": "Requerido. Fecha de creacion eAgro en formato ISO-8601. Maximo: 10 caracteres.",
  modelColor: "String. Maximo: 50 caracteres.",
  colorCode: "String. Maximo: 50 caracteres.",
  "recordType.id": "Patron: ^[a-zA-Z0-9]+$. Minimo: 18. Maximo: 18.",
  "recordType.name": "Account Name. Maximo: 255 caracteres.",
  "createdBy.id": "Patron: ^[a-zA-Z0-9]+$. Minimo: 18. Maximo: 18.",
  "createdBy.name": "Account Name. Maximo: 255 caracteres.",
  "owner.id": "Patron: ^[a-zA-Z0-9]+$. Minimo: 18. Maximo: 18.",
  "owner.name": "Account Name. Maximo: 255 caracteres.",
};

const SECTIONS = [
  { title: "Lead", fields: ["status", "lastModifiedDate"] },
  { title: "Contacto", fields: ["contact.name", "contact.documentType", "contact.documentNumber", "contact.country", "contact.email", "contact.phone", "contact.mobilePhoneType", "contact.mobilePhone", "contact.contactPreference", "contact.company"] },
  { title: "Direccion contacto", fields: ["contact.address.city", "contact.address.countryCode", "contact.address.street", "contact.address.postalCode", "contact.address.state"] },
  { title: "Vehiculo", fields: ["vehicle.model", "vehicle.version", "vehicle.accessories", "vehicle.accessoriesDetails"] },
  { title: "Dealer y origen", fields: ["preferenceDealer.code", "preferenceDealer.uniqueCode", "preferenceDealer.name", "leadSource.origin", "leadSource.subOrigin"] },
];

const CREATE_SECTIONS = [
  { title: "Lead", fields: ["status", "lastModifiedDate"] },
  { title: "Contacto", fields: ["contact.name", "contact.documentType", "contact.documentNumber", "contact.country", "contact.email", "contact.phone", "contact.mobilePhoneType", "contact.mobilePhone", "contact.contactPreference", "contact.company"] },
  { title: "Direccion contacto", fields: ["contact.address.city", "contact.address.countryCode", "contact.address.street", "contact.address.postalCode", "contact.address.state"] },
  { title: "Vehiculo", fields: ["vehicle.model", "vehicle.version", "vehicle.accessories", "vehicle.accessoriesDetails"] },
  { title: "Dealer y origen", fields: ["preferenceDealer.code", "preferenceDealer.uniqueCode", "preferenceDealer.name", "leadSource.origin", "leadSource.subOrigin"] },
];

const EDIT_SECTIONS = [
  { title: "Lead", fields: ["id", "status", "lastModifiedDate", "lossReason"] },
  { title: "Contacto", fields: ["contact.firstName", "contact.lastName", "contact.documentType", "contact.documentNumber", "contact.country", "contact.email", "contact.phone", "contact.mobilePhoneType", "contact.mobilePhone", "contact.contactPreference", "contact.company"] },
  ...CREATE_SECTIONS.slice(2),
  { title: "Datos Ford bloqueados", fields: ["recordType.id", "recordType.name", "createdBy.id", "createdBy.name", "owner.id", "owner.name"] },
];

const EDITABLE_FIELDS = new Set([...CREATE_SECTIONS.flatMap((section) => section.fields), "contact.firstName", "contact.lastName", "lossReason"]);

const FIELD_LABELS = {
  id: "ID",
  status: "Estado",
  mediaOption: "Opcion de medio",
  lastModifiedDate: "Fecha de modificacion",
  campaignName: "Campania",
  classification: "Clasificacion",
  preferredContactTime: "Horario preferido",
  financingFlag: "Tiene financiamiento",
  vehicleAsPartPayment: "Vehiculo como parte de pago",
  currentVehicleExchange: "Intercambio de vehiculo actual",
  description: "Descripcion",
  lostReason: "Motivo de perdida",
  lossReason: "Motivo de perdida",
  directSales: "Venta directa",
  traditionalSales: "Venta tradicional",
  modelColor: "Color del modelo",
  colorCode: "Codigo de color",
  ackDate: "Fecha ACK",
  createdDate: "Fecha de creacion",
  previousContactAttempts: "Intentos previos de contacto",
  catalog: "Catalogo",
  purchaseDate: "Fecha de compra",
  deliveryDate: "Fecha de entrega",
  buyingUnderSomeoneElseName: "Compra a nombre de otra persona",
  "contact.name": "Nombre del contacto",
  "contact.firstName": "Nombres",
  "contact.lastName": "Apellidos",
  "contact.documentType": "Tipo de documento",
  "contact.documentNumber": "Numero de documento",
  "contact.country": "Pais",
  "contact.email": "Email",
  "contact.rg": "RG",
  "contact.phone": "Telefono",
  "contact.phoneAreaCode": "Codigo de area",
  "contact.mobilePhone": "Celular",
  "contact.mobileComplete": "Celular completo",
  "contact.mobilePhoneType": "Tipo de celular",
  "contact.businessPhone": "Telefono laboral",
  "contact.fax": "Fax",
  "contact.contactPreference": "Preferencia de contacto",
  "contact.description": "Descripcion del contacto",
  "contact.maritalStatus": "Estado civil",
  "contact.personBirthdate": "Fecha de nacimiento",
  "contact.gender": "Genero",
  "contact.agreeReceiveContact": "Acepta recibir contacto",
  "contact.address": "Direccion",
  "contact.company": "Empresa",
  "contact.address.city": "Ciudad",
  "contact.address.countryCode": "Codigo pais direccion",
  "contact.address.postalCode": "Codigo postal",
  "contact.address.state": "Estado/Region",
  "contact.address.street": "Calle",
  "vehicle.model": "Modelo",
  "vehicle.version": "Version",
  "vehicle.tma": "TMA",
  "vehicle.seq": "SEQ",
  "vehicle.accessories": "Accesorios",
  "vehicle.accessoriesDetails": "Detalle de accesorios",
  "vehicle.vin": "VIN",
  "preferenceDealer.code": "Codigo dealer",
  "preferenceDealer.uniqueCode": "Codigo unico dealer",
  "preferenceDealer.name": "Nombre dealer",
  "leadSource.origin": "Origen",
  "leadSource.subOrigin": "Suborigen",
  "leadSource.subOrigin2": "Suborigen 2",
  "fleet.form": "Formulario de flota",
  "fleet.numberUnits": "Numero de unidades",
  "plan.planCode": "Codigo de plan",
  "plan.ovaloPlan": "Plan ovalo",
  "testDrive.product.tma": "TMA producto",
  "testDrive.product.catalog": "Catalogo producto",
  "testDrive.conducted": "Test drive realizado",
  "testDrive.date": "Fecha test drive",
  "testDrive.periodOfDay": "Periodo del dia",
  "testDrive.reasonNo": "Motivo de no test drive",
  "testDrive.otherReasonNo": "Otro motivo",
  "testDrive.status": "Estado test drive",
  "buyer.firstName": "Nombres comprador",
  "buyer.lastName": "Apellidos comprador",
  "buyer.documentType": "Tipo documento comprador",
  "buyer.documentNumber": "Documento comprador",
  "buyer.email": "Email comprador",
  "buyer.address": "Direccion comprador",
  "buyer.zip": "ZIP comprador",
  "buyer.city": "Ciudad comprador",
  "buyer.state": "Estado comprador",
  "buyer.postalCode": "Codigo postal comprador",
  "buyer.street": "Calle comprador",
  "vehicleUsed.brand": "Marca usado",
  "vehicleUsed.model": "Modelo usado",
  "vehicleUsed.year": "Anio usado",
  "vehicleUsed.price": "Precio usado",
  "vehicleUsed.plate": "Placa usado",
  "billingAddress.street": "Calle facturacion",
  "billingAddress.number": "Numero facturacion",
  "billingAddress.complement": "Complemento",
  "billingAddress.neighborhood": "Barrio",
  "billingAddress.city": "Ciudad facturacion",
  "billingAddress.country": "Pais facturacion",
  "billingAddress.zip": "ZIP facturacion",
  "billingAddress.state": "Estado facturacion",
  "opportunity.name": "Nombre oportunidad",
  "opportunity.stage": "Etapa oportunidad",
  "opportunity.closeDate": "Fecha cierre",
  "opportunity.quotation.name": "Nombre cotizacion",
  "opportunity.quotation.expirationDate": "Vencimiento cotizacion",
  "opportunity.quotation.deliveryDateNegotiated": "Entrega negociada",
  "opportunity.quotation.paymentMethods": "Metodos de pago",
  "opportunity.quotation.signalValue": "Valor senial",
  "opportunity.quotation.financingType": "Tipo financiamiento",
  "opportunity.quotation.numberOfInstallments": "Numero de cuotas",
  "opportunity.quotation.valueOfInstallments": "Valor de cuotas",
  "opportunity.quotation.financingTax": "Tasa financiamiento",
  "seller.email": "Email vendedor",
  "eagro.id": "ID eAgro",
  "eagro.createdDate": "Fecha eAgro",
  "facebook.id": "ID Facebook",
  "facebook.formId": "ID formulario",
  "facebook.plaform": "Plataforma",
  "facebook.subPlaform": "Subplataforma",
  "facebook.createdTime": "Fecha Facebook",
  "recordType.id": "ID tipo registro",
  "recordType.name": "Nombre tipo registro",
  "createdBy.id": "ID creado por",
  "createdBy.name": "Nombre creado por",
  "owner.id": "ID propietario",
  "owner.name": "Nombre propietario",
};

const SELECT_OPTIONS = {
  status: STATUS_OPTIONS,
  "contact.documentType": FORD_DOCUMENT_TYPE_OPTIONS,
  "contact.country": FORD_COUNTRY_OPTIONS,
  "contact.mobilePhoneType": FORD_MOBILE_PHONE_TYPE_OPTIONS,
  "contact.contactPreference": CONTACT_PREFERENCE_OPTIONS,
  "contact.address.countryCode": FORD_ADDRESS_COUNTRY_OPTIONS,
  "vehicle.model": FORD_VEHICLE_MODEL_OPTIONS,
  "buyer.documentType": DOCUMENT_TYPE_OPTIONS,
  buyingUnderSomeoneElseName: YES_NO_OPTIONS,
  vehicleAsPartPayment: BOOLEAN_OPTIONS,
  "testDrive.conducted": TEST_DRIVE_CONDUCTED_OPTIONS,
  "testDrive.status": TEST_DRIVE_STATUS_OPTIONS,
  "opportunity.stage": OPPORTUNITY_STAGE_OPTIONS,
  "facebook.plaform": FACEBOOK_PLATFORM_OPTIONS,
  "facebook.platform": FACEBOOK_PLATFORM_OPTIONS,
  "facebook.subPlaform": FACEBOOK_SUB_PLATFORM_OPTIONS,
  "facebook.subPlatform": FACEBOOK_SUB_PLATFORM_OPTIONS,
  "leadSource.origin": FORD_ORIGIN_OPTIONS,
  "leadSource.subOrigin": FORD_SUB_ORIGIN_OPTIONS,
  "leadSource.subOrigin2": LEAD_SUB_ORIGIN2_OPTIONS,
  "plan.planCode": PLAN_CODE_OPTIONS,
};

function fieldOptions(lead, field, { isCreate = false } = {}) {
  if (field === "status") return isCreate ? FORD_CREATE_STATUS_OPTIONS : FORD_PATCH_STATUS_OPTIONS;
  if (field === "leadSource.subOrigin") {
    const origin = readPath(lead, "leadSource.origin");
    return FORD_LEAD_SOURCE_OPTIONS[origin] || FORD_SUB_ORIGIN_OPTIONS;
  }
  return SELECT_OPTIONS[field];
}

function readPath(data, path) {
  return path.split(".").reduce((acc, part) => acc?.[part], data);
}

function writePath(data, path, value) {
  const clone = structuredClone(data);
  const parts = path.split(".");
  let cursor = clone;
  for (const part of parts.slice(0, -1)) {
    cursor[part] = cursor[part] && typeof cursor[part] === "object" ? cursor[part] : {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
  return clone;
}

function cleanPayload(value) {
  if (Array.isArray(value)) return value.map(cleanPayload).filter((item) => item !== undefined);
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, cleanPayload(item)])
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (value === "") return undefined;
  return value;
}

function payloadFromSections(source, sections) {
  return sections.reduce((payload, section) => {
    section.fields.forEach((field) => {
      const value = readPath(source, field);
      if (value !== undefined) {
        payload = writePath(payload, field, value);
      }
    });
    return payload;
  }, {});
}

function buildCreatePayload(lead) {
  return cleanPayload(payloadFromSections(lead, CREATE_SECTIONS));
}

function hasChanged(current, original, path) {
  return JSON.stringify(readPath(current, path) ?? null) !== JSON.stringify(readPath(original, path) ?? null);
}

function buildPatchPayload(lead, originalLead) {
  let payload = {
    status: lead.status || "New",
    preferenceDealer: lead.preferenceDealer || {},
    lastModifiedDate: lead.lastModifiedDate || new Date().toISOString(),
  };
  if (lead.status === "Closed Lost") payload.lossReason = lead.lossReason || "";
  if (!originalLead || hasChanged(lead, originalLead, "contact")) payload.contact = lead.contact || {};
  if (!originalLead || hasChanged(lead, originalLead, "vehicle")) payload.vehicle = lead.vehicle || {};
  return cleanPayload(payload);
}

function blankLeadFromSections() {
  const lead = CREATE_SECTIONS.reduce((payload, section) => {
    section.fields.forEach((field) => {
      payload = writePath(payload, field, "");
    });
    return payload;
  }, {});
  return {
    ...lead,
    status: "Assigned",
    lastModifiedDate: new Date().toISOString(),
    contact: {
      ...(lead.contact || {}),
      country: "PER",
      mobilePhoneType: "Personal",
      contactPreference: "WhatsApp",
      address: {
        ...(lead.contact?.address || {}),
        countryCode: "Unknown",
      },
    },
    preferenceDealer: {
      ...(lead.preferenceDealer || {}),
      code: "00024",
      uniqueCode: "00024Peru",
      name: "WANKAMOTORS",
    },
    leadSource: {
      ...(lead.leadSource || {}),
      origin: "Manual",
      subOrigin: "Piso",
    },
  };
}

function parseFieldValue(field, value) {
  if (BOOLEAN_OPTIONS.includes(String(value)) && ["vehicleAsPartPayment", "financingFlag", "directSales", "traditionalSales"].includes(field)) return value === "true";
  if (field === "vehicleUsed.price") {
    const number = Number(value);
    return Number.isFinite(number) ? number : "";
  }
  return value;
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (Array.isArray(value)) return value.length ? value.map((item) => item?.name || JSON.stringify(item)).join(", ") : "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.detail ? ` ${JSON.stringify(payload.detail)}` : "";
    throw new Error(`${payload?.message || "No se pudo cargar el lead."}${detail}`);
  }
  return payload;
}

export default function FordLeadDetailPage({ id = "nuevo", mode = "view" }) {
  const isCreate = mode === "create";
  const [lead, setLead] = useState(isCreate ? blankLeadFromSections() : null);
  const [originalLead, setOriginalLead] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [opportunityOptions, setOpportunityOptions] = useState([]);
  const [opportunityLoading, setOpportunityLoading] = useState(isCreate);
  const [createDrafts, setCreateDrafts] = useState([]);
  const [savingOpportunityId, setSavingOpportunityId] = useState(null);

  useEffect(() => {
    if (isCreate) return;
    let cancelled = false;
    fetch(`/api/ford-leads/${encodeURIComponent(id)}`)
      .then(readJson)
      .then((data) => {
        if (!cancelled) {
          setLead(data);
          setOriginalLead(data);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isCreate]);

  const loadPendingOpportunities = useCallback(async ({ cancelled = () => false } = {}) => {
    setOpportunityLoading(true);
    setOpportunityOptions([]);
    fetch("/api/ford-leads?pendingOpportunities=1")
      .then(readJson)
      .then((data) => {
        if (!cancelled()) {
          const sentDraftIds = new Set(createDrafts.filter((draft) => draft.saved).map((draft) => draft.oportunidadId));
          setOpportunityOptions((Array.isArray(data?.items) ? data.items : []).filter((item) => !sentDraftIds.has(item.oportunidadId)));
        }
      })
      .catch((err) => {
        if (!cancelled()) setError(err.message);
      })
      .finally(() => {
        if (!cancelled()) setOpportunityLoading(false);
      });
  }, [createDrafts]);

  useEffect(() => {
    if (!isCreate) return;
    let cancelled = false;
    Promise.resolve().then(() => loadPendingOpportunities({ cancelled: () => cancelled }));
    return () => {
      cancelled = true;
    };
  }, [isCreate, loadPendingOpportunities]);

  const title = useMemo(() => isCreate ? "Agregar Lead" : lead?.id || id, [id, isCreate, lead?.id]);

  function toggleOpportunity(option) {
    setMessage("");
    setError("");
    setCreateDrafts((current) => {
      if (current.some((item) => item.oportunidadId === option.oportunidadId)) {
        return current.filter((item) => item.oportunidadId !== option.oportunidadId);
      }
      return [...current, { ...option, lead: option.payload || blankLeadFromSections(), saved: false, token: "" }];
    });
  }

  function updateDraft(oportunidadId, field, nextValue) {
    setCreateDrafts((current) => current.map((item) => {
      if (item.oportunidadId !== oportunidadId) return item;
      let nextLead = writePath(item.lead, field, parseFieldValue(field, nextValue));
      if (field === "leadSource.origin") {
        const allowed = FORD_LEAD_SOURCE_OPTIONS[nextValue] || [];
        if (!allowed.includes(readPath(nextLead, "leadSource.subOrigin"))) nextLead = writePath(nextLead, "leadSource.subOrigin", allowed[0] || "");
      }
      return { ...item, lead: nextLead };
    }));
  }

  async function submitOpportunityLead(item) {
    setSavingOpportunityId(item.oportunidadId);
    setError("");
    setMessage("");
    try {
      const payload = { ...buildCreatePayload(item.lead), oportunidadId: item.oportunidadId };
      const response = await fetch("/api/ford-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);
      setCreateDrafts((current) => current.filter((draft) => draft.oportunidadId !== item.oportunidadId));
      setOpportunityOptions((current) => current.filter((option) => option.oportunidadId !== item.oportunidadId));
      setMessage(data?.message || `Lead enviado a Ford${data?.recordId ? `: ${data.recordId}` : "."}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingOpportunityId(null);
    }
  }

  async function updateLead() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = buildPatchPayload(lead, originalLead);
      const response = await fetch(`/api/ford-leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);
      setMessage(data?.message || "Lead actualizado en Ford.");
      setEditing(false);
      setOriginalLead(lead);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setLead(originalLead);
    setEditing(false);
    setError("");
    setMessage("");
  }

  return (
    <TooltipProvider>
      <div className="space-y-4 text-black">
        <div className="flex items-center gap-3">
          <Link href="/leads-ford" className="inline-flex size-8 items-center justify-center rounded-md border bg-white hover:bg-slate-50">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-black">{isCreate ? "Agregar Lead Ford" : editing ? "Editar Lead Ford" : "Detalle Lead Ford"}</h1>
            <p className="text-sm text-black">{title}</p>
          </div>
          {isCreate ? null : lead && editing ? (
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                <X className="mr-2 size-4" />
                Cancelar
              </Button>
              <Button onClick={updateLead} disabled={saving}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Actualizar Lead
              </Button>
            </div>
          ) : lead ? (
            <Button className="ml-auto" onClick={() => setEditing(true)}>
              <Edit3 className="mr-2 size-4" />
              Editar
            </Button>
          ) : null}
        </div>

        {loading ? <div className="rounded-lg bg-white p-6 text-sm font-semibold"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando detalle...</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
        {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div> : null}

        {isCreate ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="relative">
              <Button type="button" variant="outline" className="h-9 w-full justify-between text-xs font-semibold" onClick={() => {
                const nextOpen = !opportunityOpen;
                setOpportunityOpen(nextOpen);
                if (nextOpen) loadPendingOpportunities();
              }}>
                {opportunityLoading ? "Cargando oportunidades..." : `Seleccionar oportunidades pendientes (${opportunityOptions.length})`}
                <ChevronsUpDown className="size-4 opacity-60" />
              </Button>
              {opportunityOpen ? (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                  {opportunityOptions.length ? opportunityOptions.map((option) => {
                    const selected = createDrafts.some((item) => item.oportunidadId === option.oportunidadId);
                    return (
                      <button
                        key={option.oportunidadId}
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-semibold text-black hover:bg-slate-100"
                        onClick={() => toggleOpportunity(option)}
                      >
                        <span className="inline-flex size-4 items-center justify-center rounded border border-slate-300">
                          {selected ? <Check className="size-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{option.oportunidadTexto}</span>
                      </button>
                    );
                  }) : (
                    <div className="px-2 py-6 text-center text-xs font-semibold text-slate-500">
                      {opportunityLoading ? "Cargando..." : "No hay oportunidades pendientes."}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="mt-3 space-y-3">
              {createDrafts.length ? createDrafts.map((item) => (
                <section key={item.oportunidadId} className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-red-600">Oportunidad: {item.oportunidadTexto}</p>
                    {item.saved ? <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Guardado {item.token}</span> : null}
                    <Button size="sm" onClick={() => submitOpportunityLead(item)} disabled={item.saved || savingOpportunityId === item.oportunidadId}>
                      {savingOpportunityId === item.oportunidadId ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                      Guardar
                    </Button>
                  </div>
                  <div className="grid gap-x-3 gap-y-2 md:grid-cols-2 xl:grid-cols-4">
                    {CREATE_SECTIONS.map((section) => (
                      <div key={section.title} className="contents">
                        <h2 className="col-span-full mt-1 border-t border-slate-200 pt-2 text-xs font-bold text-black first:mt-0 first:border-t-0 first:pt-0">{section.title}</h2>
                        <div className="contents">
                          {section.fields.map((field) => (
                            <DetailField
                              key={field}
                              lead={item.lead}
                              field={field}
                              isCreate
                              editable={!item.saved}
                              onChange={(nextValue) => updateDraft(item.oportunidadId, field, nextValue)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )) : (
                <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-xs font-semibold text-slate-500">
                  Selecciona una o varias oportunidades para cargar sus datos y enviarlas a Ford.
                </div>
              )}
            </div>
          </div>
        ) : lead ? (
          <>
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="grid gap-3 xl:grid-cols-2">
              {(isCreate ? CREATE_SECTIONS : editing ? EDIT_SECTIONS : SECTIONS).map((section) => (
                <section key={section.title} className="rounded-md border border-slate-200 bg-white p-3">
                  <h2 className="mb-2 text-sm font-bold text-black">{section.title}</h2>
                  <div className="grid gap-2 md:grid-cols-2">
                    {section.fields.map((field) => <DetailField key={field} lead={lead} field={field} isCreate={isCreate} editable={isCreate || (editing && EDITABLE_FIELDS.has(field))} locked={editing && !EDITABLE_FIELDS.has(field)} onChange={(nextValue) => setLead((current) => {
                      let next = writePath(current, field, parseFieldValue(field, nextValue));
                      if (field === "leadSource.origin") {
                        const allowed = FORD_LEAD_SOURCE_OPTIONS[nextValue] || [];
                        if (!allowed.includes(readPath(next, "leadSource.subOrigin"))) next = writePath(next, "leadSource.subOrigin", allowed[0] || "");
                      }
                      return next;
                    })} />)}
                  </div>
                </section>
              ))}
              </div>
            </div>

          </>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function DetailField({ lead, field, isCreate = false, editable = false, locked = false, onChange }) {
  const value = readPath(lead, field);
  const info = FIELD_INFO[field];
  const options = fieldOptions(lead, field, { isCreate });

  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex items-center gap-1">
        <span className="truncate text-[10px] font-bold uppercase text-black">{FIELD_LABELS[field] || field}</span>
        {locked ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Bloqueado</span> : null}
        {info ? (
          <Tooltip>
            <TooltipTrigger className="inline-flex size-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
              <Info className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm whitespace-normal bg-slate-950 text-white">
              {info}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {options ? (
        <Select value={value === undefined || value === null ? "" : String(value)} onValueChange={(nextValue) => editable && onChange?.(nextValue)} disabled={!editable}>
          <SelectTrigger className="h-8 w-full bg-white text-xs text-black">
            <SelectValue placeholder="-" />
          </SelectTrigger>
          <SelectContent>
            {(value && !options.includes(String(value)) ? [String(value), ...options] : options).map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        editable ? (
          field === "description" || field.endsWith(".description") ? (
            <Textarea className="min-h-16 bg-white text-xs text-black" value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} />
          ) : (
            <Input className="h-8 bg-white text-xs text-black" value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} />
          )
        ) : (
          <div className="min-h-8 break-words rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-black">{displayValue(value)}</div>
        )
      )}
    </div>
  );
}
