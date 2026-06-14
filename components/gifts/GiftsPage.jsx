"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Edit3, Filter, Gift, Loader2, Plus, Search, Store, Trash2 } from "lucide-react";

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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 p-3 text-slate-950 md:h-svh sm:p-4">
      <div className="mb-3 flex shrink-0 flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
            <Gift className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-violet-700">Regalos</h1>
            <p className="mt-0.5 text-xs font-medium text-violet-400">Gestiona todos los regalos disponibles</p>
          </div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 shrink-0 gap-2">
        <Stat label="Total" value={data.stats.total} icon={Gift} />
        <Stat label="De Tienda" value={data.stats.store} icon={Store} />
        <Stat label="Impuestos" value={data.stats.taxes} icon={Filter} tone="orange" />
      </div>

      <section className="shrink-0 rounded-t-lg border border-b-0 border-violet-200 bg-white shadow-sm">
        <div className="space-y-2 px-3 py-2">
          <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_130px_160px_140px_auto_auto] lg:items-end">
            <Field label="Buscar">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Detalle, lote..." className="h-9 bg-white pl-9" />
              </div>
            </Field>
            <Button
              type="button"
              variant="outline"
              className="h-9 lg:hidden"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              Filtros
              <ChevronDown className={`size-4 transition ${filtersOpen ? "rotate-180" : ""}`} />
            </Button>
            <div className={`${filtersOpen ? "grid" : "hidden"} gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 lg:contents`}>
              <Field label="Moneda"><SearchableSelect value={filters.monedaId} options={currencyOptions} placeholder="Todas" onChange={(value) => setFilters((current) => ({ ...current, monedaId: value }))} /></Field>
              <Field label="Impuesto"><SearchableSelect value={filters.impuestoId} options={taxOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, impuestoId: value }))} /></Field>
              <Field label="Regalo Tienda"><SearchableSelect value={filters.regaloTienda} options={storeOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, regaloTienda: value }))} /></Field>
              <Button variant="outline" className="h-9" onClick={() => setFilters({ query: "", monedaId: "", impuestoId: "", regaloTienda: "" })}>Limpiar</Button>
            </div>
            {canCreate ? (
              <Button onClick={() => setDialog({ open: true, item: null })} className="h-9 bg-violet-700 text-white hover:bg-violet-800">
                <Plus className="size-4" />
                Nuevo Regalo
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-lg border border-violet-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-950">
              <tr>
                <th className="px-3 py-3">Detalle / Lote</th>
                <th className="px-3 py-3">Precios</th>
                <th className="px-3 py-3">Tienda</th>
                <th className="px-3 py-3">Impuesto</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.loading ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
              ) : filteredGifts.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-950">{item.detalle}</div>
                    <div className="mt-1 text-xs font-medium text-slate-500">Lote: {item.lote || "-"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-emerald-700">Compra: {item.monedaSimbolo} {item.precioCompra.toFixed(2)}</div>
                    <div className="mt-1 font-bold text-blue-700">Venta: {item.monedaSimbolo} {(item.precioVenta ?? 0).toFixed(2)}</div>
                  </td>
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
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          <span className="font-medium">Pagina 1 de 1</span>
          <span className="text-center font-medium">{filteredGifts.length} de {data.gifts.length} registros</span>
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
          <DialogTitle className="text-lg font-bold text-red-600">Confirmar eliminacion</DialogTitle>
          <DialogDescription>¿Seguro que deseas eliminar {state.item?.detalle}? Esta accion no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm}>Si, eliminar</Button>
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
    <div className={`flex items-center justify-between rounded-lg border px-2 py-2 sm:px-3 ${tones[tone]}`}>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold leading-4 sm:text-[11px]">{label}</p>
        <p className="mt-0.5 text-xl font-bold leading-6 text-violet-700">{value}</p>
      </div>
      <Icon className="hidden size-5 shrink-0 opacity-50 sm:block" />
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1"><Label className="text-[11px] font-bold text-slate-600">{label}</Label>{children}</div>;
}
