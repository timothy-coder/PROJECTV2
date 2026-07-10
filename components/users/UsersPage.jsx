"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Edit3, Eye, Loader2, Plus, Search, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { DeleteUserDialog } from "@/components/users/DeleteUserDialog";
import { UserDialog } from "@/components/users/UserDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useUsers } from "@/hooks/users/useUsers";
import { hasPerm } from "@/lib/permissions";

const userToastStyles = {
  success: {
    classNames: {
      toast: "!min-h-0 !w-[min(92vw,320px)] !gap-2 !rounded-md !border-emerald-200 !bg-emerald-50 !px-3 !py-2 !text-xs !font-medium !leading-snug !text-emerald-900 !shadow-md",
      icon: "!text-emerald-600",
      title: "!text-emerald-900",
      description: "!text-emerald-700",
    },
  },
  danger: {
    classNames: {
      toast: "!min-h-0 !w-[min(92vw,320px)] !gap-2 !rounded-md !border-red-200 !bg-red-50 !px-3 !py-2 !text-xs !font-medium !leading-snug !text-red-900 !shadow-md",
      icon: "!text-red-600",
      title: "!text-red-900",
      description: "!text-red-700",
    },
  },
};

function showUserToast(type, title, description) {
  const baseOptions = {
    duration: 2800,
    position: "top-right",
    icon:
      type === "danger" ? (
        <Trash2 className="size-4 shrink-0 text-red-600" />
      ) : (
        <Users className="size-4 shrink-0 text-emerald-600" />
      ),
    ...(type === "danger" ? userToastStyles.danger : userToastStyles.success),
  };

  toast(description ? `${title}. ${description}` : title, baseOptions);
}

function StatCard({ label, shortLabel, value, tone, icon: Icon }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div className={`flex items-center justify-between rounded-lg border px-2 py-2 sm:px-3 ${tones[tone]}`}>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold leading-4 sm:text-[11px]">
          <span className="sm:hidden">{shortLabel || label}</span>
          <span className="hidden sm:inline">{label}</span>
        </p>
        <p className="mt-0.5 text-xl font-bold leading-6 text-slate-950">{value}</p>
      </div>
      <Icon className="hidden size-5 shrink-0 opacity-50 sm:block" />
    </div>
  );
}

export default function UsersPage({ userPermissions }) {
  const { users, options, loading, error, stats, createUser, updateUser, deleteUser } = useUsers();

  const [query, setQuery] = useState("");
  const [dialogMode, setDialogMode] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [expandedUserId, setExpandedUserId] = useState(null);

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
    showUserToast("success", "Usuario actualizado", "El estado del usuario se actualizo correctamente.");
  }

  async function handleSaveUser(payload) {
    if (dialogMode === "edit") {
      await updateUser(selectedUser.id, payload);
      showUserToast("success", "Usuario actualizado", "Los cambios se guardaron correctamente.");
      return;
    }

    await createUser(payload);
    showUserToast("success", "Usuario creado", "El usuario se registro correctamente.");
  }

  async function handleDeleteUser() {
    const username = selectedUser?.username;
    await deleteUser(selectedUser.id);
    showUserToast(
      "danger",
      "Usuario eliminado",
      username ? `Se elimino el usuario ${username}.` : "El usuario se elimino correctamente."
    );
  }

  return (
    // ✅ layout full height
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col overflow-hidden bg-slate-50 p-3 text-slate-950 md:h-svh sm:p-4">
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
          <Users className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold leading-tight text-violet-700">Gestión de Usuarios</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">Administra todos los usuarios del sistema</p>
        </div>
      </div>

      {/* Stats compactos */}
      <div className="grid grid-cols-3 shrink-0 gap-2">
        <StatCard label="Total de Usuarios" shortLabel="Total" value={stats.total} tone="blue" icon={Users} />
        <StatCard label="Usuarios Activos" shortLabel="Activos" value={stats.active} tone="green" icon={Shield} />
        <StatCard label="Usuarios Inactivos" shortLabel="Inactivos" value={stats.inactive} tone="orange" icon={Shield} />
      </div>

      {/* ✅ Card principal ocupa el resto con flex */}
      <section className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-violet-600 bg-white shadow-sm">
        {/* Header lista */}
        

        {/* ✅ Toolbar: search full + button right + misma altura */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar usuario o nombre..."
              className="h-10 w-full bg-white pl-9"
            />
          </div>

          {canCreate ? (
            <Button onClick={openCreate} className="h-10 shrink-0 bg-violet-700 text-white hover:bg-violet-800">
              <Plus className="mr-2 size-5" />
              Nuevo Usuario
            </Button>
          ) : null}
        </div>

        {error ? (
          <div className="mx-4 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {/* ✅ Tabla scrolleable: ocupa el espacio disponible */}
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain border-t border-slate-200">
          <table className="w-full border-collapse text-left text-sm sm:min-w-[760px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Usuario</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Nombre completo</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Rol</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Activo</th>
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
                filteredUsers.map((user) => {
                  const expanded = expandedUserId === user.id;

                  return (
                    <Fragment key={user.id}>
                      <tr className="text-slate-800">
                        <td className="px-3 py-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="size-2.5 shrink-0 rounded-full border border-slate-200 shadow-sm"
                              style={{ backgroundColor: user.color || "#5e17eb" }}
                            />
                            <p className="truncate font-semibold">{user.username}</p>
                          </div>
                          <div className="mt-1 space-y-0.5 text-xs text-slate-500 sm:hidden">
                            <p className="font-medium text-slate-700">{user.fullname || "-"}</p>
                            <p>{user.roleName || "-"}</p>
                          </div>
                        </td>
                        <td className="hidden px-3 py-2.5 sm:table-cell">{user.fullname}</td>
                        <td className="hidden px-3 py-2.5 text-slate-500 sm:table-cell">{user.roleName || "-"}</td>
                        <td className="hidden px-3 py-2.5 sm:table-cell">
                          <Switch
                            checked={user.isActive}
                            disabled={!canEdit}
                            onCheckedChange={() => toggleUserActive(user)}
                            className="data-checked:bg-violet-700"
                          />
                        </td>
                        <td className="relative px-3 py-2.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExpandedUserId(expanded ? null : user.id)}
                            className="ml-auto flex h-8 gap-1 px-2 sm:hidden"
                          >
                            Acciones
                            <ChevronDown className={`size-4 transition ${expanded ? "rotate-180" : ""}`} />
                          </Button>

                          {expanded ? (
                            <div className="absolute right-3 top-11 z-20 w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg sm:hidden">
                              <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600">
                                <span>Activo</span>
                                <Switch
                                  checked={user.isActive}
                                  disabled={!canEdit}
                                  onCheckedChange={() => toggleUserActive(user)}
                                  className="data-checked:bg-violet-700"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setDialogMode("view");
                                  setExpandedUserId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                              >
                                <Eye className="size-4" />
                                Ver
                              </button>

                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    openEdit(user);
                                    setExpandedUserId(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                                >
                                  <Edit3 className="size-4" />
                                  Editar
                                </button>
                              ) : null}

                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    openDelete(user);
                                    setExpandedUserId(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="size-4" />
                                  Borrar
                                </button>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="hidden justify-end gap-2 sm:flex">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedUser(user);
                                setDialogMode("view");
                              }}
                              title="Ver usuario"
                            >
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
                    </Fragment>
                  );
                })
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

        {/* Footer paginación (fijo, no se va con el scroll) */}
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          <span className="font-medium">Pagina 1 de 1</span>
          <span className="text-center font-medium">{filteredUsers.length} de {filteredUsers.length} registros</span>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled className="h-9">
              Anterior
            </Button>
            <Button variant="outline" disabled className="h-9">
              Siguiente
            </Button>
          </div>
        </div>
      </section>

      <UserDialog
        open={dialogMode === "create" || dialogMode === "edit" || dialogMode === "view"}
        mode={dialogMode}
        user={selectedUser}
        options={options}
        onClose={() => setDialogMode(null)}
        onSubmit={handleSaveUser}
      />

      <DeleteUserDialog
        open={dialogMode === "delete"}
        user={selectedUser}
        onClose={() => setDialogMode(null)}
        onConfirm={handleDeleteUser}
      />
    </div>
  );
}
