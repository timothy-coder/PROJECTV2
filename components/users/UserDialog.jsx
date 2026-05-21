"use client";

import { useMemo, useState } from "react";
import { Clock3, LockKeyhole, Loader2, MapPin, UserRound } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { USER_PERMISSION_GROUPS, WORK_DAYS, defaultWorkSchedule } from "@/components/users/config";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

const tabs = [
  { id: "general", label: "General", icon: UserRound },
  { id: "schedule", label: "Horario", icon: Clock3 },
  { id: "permissions", label: "Permisos", icon: LockKeyhole },
  { id: "sites", label: "Sitios", icon: MapPin },
];

const permissionActionLabels = {
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  viewall: "Ver todo",
  vehicles: "Ver vehiculos",
  history: "Ver historial",
  history_create: "Crear carro",
  pending_purchase: "Pendientes de compra",
  status: "Cambiar estado",
  asignar: "Asignar",
  notify: "Notificar",
  firm: "Firmar",
  car_data: "Datos del carro",
  send_signature: "Enviar a firma",
  observe: "Observar",
  subsanate: "Subsanar",
  sign: "Marcar firmado",
};

function emptyForm() {
  return {
    roleId: "",
    fullname: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    isActive: true,
    permissions: {},
    workSchedule: defaultWorkSchedule(),
    color: "#5e17eb",
    centroIds: [],
    tallerIds: [],
    mostradorIds: [],
  };
}

function formFromUser(user) {
  if (!user) return emptyForm();

  return {
    roleId: user.roleId ? String(user.roleId) : "",
    fullname: user.fullname || "",
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    password: "",
    confirmPassword: "",
    isActive: user.isActive,
    permissions: user.permissions || {},
    workSchedule: { ...defaultWorkSchedule(), ...(user.workSchedule || {}) },
    color: user.color || "#5e17eb",
    centroIds: user.centroIds || [],
    tallerIds: user.tallerIds || [],
    mostradorIds: user.mostradorIds || [],
  };
}

function toggleArray(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function UserDialog({ open, mode, user, options, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <UserDialogContent
      key={`${mode}-${user?.id || "new"}`}
      mode={mode}
      user={user}
      options={options}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function UserDialogContent({ mode, user, options, onClose, onSubmit }) {
  const [activeTab, setActiveTab] = useState("general");
  const [form, setForm] = useState(formFromUser(user));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const roleOptions = useMemo(
    () => options.roles.map((role) => ({ value: role.id, label: role.name })),
    [options.roles]
  );

  const readonly = mode === "view";
  const title = mode === "view" ? "Detalle de usuario" : mode === "edit" ? "Editar usuario" : "Nuevo usuario";

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function togglePermission(module, action) {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [module]: {
          ...(current.permissions[module] || {}),
          [action]: !current.permissions[module]?.[action],
        },
      },
    }));
  }

  function updateSchedule(day, field, value) {
    setForm((current) => ({
      ...current,
      workSchedule: {
        ...current.workSchedule,
        [day]: {
          ...(current.workSchedule[day] || {}),
          [field]: value,
        },
      },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.fullname.trim() || !form.username.trim()) {
      setError("Nombre completo y usuario son obligatorios.");
      setActiveTab("general");
      return;
    }

    if (mode === "create" && !form.password) {
      setError("La contrasena es obligatoria para usuarios nuevos.");
      setActiveTab("general");
      return;
    }

    if (form.password && form.password !== form.confirmPassword) {
      setError("Las contrasenas no coinciden.");
      setActiveTab("general");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (readonly) return;

      await onSubmit({
        roleId: form.roleId ? Number(form.roleId) : null,
        fullname: form.fullname,
        username: form.username,
        email: form.email,
        phone: form.phone,
        password: form.password,
        isActive: form.isActive,
        permissions: form.permissions,
        workSchedule: form.workSchedule,
        color: form.color,
        centroIds: form.centroIds,
        tallerIds: form.tallerIds,
        mostradorIds: form.mostradorIds,
      });

      onClose();
    } catch (err) {
      setError(err?.message || "No se pudo guardar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      {/* ✅ SOLO altura fija (para que no cambie por tab). Ancho se queda igual y responsive */}
      <DialogContent className="h-[85svh] max-w-[min(96vw,760px)] overflow-hidden rounded-lg p-0 text-slate-950 sm:h-[70svh] sm:max-w-[760px]">
        {/* ✅ el form ocupa toda la altura fija */}
        <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <div className="px-4 pt-4">
              <DialogTitle className="text-lg font-bold text-violet-700">{title}</DialogTitle>
              <DialogDescription>
                {readonly ? "Consulta los datos del usuario" : "Complete los datos del usuario"}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="mx-4 mt-3 grid grid-cols-4 rounded-lg bg-slate-100 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex h-8 items-center justify-center gap-1 rounded-md text-xs font-semibold text-slate-600",
                    activeTab === tab.id && "bg-white text-slate-950 shadow-sm"
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ✅ contenido scrolleable dentro del alto fijo */}
          <div className="mt-4 flex-1 min-h-0 overflow-y-auto px-4 pb-2">
            {activeTab === "general" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre completo *</Label>
                  <Input
                    disabled={readonly}
                    value={form.fullname}
                    onChange={(event) => updateField("fullname", event.target.value)}
                    className="h-9 bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Usuario *</Label>
                  <Input
                    disabled={readonly}
                    value={form.username}
                    onChange={(event) => updateField("username", event.target.value)}
                    className="h-9 bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    disabled={readonly}
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    className="h-9 bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Telefono</Label>
                  <Input
                    disabled={readonly}
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    className="h-9 bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Rol</Label>
                  <SearchableSelect
                    disabled={readonly}
                    value={form.roleId}
                    options={roleOptions}
                    placeholder="Selecciona rol"
                    searchPlaceholder="Buscar rol..."
                    onChange={(value) => updateField("roleId", value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2">
                    <Input
                      disabled={readonly}
                      value={form.color}
                      onChange={(event) => updateField("color", event.target.value)}
                      className="h-9 bg-white"
                    />
                    <input
                      disabled={readonly}
                      type="color"
                      value={form.color}
                      onChange={(event) => updateField("color", event.target.value)}
                      className="h-9 w-12 rounded-md border border-slate-200 disabled:opacity-60"
                    />
                  </div>
                </div>

                {!readonly ? (
                  <>
                    <div className="space-y-2">
                      <Label>Contrasena</Label>
                      <Input
                        type="password"
                        value={form.password}
                        onChange={(event) => updateField("password", event.target.value)}
                        className="h-9 bg-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Confirmar contrasena</Label>
                      <Input
                        type="password"
                        value={form.confirmPassword}
                        onChange={(event) => updateField("confirmPassword", event.target.value)}
                        className="h-9 bg-white"
                      />
                    </div>
                  </>
                ) : null}

                <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                  <Checkbox
                    disabled={readonly}
                    checked={form.isActive}
                    onCheckedChange={(checked) => updateField("isActive", Boolean(checked))}
                  />
                  <span>
                    <span className="block text-sm font-bold text-violet-700">Usuario activo</span>
                    <span className="text-xs font-medium text-slate-500">Puede acceder al sistema</span>
                  </span>
                </label>
              </div>
            ) : null}

            {activeTab === "schedule" ? (
              <div className="space-y-3">
                {WORK_DAYS.map((day) => {
                  const value = form.workSchedule[day.key] || {};
                  return (
                    <div key={day.key} className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-bold text-violet-700">
                          <Checkbox
                            disabled={readonly}
                            checked={Boolean(value.active)}
                            onCheckedChange={(checked) => updateSchedule(day.key, "active", Boolean(checked))}
                          />
                          {day.label}
                        </label>
                        <span
                          className={cn(
                            "rounded-md px-2 py-1 text-xs font-semibold",
                            value.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {value.active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Entrada</Label>
                          <Input
                            disabled={readonly}
                            type="time"
                            value={value.start || "08:00"}
                            onChange={(event) => updateSchedule(day.key, "start", event.target.value)}
                            className="h-9 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Salida</Label>
                          <Input
                            disabled={readonly}
                            type="time"
                            value={value.end || "18:00"}
                            onChange={(event) => updateSchedule(day.key, "end", event.target.value)}
                            className="h-9 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {activeTab === "permissions" ? (
              <div className="space-y-3">
                {USER_PERMISSION_GROUPS.map((group) => (
                  <div key={group.key} className="rounded-lg border border-slate-200 p-3">
                    <p className="mb-3 text-sm font-bold text-violet-700">{group.label}</p>
                    {group.actions.includes("view") ? (
                      <div className="mb-3 rounded-md border border-violet-100 bg-violet-50 px-3 py-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-violet-700">
                          <Checkbox
                            disabled={readonly}
                            checked={Boolean(form.permissions[group.key]?.view)}
                            onCheckedChange={() => togglePermission(group.key, "view")}
                          />
                          Ingreso a la pagina
                        </label>
                      </div>
                    ) : null}
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Permisos de botones
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {group.actions
                          .filter((action) => action !== "view")
                          .map((action) => (
                            <label key={action} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                              <Checkbox
                                disabled={readonly}
                                checked={Boolean(form.permissions[group.key]?.[action])}
                                onCheckedChange={() => togglePermission(group.key, action)}
                              />
                              {permissionActionLabels[action] || action}
                            </label>
                          ))}
                        {group.actions.filter((action) => action !== "view").length ? null : (
                          <span className="text-xs font-medium text-slate-400">Sin botones configurados</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === "sites" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-violet-400 bg-violet-50 p-3">
                  <p className="text-sm font-bold text-violet-700">Centros seleccionados:</p>
                  <p className="text-xs font-medium text-slate-600">
                    {options.centros
                      .filter((centro) => form.centroIds.includes(centro.id))
                      .map((centro) => centro.nombre)
                      .join(", ") || "Ninguno"}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <SiteColumn
                    readonly={readonly}
                    title="Centros"
                    items={options.centros}
                    selected={form.centroIds}
                    onToggle={(id) => updateField("centroIds", toggleArray(form.centroIds, id))}
                  />
                  <SiteColumn
                    readonly={readonly}
                    title="Talleres"
                    items={options.talleres}
                    selected={form.tallerIds}
                    onToggle={(id) => updateField("tallerIds", toggleArray(form.tallerIds, id))}
                  />
                  <SiteColumn
                    readonly={readonly}
                    title="Mostradores"
                    items={options.mostradores}
                    selected={form.mostradorIds}
                    onToggle={(id) => updateField("mostradorIds", toggleArray(form.mostradorIds, id))}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
          ) : null}

          <DialogFooter className="mt-4 border-t border-slate-200 px-4 py-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            {!readonly ? (
              <Button type="submit" disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Guardar cambios
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SiteColumn({ title, items, selected, onToggle, readonly }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="mb-3 text-sm font-bold text-violet-700">{title}</p>
      <div className="space-y-3">
        {items.map((item) => (
          <label key={item.id} className="flex items-start gap-2 text-xs font-medium text-slate-700">
            <Checkbox disabled={readonly} checked={selected.includes(item.id)} onCheckedChange={() => onToggle(item.id)} />
            <span>{item.nombre}</span>
          </label>
        ))}
      </div>
    </div>
  );
}