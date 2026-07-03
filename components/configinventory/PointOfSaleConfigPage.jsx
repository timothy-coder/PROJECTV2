"use client";

import { useMemo, useState } from "react";
import { Edit3, Loader2, Plus, RefreshCw, Search, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePointOfSaleConfig } from "@/hooks/usePointOfSaleConfig";
import { hasPerm } from "@/lib/permissions";

export default function PointOfSaleConfigPage({ userPermissions }) {
  const data = usePointOfSaleConfig();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null });
  const canView = hasPerm(userPermissions, ["config_puntoventa", "view"]);
  const canCreate = hasPerm(userPermissions, ["config_puntoventa", "create"]);
  const canEdit = hasPerm(userPermissions, ["config_puntoventa", "edit"]);
  const canDelete = hasPerm(userPermissions, ["config_puntoventa", "delete"]);

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return data.items;
    return data.items.filter((item) => `${item.codigo} ${item.nombre} ${item.centroNombre} ${item.mostradorNombre} ${item.descripcion}`.toLowerCase().includes(clean));
  }, [data.items, query]);

  if (!canView) return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver configuracion de Punto de Venta.</div>;

  async function submit(payload) {
    try {
      if (dialog.item) await data.update(dialog.item.id, payload);
      else await data.create(payload);
      setDialog({ open: false, item: null });
      toast.success("Punto de venta guardado");
    } catch (error) {
      toast.error(error.message || "No se pudo guardar.");
    }
  }

  async function confirmDelete() {
    try {
      await data.delete(deleteDialog.item.id);
      setDeleteDialog({ open: false, item: null });
      toast.success("Punto de venta eliminado");
    } catch (error) {
      toast.error(error.message || "No se pudo eliminar.");
    }
  }

  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-violet-700 text-white">
            <Store className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-950">Configuracion de Punto de Venta</h1>
            <p className="text-xs font-medium text-slate-500">Gestiona puntos, cajas o terminales para ventas</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={data.reload}><RefreshCw className="size-4" />Recargar</Button>
          {canCreate ? <Button type="button" onClick={() => setDialog({ open: true, item: null })} className="bg-violet-700 text-white hover:bg-violet-800"><Plus className="size-4" />Nuevo</Button> : null}
        </div>
      </div>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="w-fit rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{data.stats.total} puntos registrados</span>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar punto de venta..." className="h-10 bg-white pl-9" />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="min-h-0 overflow-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-3">Codigo</th>
                <th className="px-3 py-3">Nombre</th>
                <th className="px-3 py-3">Centro</th>
                <th className="px-3 py-3">Mostrador</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Descripcion</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.loading ? (
                <tr><td colSpan={7} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
              ) : filtered.length ? filtered.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 font-bold text-violet-700">{item.codigo}</td>
                  <td className="px-3 py-3 font-bold text-slate-950">{item.nombre}</td>
                  <td className="px-3 py-3">{item.centroNombre || "-"}</td>
                  <td className="px-3 py-3">{item.mostradorNombre || "-"}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.activo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.activo ? "Activo" : "Inactivo"}</span></td>
                  <td className="max-w-[300px] truncate px-3 py-3 text-slate-600">{item.descripcion || "-"}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      {canEdit ? <Button type="button" variant="outline" size="icon" onClick={() => setDialog({ open: true, item })}><Edit3 className="size-4" /></Button> : null}
                      {canDelete ? <Button type="button" variant="destructive" size="icon" onClick={() => setDeleteDialog({ open: true, item })}><Trash2 className="size-4" /></Button> : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="py-10 text-center text-slate-500">No hay puntos de venta registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {dialog.open ? <PointDialog item={dialog.item} options={data.options} onClose={() => setDialog({ open: false, item: null })} onSubmit={submit} /> : null}
      <DeleteDialog state={deleteDialog} onClose={() => setDeleteDialog({ open: false, item: null })} onConfirm={confirmDelete} />
    </div>
  );
}

function PointDialog({ item, options, onClose, onSubmit }) {
  const [form, setForm] = useState({
    codigo: item?.codigo || "",
    nombre: item?.nombre || "",
    centroId: item?.centroId ? String(item.centroId) : "",
    mostradorId: item?.mostradorId ? String(item.mostradorId) : "",
    descripcion: item?.descripcion || "",
    activo: item?.activo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const centerOptions = options.centers.map((row) => ({ value: row.id, label: row.nombre }));
  const counterOptions = options.counters.filter((row) => !form.centroId || Number(row.centroId) === Number(form.centroId)).map((row) => ({ value: row.id, label: row.nombre }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    await onSubmit(form);
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(96vw,560px)] bg-white text-slate-950">
        <form onSubmit={submit} className="space-y-3">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-violet-700">{item ? "Editar punto de venta" : "Nuevo punto de venta"}</DialogTitle>
            <DialogDescription>Configura la caja, terminal o punto operativo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Codigo *"><Input required value={form.codigo} onChange={(event) => setForm((current) => ({ ...current, codigo: event.target.value.toUpperCase() }))} /></Field>
            <Field label="Nombre *"><Input required value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} /></Field>
            <Field label="Centro"><SearchableSelect value={form.centroId} options={centerOptions} placeholder="Seleccionar centro" onChange={(centroId) => setForm((current) => ({ ...current, centroId, mostradorId: "" }))} /></Field>
            <Field label="Mostrador"><SearchableSelect value={form.mostradorId} options={counterOptions} placeholder="Seleccionar mostrador" onChange={(mostradorId) => setForm((current) => ({ ...current, mostradorId }))} /></Field>
          </div>
          <Field label="Descripcion"><Textarea value={form.descripcion} onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))} /></Field>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <div>
              <p className="text-sm font-bold">Activo</p>
              <p className="text-xs font-medium text-slate-500">Disponible para operar en punto de venta</p>
            </div>
            <Switch checked={form.activo} onCheckedChange={(activo) => setForm((current) => ({ ...current, activo }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700">{label}</Label>{children}</div>;
}

function DeleteDialog({ state, onClose, onConfirm }) {
  if (!state.open) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-red-600">Eliminar punto de venta</DialogTitle>
          <DialogDescription>Se eliminara {state.item?.nombre}.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>Eliminar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
