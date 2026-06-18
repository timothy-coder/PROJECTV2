"use client";

import { Edit3, Link, Loader2, Monitor, Plus, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { useState } from "react";

import { canUseAction } from "@/components/generalconfiguration/permissionUtils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfigurationLinks } from "@/hooks/generalconfiguration/useConfigurationLinks";
import { cn } from "@/lib/utils";

function StatCard({ label, value, tone, icon: Icon }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <div className={cn("flex min-h-24 items-center justify-between rounded-lg border p-4", tones[tone])}>
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      </div>
      <Icon className="size-9 opacity-25" />
    </div>
  );
}

export function LinksTab({ tab, userPermissions }) {
  const { links, roles, loading, error, stats, createLink, updateLink, deleteLink, reload } = useConfigurationLinks();
  const [dialogMode, setDialogMode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const canCreate = canUseAction(userPermissions, tab, "create");
  const canEdit = canUseAction(userPermissions, tab, "edit");
  const canDelete = canUseAction(userPermissions, tab, "delete");

  function openCreate() {
    setSelectedLink(null);
    setDialogMode("create");
  }

  function openEdit(item) {
    setSelectedLink(item);
    setDialogMode("edit");
  }

  function openDelete(item) {
    setSelectedLink(item);
    setDialogMode("delete");
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid gap-3 px-4 py-4 lg:grid-cols-3">
          <StatCard label="Total Links" value={stats.total} tone="blue" icon={Link} />
          <StatCard label="Desktop" value={stats.desktop} tone="purple" icon={Monitor} />
          <StatCard label="Mobile" value={stats.mobile} tone="slate" icon={Smartphone} />
        </div>

        <div className="px-4 pb-4">
          <div className="overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-blue-500 bg-white">
            <div className="flex flex-col gap-3 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
                  <Link className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-950">Links de configuracion</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">Gestiona links para escritorio y movil</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={reload} disabled={loading}>
                  <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                  {links.length} links
                </Button>
                {canCreate ? (
                  <Button onClick={openCreate} className="bg-blue-600 text-white hover:bg-blue-700">
                    <Plus className="size-4" />
                    Nuevo Link
                  </Button>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-2 p-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando links...
                </div>
              ) : links.length ? (
                links.map((item) => (
                  <div key={item.id} className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-blue-200 bg-white px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-950">{item.link}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                        <span>ID: {item.id}</span>
                        <span className={cn("rounded-full px-2 py-0.5", item.isForDesktop ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500")}>Desktop</span>
                        <span className={cn("rounded-full px-2 py-0.5", item.isForMobile ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500")}>Mobile</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{item.roles?.length ? item.roles.map((role) => role.name).join(", ") : "Todos los roles"}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {canEdit ? (
                        <Button variant="outline" size="icon" onClick={() => openEdit(item)} title="Editar link">
                          <Edit3 className="size-4 text-orange-600" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button variant="outline" size="icon" onClick={() => openDelete(item)} title="Eliminar link">
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-sm font-medium text-slate-500">No hay links registrados.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <LinkDialog
        key={`${dialogMode || "closed"}-${selectedLink?.id || "new"}`}
        open={dialogMode === "create" || dialogMode === "edit"}
        mode={dialogMode}
        item={selectedLink}
        roles={roles}
        onClose={() => setDialogMode(null)}
        onSubmit={(payload) => (dialogMode === "edit" ? updateLink(selectedLink.id, payload) : createLink(payload))}
      />
      <DeleteLinkDialog
        open={dialogMode === "delete"}
        item={selectedLink}
        onClose={() => setDialogMode(null)}
        onConfirm={() => deleteLink(selectedLink.id)}
      />
    </>
  );
}

function LinkDialog({ open, mode, item, roles, onClose, onSubmit }) {
  const [form, setForm] = useState({
    link: item?.link || "",
    isForDesktop: item?.isForDesktop || false,
    isForMobile: item?.isForMobile || false,
    roleIds: item?.roles?.map((role) => Number(role.id)) || [],
  });
  const toggleRole = (roleId, checked) => {
    setForm((value) => ({
      ...value,
      roleIds: checked ? [...new Set([...value.roleIds, roleId])] : value.roleIds.filter((id) => Number(id) !== Number(roleId)),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar Link" : "Nuevo Link"}</DialogTitle>
          <DialogDescription>Completa el link y donde se usara.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit(form);
            onClose();
          }}
        >
          <div className="space-y-1">
            <Label>Link</Label>
            <Input value={form.link} onChange={(event) => setForm((value) => ({ ...value, link: event.target.value }))} required />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm font-semibold text-slate-700">
              <Checkbox checked={form.isForDesktop} onCheckedChange={(checked) => setForm((value) => ({ ...value, isForDesktop: Boolean(checked) }))} />
              Para desktop
            </label>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm font-semibold text-slate-700">
              <Checkbox checked={form.isForMobile} onCheckedChange={(checked) => setForm((value) => ({ ...value, isForMobile: Boolean(checked) }))} />
              Para mobile
            </label>
          </div>
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border border-slate-200 p-2 sm:grid-cols-2">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 rounded-md border border-slate-100 p-2 text-sm font-semibold text-slate-700">
                  <Checkbox checked={form.roleIds.includes(Number(role.id))} onCheckedChange={(checked) => toggleRole(Number(role.id), Boolean(checked))} />
                  {role.name}
                </label>
              ))}
              {!roles.length ? <div className="col-span-2 rounded-md border border-dashed p-3 text-center text-sm text-slate-500">No hay roles registrados.</div> : null}
            </div>
            <p className="text-xs text-slate-500">Si no seleccionas roles, el link sera visible para todos.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteLinkDialog({ open, item, onClose, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>Eliminar Link</DialogTitle>
          <DialogDescription>Esta accion eliminara el link seleccionado.</DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-slate-50 p-3 text-sm font-medium text-slate-700">{item?.link}</div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            type="button"
            variant="destructive"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
