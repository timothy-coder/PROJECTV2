"use client";

import { useMemo, useState } from "react";
import { Edit3, Eye, Loader2, Plus, Search, Shield, Trash2, UserRound, Users } from "lucide-react";

import { DeleteUserDialog } from "@/components/users/DeleteUserDialog";
import { UserDialog } from "@/components/users/UserDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useUsers } from "@/hooks/users/useUsers";
import { hasPerm } from "@/lib/permissions";

function StatCard({ label, value, tone, icon: Icon }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
  };

  return (
    <div className={`flex min-h-24 items-center justify-between rounded-lg border p-4 ${tones[tone]}`}>
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      </div>
      <Icon className="size-9 opacity-25" />
    </div>
  );
}

export default function UsersPage({ userPermissions }) {
  const {
    users,
    options,
    loading,
    error,
    stats,
    createUser,
    updateUser,
    deleteUser,
  } = useUsers();
  const [query, setQuery] = useState("");
  const [dialogMode, setDialogMode] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const canCreate = hasPerm(userPermissions, ["usuarios", "create"]);
  const canEdit = hasPerm(userPermissions, ["usuarios", "edit"]);
  const canDelete = hasPerm(userPermissions, ["usuarios", "delete"]);
  const filteredUsers = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return users;

    return users.filter((user) =>
      [user.username, user.fullname, user.email, user.roleName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(clean))
    );
  }, [query, users]);

  function openCreate() {
    setSelectedUser(null);
    setDialogMode("create");
  }

  function openEdit(user) {
    setSelectedUser(user);
    setDialogMode("edit");
  }

  function openDelete(user) {
    setSelectedUser(user);
    setDialogMode("delete");
  }

  async function toggleUserActive(user) {
    await updateUser(user.id, {
      roleId: user.roleId,
      fullname: user.fullname,
      username: user.username,
      email: user.email,
      phone: user.phone,
      password: "",
      isActive: !user.isActive,
      permissions: user.permissions,
      workSchedule: user.workSchedule,
      color: user.color,
      centroIds: user.centroIds,
      tallerIds: user.tallerIds,
      mostradorIds: user.mostradorIds,
    });
  }

  return (
    <div className="min-w-0 bg-slate-50 text-slate-950 sm:p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
          <Users className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-tight text-slate-950">Gestion de Usuarios</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">Administra todos los usuarios del sistema</p>
        </div>
      </div>

      <div className="mb-4 border-t border-slate-200" />

      <div className="grid gap-3 lg:grid-cols-3">
        <StatCard label="Total de Usuarios" value={stats.total} tone="blue" icon={Users} />
        <StatCard label="Usuarios Activos" value={stats.active} tone="green" icon={Shield} />
        <StatCard label="Usuarios Inactivos" value={stats.inactive} tone="orange" icon={Shield} />
      </div>

      <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-violet-600 bg-white shadow-sm">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
              <Users className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-950">Busqueda y Filtros</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">Busca usuarios por nombre, email o rol</p>
            </div>
          </div>
          {canCreate ? (
            <Button onClick={openCreate} className="bg-violet-700 text-white hover:bg-violet-800">
              <Plus className="size-4" />
              Nuevo Usuario
            </Button>
          ) : null}
        </div>
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar usuario o nombre..."
              className="h-9 bg-white pl-9"
            />
          </div>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-violet-600 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
            <Users className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-950">Lista de Usuarios</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">Todos los usuarios del sistema</p>
          </div>
        </div>

        {error ? (
          <div className="mx-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto border-t border-slate-200">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Usuario</th>
                <th className="px-3 py-2.5">Nombre completo</th>
                <th className="px-3 py-2.5">Rol</th>
                <th className="px-3 py-2.5">Activo</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Cargando usuarios...
                    </span>
                  </td>
                </tr>
              ) : filteredUsers.length ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="text-slate-800">
                    <td className="px-3 py-3 font-semibold">{user.username}</td>
                    <td className="px-3 py-3">{user.fullname}</td>
                    <td className="px-3 py-3 text-slate-500">{user.roleName || "-"}</td>
                    <td className="px-3 py-3">
                      <Switch
                        checked={user.isActive}
                        disabled={!canEdit}
                        onCheckedChange={() => toggleUserActive(user)}
                        className="data-checked:bg-violet-700"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setSelectedUser(user);
                          setDialogMode("view");
                        }} title="Ver usuario">
                          <Eye className="size-4" />
                        </Button>
                        {canEdit ? (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title="Editar usuario">
                            <Edit3 className="size-4" />
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button variant="destructive" size="icon" onClick={() => openDelete(user)} title="Eliminar usuario">
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                    No hay usuarios para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          <span>Pagina 1 de 1</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled>Anterior</Button>
            <Button variant="outline" disabled>Siguiente</Button>
          </div>
        </div>
      </section>

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700">
        <p className="text-sm font-bold">Informacion importante:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-medium">
          <li>Los usuarios activos tienen acceso al sistema</li>
          <li>Los permisos controlan acceso a modulos y acciones</li>
          <li>Los sitios definen centros, talleres y mostradores disponibles</li>
        </ul>
      </div>

      <UserDialog
        open={dialogMode === "create" || dialogMode === "edit" || dialogMode === "view"}
        mode={dialogMode}
        user={selectedUser}
        options={options}
        onClose={() => setDialogMode(null)}
        onSubmit={(payload) =>
          dialogMode === "edit"
            ? updateUser(selectedUser.id, payload)
            : createUser(payload)
        }
      />

      <DeleteUserDialog
        open={dialogMode === "delete"}
        user={selectedUser}
        onClose={() => setDialogMode(null)}
        onConfirm={() => deleteUser(selectedUser.id)}
      />
    </div>
  );
}
