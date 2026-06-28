"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Edit3, Loader2, Mail, Phone, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { hasPerm } from "@/lib/permissions";

const emptyProvider = {
  razonSocial: "",
  nombreComercial: "",
  ruc: "",
  contactoNombre: "",
  contactoTelefono: "",
  contactoEmail: "",
  direccion: "",
  isActive: true,
};

export default function ProvidersPage({ userPermissions = {} }) {
  const [providers, setProviders] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState({ open: false, provider: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, provider: null });

  const canCreate = hasPerm(userPermissions, ["proveedores", "create"]);
  const canEdit = hasPerm(userPermissions, ["proveedores", "edit"]);
  const canDelete = hasPerm(userPermissions, ["proveedores", "delete"]);

  const stats = useMemo(() => {
    return providers.reduce(
      (acc, provider) => {
        acc.total += 1;
        if (provider.isActive) acc.active += 1;
        else acc.inactive += 1;
        return acc;
      },
      { total: 0, active: 0, inactive: 0 }
    );
  }, [providers]);

  const filteredProviders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return providers;
    return providers.filter((provider) =>
      [
        provider.razonSocial,
        provider.nombreComercial,
        provider.ruc,
        provider.contactoNombre,
        provider.contactoTelefono,
        provider.contactoEmail,
      ].filter(Boolean).some((value) => value.toLowerCase().includes(needle))
    );
  }, [providers, query]);

  async function loadProviders() {
    setLoading(true);
    try {
      const response = await fetch("/api/proveedores", { credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No se pudieron cargar los proveedores.");
      setProviders(payload.providers || []);
    } catch (error) {
      toast.error(error.message || "No se pudieron cargar los proveedores.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProviders();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveProvider(form) {
    setSaving(true);
    const isEdit = Boolean(dialog.provider?.id);
    try {
      const response = await fetch(isEdit ? `/api/proveedores/${dialog.provider.id}` : "/api/proveedores", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No se pudo guardar el proveedor.");
      toast.success(isEdit ? "Proveedor actualizado." : "Proveedor creado.");
      setDialog({ open: false, provider: null });
      await loadProviders();
    } catch (error) {
      toast.error(error.message || "No se pudo guardar el proveedor.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProvider() {
    if (!deleteDialog.provider?.id) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/proveedores/${deleteDialog.provider.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No se pudo eliminar el proveedor.");
      toast.success("Proveedor eliminado.");
      setDeleteDialog({ open: false, provider: null });
      await loadProviders();
    } catch (error) {
      toast.error(error.message || "No se pudo eliminar el proveedor.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(provider) {
    if (!canEdit) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/proveedores/${provider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...provider, isActive: !provider.isActive }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No se pudo actualizar el proveedor.");
      setProviders((current) => current.map((item) => item.id === provider.id ? { ...item, isActive: !item.isActive } : item));
      toast.success("Estado actualizado.");
    } catch (error) {
      toast.error(error.message || "No se pudo actualizar el proveedor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 p-3 text-slate-950 md:h-svh sm:p-4">
      <header className="mb-3 flex shrink-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
          <Building2 className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold leading-tight text-violet-700">Gestion de Proveedores</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">Administra proveedores, contactos y datos comerciales</p>
        </div>
      </header>

      <section className="grid shrink-0 grid-cols-3 gap-2">
        <StatCard label="Total" value={stats.total} tone="border-blue-200 bg-blue-50 text-blue-700" />
        <StatCard label="Activos" value={stats.active} tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
        <StatCard label="Inactivos" value={stats.inactive} tone="border-red-200 bg-red-50 text-red-700" />
      </section>

      <section className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-violet-600 bg-white shadow-sm">
        <div className="flex shrink-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar razon social, RUC o contacto..."
              className="h-10 bg-white pl-9"
            />
          </div>
          {canCreate ? (
            <Button onClick={() => setDialog({ open: true, provider: null })} className="h-10 bg-violet-700 text-white hover:bg-violet-800">
              <Plus className="size-4" />
              Nuevo proveedor
            </Button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto border-t border-slate-200">
          <table className="w-full border-collapse text-left text-sm sm:min-w-[980px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Proveedor</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">RUC</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Contacto</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Direccion</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Activo</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                    <Loader2 className="mr-2 inline size-4 animate-spin" />
                    Cargando proveedores...
                  </td>
                </tr>
              ) : filteredProviders.length ? (
                filteredProviders.map((provider) => (
                  <tr key={provider.id} className="text-slate-800">
                    <td className="px-3 py-2.5">
                      <p className="font-bold">{provider.razonSocial}</p>
                      <div className="mt-0.5 text-xs text-slate-500">
                        <p>{provider.nombreComercial || "Sin nombre comercial"}</p>
                        <p className="sm:hidden">RUC: {provider.ruc || "-"}</p>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 font-semibold text-slate-600 sm:table-cell">{provider.ruc || "-"}</td>
                    <td className="hidden px-3 py-2.5 lg:table-cell">
                      <p className="font-medium">{provider.contactoNombre || "-"}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="size-3" />
                        {provider.contactoTelefono || "-"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Mail className="size-3" />
                        {provider.contactoEmail || "-"}
                      </p>
                    </td>
                    <td className="hidden max-w-64 px-3 py-2.5 text-xs text-slate-500 lg:table-cell">{provider.direccion || "-"}</td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <Switch checked={provider.isActive} disabled={!canEdit || saving} onCheckedChange={() => toggleActive(provider)} className="data-checked:bg-violet-700" />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        {canEdit ? (
                          <Button variant="outline" size="icon-sm" onClick={() => setDialog({ open: true, provider })}>
                            <Edit3 className="size-4" />
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button variant="destructive" size="icon-sm" onClick={() => setDeleteDialog({ open: true, provider })}>
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                    No hay proveedores para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {dialog.open ? (
        <ProviderDialog
          open={dialog.open}
          provider={dialog.provider}
          saving={saving}
          onClose={() => setDialog({ open: false, provider: null })}
          onSubmit={saveProvider}
        />
      ) : null}

      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, provider: null })}>
        <DialogContent className="bg-white text-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar proveedor</DialogTitle>
            <DialogDescription>
              Esta accion eliminara a {deleteDialog.provider?.razonSocial || "este proveedor"}. Confirma para continuar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, provider: null })}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteProvider} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ProviderDialog({ open, provider, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(provider || emptyProvider);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-[min(96vw,760px)] overflow-hidden bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-slate-200 px-5 py-4">
          <DialogTitle className="text-base font-bold text-violet-700">{provider?.id ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>Completa los datos comerciales y de contacto.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex max-h-[calc(92svh-90px)] flex-col">
          <div className="grid gap-3 overflow-y-auto p-4 sm:grid-cols-2">
            <Field label="Razon social *" value={form.razonSocial} onChange={(value) => update("razonSocial", value)} required />
            <Field label="Nombre comercial" value={form.nombreComercial} onChange={(value) => update("nombreComercial", value)} />
            <Field label="RUC" value={form.ruc} onChange={(value) => update("ruc", value)} />
            <Field label="Contacto" value={form.contactoNombre} onChange={(value) => update("contactoNombre", value)} />
            <Field label="Telefono" value={form.contactoTelefono} onChange={(value) => update("contactoTelefono", value)} />
            <Field label="Email" value={form.contactoEmail} onChange={(value) => update("contactoEmail", value)} type="email" />
            <div className="space-y-1 sm:col-span-2">
              <Label>Direccion</Label>
              <Textarea rows={3} value={form.direccion || ""} onChange={(event) => update("direccion", event.target.value)} />
            </div>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700">Proveedor activo</span>
              <Switch checked={form.isActive} onCheckedChange={(checked) => update("isActive", Boolean(checked))} className="data-checked:bg-violet-700" />
            </label>
          </div>
          <DialogFooter className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-violet-700 text-white hover:bg-violet-800" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} required={required} />
    </div>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <p className="text-[11px] font-bold">{label}</p>
      <p className="text-xl font-black leading-tight text-slate-950">{value}</p>
    </div>
  );
}
