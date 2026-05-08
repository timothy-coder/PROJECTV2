"use client";

import { useMemo, useState } from "react";
import { Edit3, Filter, Gift, Loader2, Plus, Search, Store, Trash2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { useGifts } from "@/hooks/gifts/useGifts";
import { hasPerm } from "@/lib/permissions";

export default function GiftsPage({ userPermissions }) {
  const data = useGifts();
  const [filters, setFilters] = useState({ query: "", monedaId: "", impuestoId: "", regaloTienda: "" });
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null });
  const canView = hasPerm(userPermissions, ["regalosventa", "view"]);
  const canCreate = hasPerm(userPermissions, ["regalosventa", "create"]);
  const canEdit = hasPerm(userPermissions, ["regalosventa", "edit"]);
  const canDelete = hasPerm(userPermissions, ["regalosventa", "delete"]);

  const filteredGifts = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return data.gifts.filter((item) => {
      const matchesQuery = !query || `${item.detalle} ${item.lote}`.toLowerCase().includes(query);
      const matchesCurrency = !filters.monedaId || Number(filters.monedaId) === item.monedaId;
      const matchesTax = !filters.impuestoId || Number(filters.impuestoId) === item.impuestoId;
      const matchesStore = filters.regaloTienda === "" || String(item.regaloTienda) === filters.regaloTienda;
      return matchesQuery && matchesCurrency && matchesTax && matchesStore;
    });
  }, [data.gifts, filters]);

  const currencyOptions = [{ value: "", label: "Todas" }, ...data.options.currencies.map((item) => ({ value: item.id, label: item.codigo }))];
  const taxOptions = [{ value: "", label: "Todos" }, ...data.options.taxes.map((item) => ({ value: item.id, label: `${item.nombre} (${item.porcentaje}%)` }))];
  const storeOptions = [{ value: "", label: "Todos" }, { value: "true", label: "Si" }, { value: "false", label: "No" }];

  if (!canView) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver regalos.</div>;
  }

  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Gift className="size-8 text-violet-700" />
          <div>
            <h1 className="text-3xl font-bold leading-none text-violet-700">Regalos</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">Gestiona todos los regalos disponibles</p>
          </div>
        </div>
        {canCreate ? (
          <Button onClick={() => setDialog({ open: true, item: null })} className="bg-violet-700 text-white hover:bg-violet-800">
            <Plus className="size-4" />
            Nuevo Regalo
          </Button>
        ) : null}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Stat label="Total" value={data.stats.total} icon={Gift} />
        <Stat label="De Tienda" value={data.stats.store} icon={Store} />
        <Stat label="Monedas" value={data.stats.currencies} icon={Filter} tone="orange" />
        <Stat label="Impuestos" value={data.stats.taxes} icon={Filter} tone="orange" />
      </div>

      <section className="mb-4 rounded-lg border border-violet-200 bg-white shadow-sm">
        <div className="bg-violet-50/40 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-violet-700"><Filter className="size-5" />Filtros</h2>
        </div>
        <div className="space-y-3 p-4">
          <Field label="Buscar">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Detalle, lote..." className="h-9 bg-white pl-9" />
            </div>
          </Field>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Moneda"><SearchableSelect value={filters.monedaId} options={currencyOptions} placeholder="Todas" onChange={(value) => setFilters((current) => ({ ...current, monedaId: value }))} /></Field>
            <Field label="Impuesto"><SearchableSelect value={filters.impuestoId} options={taxOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, impuestoId: value }))} /></Field>
            <Field label="Regalo Tienda"><SearchableSelect value={filters.regaloTienda} options={storeOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, regaloTienda: value }))} /></Field>
            <div className="flex items-end"><Button variant="outline" className="h-9 w-full" onClick={() => setFilters({ query: "", monedaId: "", impuestoId: "", regaloTienda: "" })}>Limpiar</Button></div>
          </div>
          <p className="text-sm font-medium text-slate-500">Mostrando {filteredGifts.length} de {data.gifts.length} regalos</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-violet-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-950">
              <tr>
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">Detalle</th>
                <th className="px-3 py-3">Lote</th>
                <th className="px-3 py-3">Precio Compra</th>
                <th className="px-3 py-3">Precio Venta</th>
                <th className="px-3 py-3">Tienda</th>
                <th className="px-3 py-3">Impuesto</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
              ) : filteredGifts.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 font-bold text-violet-700">#{item.id}</td>
                  <td className="px-3 py-3 font-medium">{item.detalle}</td>
                  <td className="px-3 py-3">{item.lote || "-"}</td>
                  <td className="px-3 py-3 font-bold text-emerald-700">{item.monedaSimbolo} {item.precioCompra.toFixed(2)}</td>
                  <td className="px-3 py-3 font-bold text-blue-700">{item.monedaSimbolo} {(item.precioVenta ?? 0).toFixed(2)}</td>
                  <td className="px-3 py-3">{item.regaloTienda ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Si</span> : "No"}</td>
                  <td className="px-3 py-3">{item.impuestoName ? `${item.impuestoName} (${item.impuestoPorcentaje}%)` : "Sin impuesto"}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      {canEdit ? <Button variant="outline" size="icon" onClick={() => setDialog({ open: true, item })}><Edit3 className="size-4" /></Button> : null}
                      {canDelete ? <Button variant="destructive" size="icon" onClick={() => setDeleteDialog({ open: true, item })}><Trash2 className="size-4" /></Button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {dialog.open ? (
        <GiftDialog
          key={dialog.item?.id || "new"}
          state={dialog}
          options={data.options}
          onClose={() => setDialog({ open: false, item: null })}
          onSubmit={async (payload) => {
            if (dialog.item) await data.update(dialog.item.id, payload);
            else await data.create(payload);
            setDialog({ open: false, item: null });
          }}
        />
      ) : null}
      <DeleteDialog state={deleteDialog} onClose={() => setDeleteDialog({ open: false, item: null })} onConfirm={async () => { await data.delete(deleteDialog.item.id); setDeleteDialog({ open: false, item: null }); }} />
    </div>
  );
}

function GiftDialog({ state, options, onClose, onSubmit }) {
  const [form, setForm] = useState({
    detalle: state.item?.detalle || "",
    lote: state.item?.lote || "",
    precioCompra: state.item?.precioCompra ?? "",
    precioVenta: state.item?.precioVenta ?? "",
    impuestoId: state.item?.impuestoId ? String(state.item.impuestoId) : "",
    regaloTienda: state.item?.regaloTienda || false,
    monedaId: state.item?.monedaId ? String(state.item.monedaId) : "",
  });
  const [error, setError] = useState("");
  const currencyOptions = options.currencies.map((item) => ({ value: item.id, label: `${item.codigo} ${item.simbolo}` }));
  const taxOptions = [{ value: "", label: "Sin impuesto" }, ...options.taxes.map((item) => ({ value: item.id, label: `${item.nombre} (${item.porcentaje}%)` }))];

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message || "No se pudo guardar el regalo.");
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(94vw,480px)] overflow-y-auto bg-white text-slate-950">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-violet-700">{state.item ? "Editar regalo" : "Nuevo regalo"}</DialogTitle>
            <DialogDescription>Completa los datos del regalo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Detalle *"><Input value={form.detalle} onChange={(event) => setForm((current) => ({ ...current, detalle: event.target.value }))} required /></Field>
            <Field label="Lote"><Input value={form.lote} onChange={(event) => setForm((current) => ({ ...current, lote: event.target.value }))} /></Field>
            <Field label="Precio compra *"><Input type="number" step="0.01" value={form.precioCompra} onChange={(event) => setForm((current) => ({ ...current, precioCompra: event.target.value }))} required /></Field>
            <Field label="Precio venta"><Input type="number" step="0.01" value={form.precioVenta} onChange={(event) => setForm((current) => ({ ...current, precioVenta: event.target.value }))} /></Field>
            <Field label="Moneda *"><SearchableSelect value={form.monedaId} options={currencyOptions} placeholder="Seleccionar moneda" onChange={(value) => setForm((current) => ({ ...current, monedaId: value }))} /></Field>
            <Field label="Impuesto"><SearchableSelect value={form.impuestoId} options={taxOptions} placeholder="Sin impuesto" onChange={(value) => setForm((current) => ({ ...current, impuestoId: value }))} /></Field>
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
            <Switch checked={form.regaloTienda} onCheckedChange={(checked) => setForm((current) => ({ ...current, regaloTienda: Boolean(checked) }))} />
            <span><span className="block text-sm font-bold text-violet-700">Regalo tienda</span><span className="text-xs text-slate-500">Disponible como regalo de tienda</span></span>
          </label>
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-violet-700 text-white hover:bg-violet-800">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ state, onClose, onConfirm }) {
  if (!state.open) return null;
  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-red-600">Eliminar regalo</DialogTitle>
          <DialogDescription>Se eliminara {state.item?.detalle}.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm}>Eliminar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, icon: Icon, tone = "purple" }) {
  const tones = {
    purple: "border-violet-200 bg-violet-50 text-violet-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
  };
  return (
    <div className={`flex min-h-24 items-center justify-between rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
      <div><p className="text-xs font-bold">{label}</p><p className="mt-3 text-2xl font-bold text-violet-700">{value}</p></div>
      <Icon className="size-8 opacity-45" />
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">{label}</Label>{children}</div>;
}
