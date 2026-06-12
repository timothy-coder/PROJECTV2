"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const identificationOptions = [
  { value: "DNI", label: "DNI" },
  { value: "RUC", label: "RUC" },
  { value: "PASAPORTE", label: "Pasaporte" },
];

function emptyClient() {
  return {
    idLead: "",
    nombre: "",
    apellido: "",
    email: "",
    celular: "",
    tipoIdentificacion: "DNI",
    identificacionFiscal: "",
    fechaNacimiento: "",
    ocupacion: "",
    domicilio: "",
    departamentoId: "",
    provinciaId: "",
    distritoId: "",
    nombreConyugue: "",
    dniConyugue: "",
    nombreComercial: "",
    createdBy: "",
  };
}

function formFromClient(client) {
  if (!client) return emptyClient();
  return {
    idLead: client.idLead || "",
    nombre: client.nombre || "",
    apellido: client.apellido || "",
    email: client.email || "",
    celular: normalizePhone(client.celular || ""),
    tipoIdentificacion: client.tipoIdentificacion || "DNI",
    identificacionFiscal: client.identificacionFiscal || "",
    fechaNacimiento: client.fechaNacimiento ? String(client.fechaNacimiento).slice(0, 10) : "",
    ocupacion: client.ocupacion || "",
    domicilio: client.domicilio || "",
    departamentoId: client.departamentoId || "",
    provinciaId: client.provinciaId || "",
    distritoId: client.distritoId || "",
    nombreConyugue: client.nombreConyugue || "",
    dniConyugue: client.dniConyugue || "",
    nombreComercial: client.nombreComercial || "",
    createdBy: client.createdBy || "",
  };
}

export function ClientDialog({ open, mode, client, options, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <ClientDialogBody
      key={`${mode || "closed"}-${client?.id || "new"}`}
      open={open}
      mode={mode}
      client={client}
      options={options}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function ClientDialogBody({ mode, client, options, onClose, onSubmit }) {
  const [form, setForm] = useState(formFromClient(client));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  function updateDocumentType(value) {
    setForm((current) => ({
      ...current,
      tipoIdentificacion: value,
      identificacionFiscal: normalizeDocument(current.identificacionFiscal, value),
      nombreComercial: value === "RUC" ? current.nombreComercial : "",
    }));
  }
  function updateDocument(value) {
    setForm((current) => ({
      ...current,
      identificacionFiscal: normalizeDocument(value, current.tipoIdentificacion),
    }));
  }
  function updatePhone(value) {
    updateField("celular", normalizePhone(value));
  }
  const departamentoOptions = (options?.departamentos || []).map((item) => ({
    value: item.id,
    label: item.nombre,
  }));
  const provinciaOptions = (options?.provincias || [])
    .filter((item) => !form.departamentoId || Number(form.departamentoId) === item.departamentoId)
    .map((item) => ({ value: item.id, label: item.nombre }));
  const distritoOptions = (options?.distritos || [])
    .filter((item) => !form.provinciaId || Number(form.provinciaId) === item.provinciaId)
    .map((item) => ({ value: item.id, label: item.nombre }));
  const userOptions = (options?.users || []).map((item) => ({
    value: item.id,
    label: item.name,
  }));

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!form.apellido.trim()) {
      setError("El apellido es obligatorio.");
      return;
    }
    if (!form.celular.trim()) {
      setError("El celular es obligatorio.");
      return;
    }
    if (form.celular.length !== 9) {
      setError("El celular debe tener 9 digitos.");
      return;
    }
    if (!form.email.trim()) {
      setError("El email es obligatorio.");
      return;
    }
    if (!isValidEmail(form.email)) {
      setError("Ingresa un email valido.");
      return;
    }
    const documentError = validateDocument(form.tipoIdentificacion, form.identificacionFiscal);
    if (documentError) {
      setError(documentError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit({
        ...form,
        email: form.email.trim(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        identificacionFiscal: form.identificacionFiscal.trim(),
        celular: `+51${form.celular}`,
      });
      onClose();
    } catch (err) {
      const message = err.message || "No se pudo guardar el cliente.";
      setError(message);
      toast.error("No se pudo guardar el cliente", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(96vw,760px)] overflow-hidden rounded-lg p-0 text-slate-950 sm:max-w-[760px]">
        <form onSubmit={handleSubmit} className="flex max-h-[94svh] min-h-0 flex-col">
          <DialogHeader className="border-b border-slate-200 px-4 py-3">
            <DialogTitle className="text-lg font-bold text-violet-700">
              {mode === "edit" ? "Editar cliente" : "Nuevo cliente"}
            </DialogTitle>
            <DialogDescription>Complete los datos del cliente</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nombre *" value={form.nombre} onChange={(value) => updateField("nombre", value)} />
              <Field label="Apellido *" value={form.apellido} onChange={(value) => updateField("apellido", value)} />
              <Field label="ID Lead" value={form.idLead} onChange={(value) => updateField("idLead", value)} placeholder="Ej: LD-2026-001" />
              <Field label="Celular *" inputMode="numeric" maxLength={9} value={form.celular} onChange={updatePhone} placeholder="999999999" />
              <Field type="email" label="Email *" value={form.email} onChange={(value) => updateField("email", value)} />
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <SearchableSelect
                  value={form.tipoIdentificacion}
                  options={identificationOptions}
                  placeholder="Selecciona tipo"
                  searchPlaceholder="Buscar tipo..."
                  onChange={updateDocumentType}
                />
              </div>
              <Field
                label="Numero de documento *"
                value={form.identificacionFiscal}
                onChange={updateDocument}
                inputMode={form.tipoIdentificacion === "PASAPORTE" ? "text" : "numeric"}
                maxLength={documentMaxLength(form.tipoIdentificacion)}
                placeholder={documentPlaceholder(form.tipoIdentificacion)}
              />
              {form.tipoIdentificacion === "RUC" ? (
                <Field label="Nombre comercial" value={form.nombreComercial} onChange={(value) => updateField("nombreComercial", value)} />
              ) : null}
              {mode === "edit" ? (
                <div className="space-y-2">
                  <Label>Propietario</Label>
                  <SearchableSelect
                    value={form.createdBy}
                    options={userOptions}
                    placeholder="Selecciona propietario"
                    searchPlaceholder="Buscar usuario..."
                    emptyText="Sin usuarios"
                    onChange={(value) => updateField("createdBy", value)}
                  />
                </div>
              ) : null}
              <Field type="date" label="Fecha nacimiento" value={form.fechaNacimiento} onChange={(value) => updateField("fechaNacimiento", value)} />
              <Field label="Ocupacion" value={form.ocupacion} onChange={(value) => updateField("ocupacion", value)} />
              <Field label="Nombre conyugue" value={form.nombreConyugue} onChange={(value) => updateField("nombreConyugue", value)} />
              <Field label="DNI conyugue" value={form.dniConyugue} onChange={(value) => updateField("dniConyugue", value)} />
              <div className="space-y-2">
                <Label>Departamento</Label>
                <SearchableSelect
                  value={form.departamentoId}
                  options={departamentoOptions}
                  placeholder="Selecciona departamento"
                  searchPlaceholder="Buscar departamento..."
                  emptyText="Sin departamentos"
                  onChange={(value) => {
                    updateField("departamentoId", value);
                    updateField("provinciaId", "");
                    updateField("distritoId", "");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Provincia</Label>
                <SearchableSelect
                  value={form.provinciaId}
                  options={provinciaOptions}
                  placeholder="Selecciona provincia"
                  searchPlaceholder="Buscar provincia..."
                  emptyText="Sin provincias"
                  disabled={!form.departamentoId}
                  onChange={(value) => {
                    updateField("provinciaId", value);
                    updateField("distritoId", "");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Distrito</Label>
                <SearchableSelect
                  value={form.distritoId}
                  options={distritoOptions}
                  placeholder="Selecciona distrito"
                  searchPlaceholder="Buscar distrito..."
                  emptyText="Sin distritos"
                  disabled={!form.provinciaId}
                  onChange={(value) => updateField("distritoId", value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Domicilio</Label>
                <Textarea value={form.domicilio} onChange={(event) => updateField("domicilio", event.target.value)} className="bg-white" />
              </div>
            </div>
          </div>

          {error ? <p className="mx-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}

          <DialogFooter className="border-t border-slate-200 px-4 py-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text", inputMode, maxLength, placeholder }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value || ""}
        inputMode={inputMode}
        maxLength={maxLength || undefined}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 bg-white"
      />
    </div>
  );
}

function documentMaxLength(type) {
  if (type === "DNI") return 8;
  if (type === "RUC") return 11;
  return undefined;
}

function documentPlaceholder(type) {
  if (type === "DNI") return "8 digitos";
  if (type === "RUC") return "11 digitos";
  return "Numero de documento";
}

function normalizeDocument(value, type) {
  const clean = type === "PASAPORTE" ? String(value || "") : String(value || "").replace(/\D/g, "");
  const max = documentMaxLength(type);
  return max ? clean.slice(0, max) : clean;
}

function validateDocument(type, value) {
  const clean = String(value || "").trim();
  if (!clean) return "El numero de documento es obligatorio.";
  if (type === "DNI" && clean.length !== 8) return "El DNI debe tener 8 digitos.";
  if (type === "RUC" && clean.length !== 11) return "El RUC debe tener 11 digitos.";
  return "";
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const withoutCountry = digits.startsWith("51") && digits.length > 9 ? digits.slice(2) : digits;
  return withoutCountry.slice(0, 9);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}
