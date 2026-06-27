"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { canUseAction } from "@/components/generalconfiguration/permissionUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatCard({ label, value, icon: Icon, tone }) {
  const tones = {
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <div className={cn("flex min-h-16 items-center justify-between rounded-lg border p-2 sm:min-h-24 sm:p-4", tones[tone])}>
      <div>
        <p className="truncate text-[10px] font-semibold sm:text-xs">{label}</p>
        <p className="mt-1 text-lg font-bold text-slate-950 sm:mt-3 sm:text-2xl">{value}</p>
      </div>
      <Icon className="hidden size-9 opacity-25 sm:block" />
    </div>
  );
}

export function RolesTab({ tab, userPermissions }) {
  const [roles, setRoles] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canCreate = canUseAction(userPermissions, tab, "create");

  const stats = useMemo(
    () => ({
      total: roles.length,
      users: roles.reduce((sum, role) => sum + Number(role.usersCount || 0), 0),
    }),
    [roles]
  );

  const fetchRoles = useCallback(async () => {
    const response = await fetch("/api/generalconfiguration/roles", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "No se pudieron cargar los roles.");
    return result.roles || [];
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialRoles() {
      try {
        const nextRoles = await fetchRoles();
        if (cancelled) return;
        setRoles(nextRoles);
        setError("");
      } catch (fetchError) {
        if (cancelled) return;
        setError(fetchError.message);
        toast.error(fetchError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitialRoles();

    return () => {
      cancelled = true;
    };
  }, [fetchRoles]);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextRoles = await fetchRoles();
      setRoles(nextRoles);
    } catch (fetchError) {
      setError(fetchError.message);
      toast.error(fetchError.message);
    } finally {
      setLoading(false);
    }
  }, [fetchRoles]);

  async function handleCreate(event) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Ingresa el nombre del rol.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/generalconfiguration/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "No se pudo crear el rol.");
      setRoles((current) => [...current, result.role].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setDescription("");
      toast.success("Rol creado correctamente.");
    } catch (createError) {
      toast.error(createError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-600 text-white">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight text-slate-950 sm:text-xl">Roles</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">Crea roles para asignarlos a usuarios y links.</p>
          </div>
        </div>

        <Button variant="outline" className="w-full sm:w-auto" onClick={loadRoles} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          {roles.length} roles
        </Button>
      </div>

      <div className="mx-4 border-t border-slate-200" />

      <div className="grid grid-cols-2 gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4">
        <StatCard label="Total de roles" value={stats.total} icon={ShieldCheck} tone="violet" />
        <StatCard label="Usuarios asignados" value={stats.users} icon={UsersRound} tone="blue" />
      </div>

      {error ? (
        <div className="mx-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 px-3 pb-3 sm:grid-cols-[minmax(0,380px)_1fr] sm:px-4 sm:pb-4">
        <form onSubmit={handleCreate} className="rounded-lg border border-violet-200 bg-violet-50 p-3">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-violet-700" />
            <h3 className="text-sm font-bold text-slate-950">Nuevo rol</h3>
          </div>
          <div className="mt-3 space-y-1">
            <Label htmlFor="role-name">Nombre del rol</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej: Jefe de Ventas"
              disabled={!canCreate || saving}
            />
          </div>
          <div className="mt-3 space-y-1">
            <Label htmlFor="role-description">Descripcion</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ej: Permisos para el equipo comercial"
              rows={3}
              disabled={!canCreate || saving}
            />
          </div>
          <Button type="submit" className="mt-3 w-full bg-violet-600 text-white hover:bg-violet-700" disabled={!canCreate || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Crear rol
          </Button>
          {!canCreate ? (
            <p className="mt-2 text-xs font-medium text-violet-700">No tienes permiso para crear roles.</p>
          ) : null}
        </form>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-violet-600" />
              <h3 className="text-sm font-bold text-slate-950">Listado de roles</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700">
              {roles.length} registros
            </span>
          </div>

          <div className="space-y-2 p-2 sm:p-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Cargando roles...
              </div>
            ) : roles.length ? (
              roles.map((role) => (
                <div key={role.id} className="flex min-h-14 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-950">{role.name}</p>
                      {role.description ? (
                        <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-slate-600">{role.description}</p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        ID: {role.id} - Creado: {formatDate(role.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                    {role.usersCount} usuarios
                  </span>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm font-medium text-slate-500">No hay roles registrados.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
