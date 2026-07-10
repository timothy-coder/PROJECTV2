"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Loader2, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { canUseAction } from "@/components/generalconfiguration/permissionUtils";
import { PERMISSION_ACTION_LABELS, USER_PERMISSION_GROUPS, getPermissionSections } from "@/components/users/config";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function clonePermissions(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function countPermissions(permissions = {}) {
  return USER_PERMISSION_GROUPS.reduce((sum, group) => {
    const current = permissions[group.key] || {};
    return sum + group.actions.filter((action) => Boolean(current[action])).length;
  }, 0);
}

export function PermissionProfilesTab({ tab, userPermissions }) {
  const [profiles, setProfiles] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nombre: "", permissions: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const canCreate = canUseAction(userPermissions, tab, "create");
  const canEdit = canUseAction(userPermissions, tab, "edit");
  const canDelete = canUseAction(userPermissions, tab, "delete");
  const canSave = editing ? canEdit : canCreate;

  const stats = useMemo(() => ({
    total: profiles.length,
    permisos: profiles.reduce((sum, profile) => sum + countPermissions(profile.permissions), 0),
  }), [profiles]);
  const permissionSections = useMemo(() => getPermissionSections(), []);

  const fetchProfiles = useCallback(async () => {
    const response = await fetch("/api/generalconfiguration/perfiles-permisos", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "No se pudieron cargar los perfiles.");
    return result.profiles || [];
  }, []);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchProfiles();
      setProfiles(next);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [fetchProfiles]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialProfiles() {
      try {
        const next = await fetchProfiles();
        if (cancelled) return;
        setProfiles(next);
      } catch (error) {
        if (!cancelled) toast.error(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitialProfiles();

    return () => {
      cancelled = true;
    };
  }, [fetchProfiles]);

  function resetForm() {
    setEditing(null);
    setForm({ nombre: "", permissions: {} });
  }

  function editProfile(profile) {
    setEditing(profile);
    setForm({ nombre: profile.nombre || "", permissions: clonePermissions(profile.permissions) });
  }

  function togglePermission(moduleKey, action) {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [moduleKey]: {
          ...(current.permissions[moduleKey] || {}),
          [action]: !current.permissions[moduleKey]?.[action],
        },
      },
    }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!form.nombre.trim()) {
      toast.error("Ingresa el nombre del perfil.");
      return;
    }

    setSaving(true);
    try {
      const url = editing
        ? `/api/generalconfiguration/perfiles-permisos/${editing.id}`
        : "/api/generalconfiguration/perfiles-permisos";
      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: form.nombre, permissions: form.permissions }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "No se pudo guardar el perfil.");

      setProfiles((current) => {
        const profile = result.profile;
        const next = editing
          ? current.map((item) => (item.id === profile.id ? profile : item))
          : [...current, profile];
        return next.sort((a, b) => a.nombre.localeCompare(b.nombre));
      });
      resetForm();
      toast.success(editing ? "Perfil actualizado correctamente." : "Perfil creado correctamente.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile(profile) {
    if (!window.confirm(`Eliminar perfil "${profile.nombre}"?`)) return;
    setDeletingId(profile.id);
    try {
      const response = await fetch(`/api/generalconfiguration/perfiles-permisos/${profile.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "No se pudo eliminar el perfil.");
      setProfiles((current) => current.filter((item) => item.id !== profile.id));
      if (editing?.id === profile.id) resetForm();
      toast.success("Perfil eliminado correctamente.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-600 text-white">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight text-slate-950 sm:text-xl">Perfiles de permisos</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">Crea plantillas de permisos para reutilizarlas por perfil.</p>
          </div>
        </div>
        <Button variant="outline" onClick={loadProfiles} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 border-y border-slate-200 bg-slate-50 px-3 py-3 sm:px-4">
        <Stat label="Perfiles" value={stats.total} />
        <Stat label="Permisos activos" value={stats.permisos} />
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-4">
        <form onSubmit={saveProfile} className="min-w-0 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <Label htmlFor="profile-name">Nombre del perfil</Label>
              <Input
                id="profile-name"
                value={form.nombre}
                onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                placeholder="Ej: Asesor ventas completo"
                disabled={!canSave || saving}
                className="mt-1 bg-white"
              />
            </div>
            <div className="flex gap-2">
              {editing ? <Button type="button" variant="outline" onClick={resetForm}>Nuevo</Button> : null}
              <Button type="submit" disabled={!canSave || saving} className="bg-violet-700 text-white hover:bg-violet-800">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {editing ? "Actualizar" : "Guardar"}
              </Button>
            </div>
          </div>

          {!canSave ? (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              No tienes permiso para {editing ? "editar" : "crear"} perfiles.
            </div>
          ) : null}

          <div className="max-h-[58svh] space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
            {permissionSections.map((section) => (
              <section key={section.label} className="space-y-2">
                <div className="sticky top-0 z-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{section.label}</p>
                </div>
                <div className="grid gap-2 xl:grid-cols-2">
                  {section.items.map((group) => (
                    <div key={group.key} className="rounded-lg border border-slate-200 bg-white p-2">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-bold text-slate-900">{group.label}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {group.actions.filter((action) => form.permissions[group.key]?.[action]).length}/{group.actions.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {group.actions.map((action) => (
                          <label key={`${group.key}-${action}`} className="flex items-center gap-2 rounded-md border border-slate-100 px-2 py-1.5 text-[11px] font-semibold text-slate-600">
                            <Checkbox
                              checked={Boolean(form.permissions[group.key]?.[action])}
                              disabled={!canSave || saving}
                              onCheckedChange={() => togglePermission(group.key, action)}
                            />
                            <span className="truncate">{PERMISSION_ACTION_LABELS[action] || action}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </form>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <h3 className="text-sm font-bold text-slate-950">Perfiles guardados</h3>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{profiles.length}</span>
          </div>
          <div className="max-h-[68svh] space-y-2 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Cargando perfiles...
              </div>
            ) : profiles.length ? profiles.map((profile) => (
              <div key={profile.id} className="rounded-lg border border-slate-200 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">{profile.nombre}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                      {countPermissions(profile.permissions)} permisos - {formatDate(profile.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => editProfile(profile)} disabled={!canEdit}>
                      <Edit3 className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50" onClick={() => deleteProfile(profile)} disabled={!canDelete || deletingId === profile.id}>
                      {deletingId === profile.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="py-10 text-center text-sm font-medium text-slate-500">No hay perfiles registrados.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-violet-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold text-violet-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
