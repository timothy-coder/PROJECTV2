"use client";

import { useMemo, useState } from "react";
import { Clock3, LockKeyhole, Loader2, MapPin, Plus, Trash2, UserRound } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { PERMISSION_ACTION_LABELS, WORK_DAYS, defaultWorkSchedule, getPermissionSections } from "@/components/users/config";
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

const SHORT_DAY_KEYS = {
  monday: "mon",
  tuesday: "tue",
  wednesday: "wed",
  thursday: "thu",
  friday: "fri",
  saturday: "sat",
  sunday: "sun",
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

function normalizeDaySchedule(dayKey, schedule = {}) {
  const shortKey = SHORT_DAY_KEYS[dayKey];
  const value = schedule[dayKey] || {};
  const shortValue = shortKey ? schedule[shortKey] || {} : {};
  const defaultValue = defaultWorkSchedule()[dayKey] || {};
  const rawSlots = Array.isArray(value.slots) && value.slots.length
    ? value.slots
    : Array.isArray(shortValue.slots) && shortValue.slots.length
      ? shortValue.slots
      : [{ start: value.start || shortValue.start || defaultValue.start || "08:00", end: value.end || shortValue.end || defaultValue.end || "18:00" }];
  const slots = rawSlots
    .map((slot) => ({ start: slot?.start || "08:00", end: slot?.end || "18:00" }))
    .filter((slot) => slot.start && slot.end);
  const safeSlots = slots.length ? slots : [{ start: "08:00", end: "18:00" }];

  return {
    active: value.active ?? defaultValue.active ?? false,
    start: safeSlots[0].start,
    end: safeSlots[0].end,
    slots: safeSlots,
  };
}

function normalizeWorkSchedule(schedule = {}) {
  return Object.fromEntries(WORK_DAYS.map((day) => [day.key, normalizeDaySchedule(day.key, schedule)]));
}

function serializeWorkSchedule(schedule = {}) {
  const normalized = normalizeWorkSchedule(schedule);
  return Object.fromEntries(
    WORK_DAYS.map((day) => {
      const value = normalized[day.key];
      const slots = (value.slots || []).filter((slot) => slot.start && slot.end);
      const safeSlots = slots.length ? slots : [{ start: value.start || "08:00", end: value.end || "18:00" }];
      return [
        day.key,
        {
          active: Boolean(value.active),
          start: safeSlots[0].start,
          end: safeSlots[0].end,
          slots: safeSlots,
        },
      ];
    })
  );
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
    workSchedule: normalizeWorkSchedule(user.workSchedule || {}),
    color: user.color || "#5e17eb",
    centroIds: user.centroIds || [],
    tallerIds: user.tallerIds || [],
    mostradorIds: user.mostradorIds || [],
  };
}

function toggleArray(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function clonePermissions(permissions) {
  try {
    return JSON.parse(JSON.stringify(permissions || {}));
  } catch {
    return {};
  }
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
  const [permissionProfileId, setPermissionProfileId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const roleOptions = useMemo(
    () => options.roles.map((role) => ({ value: role.id, label: role.name })),
    [options.roles]
  );
  const permissionProfileOptions = useMemo(
    () => (options.permissionProfiles || []).map((profile) => ({ value: profile.id, label: profile.nombre })),
    [options.permissionProfiles]
  );
  const permissionSections = useMemo(() => getPermissionSections(), []);

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

  function applyPermissionProfile(profileId) {
    setPermissionProfileId(profileId);
    const profile = (options.permissionProfiles || []).find((item) => String(item.id) === String(profileId));
    if (!profile) return;

    setForm((current) => ({
      ...current,
      permissions: clonePermissions(profile.permissions),
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

  function updateScheduleSlot(day, index, field, value) {
    setForm((current) => {
      const dayValue = normalizeDaySchedule(day, current.workSchedule);
      const slots = [...dayValue.slots];
      slots[index] = { ...(slots[index] || { start: "08:00", end: "18:00" }), [field]: value };
      const first = slots[0] || { start: "08:00", end: "18:00" };
      return {
        ...current,
        workSchedule: {
          ...current.workSchedule,
          [day]: {
            ...dayValue,
            start: first.start,
            end: first.end,
            slots,
          },
        },
      };
    });
  }

  function addScheduleSlot(day) {
    setForm((current) => {
      const dayValue = normalizeDaySchedule(day, current.workSchedule);
      const slots = [...dayValue.slots, { start: "15:00", end: "18:00" }];
      return {
        ...current,
        workSchedule: {
          ...current.workSchedule,
          [day]: {
            ...dayValue,
            slots,
          },
        },
      };
    });
  }

  function removeScheduleSlot(day, index) {
    setForm((current) => {
      const dayValue = normalizeDaySchedule(day, current.workSchedule);
      const slots = dayValue.slots.filter((_, slotIndex) => slotIndex !== index);
      const safeSlots = slots.length ? slots : [{ start: "08:00", end: "18:00" }];
      return {
        ...current,
        workSchedule: {
          ...current.workSchedule,
          [day]: {
            ...dayValue,
            start: safeSlots[0].start,
            end: safeSlots[0].end,
            slots: safeSlots,
          },
        },
      };
    });
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
        workSchedule: serializeWorkSchedule(form.workSchedule),
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
      <DialogContent className="h-[90svh] max-w-[min(98vw,920px)] overflow-hidden rounded-lg p-0 text-slate-950 sm:h-[82svh] sm:max-w-[920px]">
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
                  const value = normalizeDaySchedule(day.key, form.workSchedule);
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
                      <div className="space-y-2">
                        {value.slots.map((slot, index) => (
                          <div key={`${day.key}-${index}`} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                            <div className="space-y-1">
                              <Label>Entrada {index + 1}</Label>
                              <Input
                                disabled={readonly || !value.active}
                                type="time"
                                value={slot.start || "08:00"}
                                onChange={(event) => updateScheduleSlot(day.key, index, "start", event.target.value)}
                                className="h-9 bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Salida {index + 1}</Label>
                              <Input
                                disabled={readonly || !value.active}
                                type="time"
                                value={slot.end || "18:00"}
                                onChange={(event) => updateScheduleSlot(day.key, index, "end", event.target.value)}
                                className="h-9 bg-white"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={readonly || value.slots.length <= 1}
                              onClick={() => removeScheduleSlot(day.key, index)}
                              title="Eliminar turno"
                            >
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={readonly || !value.active}
                          onClick={() => addScheduleSlot(day.key)}
                          className="w-full justify-center border-violet-200 text-violet-700"
                        >
                          <Plus className="size-4" />Agregar turno
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {activeTab === "permissions" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-violet-100 bg-violet-50/70 p-3">
                  <div className="grid gap-2 md:grid-cols-[minmax(240px,360px)_1fr] md:items-end">
                    <div className="space-y-2">
                      <Label>Perfil de permisos</Label>
                      <SearchableSelect
                        disabled={readonly}
                        value={permissionProfileId}
                        options={permissionProfileOptions}
                        placeholder="Aplicar perfil"
                        searchPlaceholder="Buscar perfil..."
                        emptyText="Sin perfiles"
                        onChange={applyPermissionProfile}
                      />
                    </div>
                    <p className="text-xs font-medium leading-relaxed text-slate-600">
                      Al escoger un perfil se marcan sus permisos definidos. Puedes modificarlos antes de guardar.
                    </p>
                  </div>
                </div>
                {permissionSections.map((section) => (
                  <section key={section.label} className="space-y-2">
                    <div className="sticky top-0 z-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{section.label}</p>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {section.items.map((group) => (
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
                                    {PERMISSION_ACTION_LABELS[action] || action}
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
                  </section>
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
