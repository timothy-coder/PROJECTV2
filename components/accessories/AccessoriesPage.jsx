"use client";

import { useMemo, useState } from "react";
import { Box, ChevronDown, Edit3, Filter, Loader2, Plus, Search, Trash2 } from "lucide-react";

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
import { useAccessories } from "@/hooks/accessories/useAccessories";
import { hasPerm } from "@/lib/permissions";

export default function AccessoriesPage({ userPermissions }) {
  const data = useAccessories();
  const [filters, setFilters] = useState({ query: "", marcaId: "", modeloId: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null });
  const canView = hasPerm(userPermissions, ["accesoriosventa", "view"]);
  const canCreate = hasPerm(userPermissions, ["accesoriosventa", "create"]);
  const canEdit = hasPerm(userPermissions, ["accesoriosventa", "edit"]);
  const canDelete = hasPerm(userPermissions, ["accesoriosventa", "delete"]);

  const filteredAccessories = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return data.accessories.filter((item) => {
      const matchesQuery = !query || `${item.detalle} ${item.numeroParte}`.toLowerCase().includes(query);
      const matchesBrand = !filters.marcaId || Number(filters.marcaId) === item.marcaId;
      const matchesModel = !filters.modeloId || Number(filters.modeloId) === item.modeloId;
      return matchesQuery && matchesBrand && matchesModel;
    });
  }, [data.accessories, filters]);

  const brandOptions = [{ value: "", label: "Todas" }, ...data.options.brands.map((item) => ({ value: item.id, label: item.name }))];
  const modelOptions = [
    { value: "", label: "Todos" },
    ...data.options.models
      .filter((item) => !filters.marcaId || Number(item.marcaId) === Number(filters.marcaId))
      .map((item) => ({ value: item.id, label: item.name })),
  ];

  if (!canView) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver accesorios.</div>;
  }

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 p-3 text-slate-950 md:h-svh sm:p-4">
      <div className="mb-3 flex shrink-0 flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
            <Box className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-violet-700">Accesorios</h1>
            <p className="mt-0.5 text-xs font-medium text-violet-400">Gestiona todos los accesorios disponibles</p>
          </div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 shrink-0 gap-2">
        <Stat label="Total" value={data.stats.total} icon={Box} />
        <Stat label="Impuestos" value={data.stats.taxes} icon={Filter} tone="orange" />
      </div>

      <section className="shrink-0 rounded-t-lg border border-b-0 border-violet-200 bg-white shadow-sm">
        <div className="space-y-2 px-3 py-2">
          <div className="grid gap-2 lg:grid-cols-[minmax(180px,1fr)_minmax(240px,300px)_minmax(280px,360px)_auto_auto] lg:items-end">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-600">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Detalle, numero de parte..." className="h-9 bg-white pl-9" />
              </div>
            </div>
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
              <Field label="Marca"><SearchableSelect value={filters.marcaId} options={brandOptions} placeholder="Todas" onChange={(value) => setFilters((current) => ({ ...current, marcaId: value, modeloId: "" }))} /></Field>
              <Field label="Modelo"><SearchableSelect value={filters.modeloId} options={modelOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, modeloId: value }))} /></Field>
              <Button variant="outline" className="h-9" onClick={() => setFilters({ query: "", marcaId: "", modeloId: "" })}>Limpiar</Button>
            </div>
            {canCreate ? (
              <Button onClick={() => setDialog({ open: true, item: null })} className="h-9 bg-violet-700 text-white hover:bg-violet-800">
                <Plus className="size-4" />
                Nuevo Accesorio
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-lg border border-violet-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-950">
              <tr>
                <th className="px-3 py-3">Detalle / N Parte</th>
                <th className="px-3 py-3">Marca / Modelo</th>
                <th className="px-3 py-3">Precios</th>
                <th className="px-3 py-3">Impuesto</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.loading ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
              ) : filteredAccessories.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-950">{item.detalle}</div>
                    <div className="mt-1 text-xs font-medium text-slate-500">N Parte: {item.numeroParte}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div><Badge>{item.marcaName}</Badge></div>
                    <div className="mt-1"><Badge>{item.modeloName}</Badge></div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-emerald-700">Compra: {item.monedaSimbolo} {item.precio.toFixed(2)}</div>
                    <div className="mt-1 font-bold text-blue-700">Venta: {item.monedaSimbolo} {(item.precioVenta ?? 0).toFixed(2)}</div>
                  </td>
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
          <span className="text-center font-medium">{filteredAccessories.length} de {data.accessories.length} registros</span>
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
        <AccessoryDialog
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
      <DeleteDialog
        state={deleteDialog}
        onClose={() => setDeleteDialog({ open: false, item: null })}
        onConfirm={async () => {
          await data.delete(deleteDialog.item.id);
          setDeleteDialog({ open: false, item: null });
        }}
      />
    </div>
  );
}

function AccessoryDialog({ state, options, onClose, onSubmit }) {
  const [form, setForm] = useState({
    marcaId: state.item?.marcaId ? String(state.item.marcaId) : "",
    modeloId: state.item?.modeloId ? String(state.item.modeloId) : "",
    detalle: state.item?.detalle || "",
    numeroParte: state.item?.numeroParte || "",
    precio: state.item?.precio ?? "",
    precioVenta: state.item?.precioVenta ?? "",
    impuestoId: state.item?.impuestoId ? String(state.item.impuestoId) : "",
    monedaId: state.item?.monedaId ? String(state.item.monedaId) : "",
  });
  const [error, setError] = useState("");
  const brandOptions = options.brands.map((item) => ({ value: item.id, label: item.name }));
  const modelOptions = options.models.filter((item) => !form.marcaId || Number(item.marcaId) === Number(form.marcaId)).map((item) => ({ value: item.id, label: item.name }));
  const currencyOptions = options.currencies.map((item) => ({ value: item.id, label: `${item.codigo} ${item.simbolo}` }));
  const taxOptions = [{ value: "", label: "Sin impuesto" }, ...options.taxes.map((item) => ({ value: item.id, label: `${item.nombre} (${item.porcentaje}%)` }))];

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message || "No se pudo guardar el accesorio.");
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(94vw,560px)] overflow-y-auto bg-white text-slate-950">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-violet-700">{state.item ? "Editar accesorio" : "Nuevo accesorio"}</DialogTitle>
            <DialogDescription>Completa los datos del accesorio.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Marca *"><SearchableSelect value={form.marcaId} options={brandOptions} placeholder="Seleccionar marca" onChange={(value) => setForm((current) => ({ ...current, marcaId: value, modeloId: "" }))} /></Field>
            <Field label="Modelo *"><SearchableSelect value={form.modeloId} options={modelOptions} placeholder="Seleccionar modelo" onChange={(value) => setForm((current) => ({ ...current, modeloId: value }))} /></Field>
            <Field label="Detalle *"><Input value={form.detalle} onChange={(event) => setForm((current) => ({ ...current, detalle: event.target.value }))} required /></Field>
            <Field label="Numero de parte *"><Input value={form.numeroParte} onChange={(event) => setForm((current) => ({ ...current, numeroParte: event.target.value }))} required /></Field>
            <Field label="Precio compra *"><Input type="number" step="0.01" value={form.precio} onChange={(event) => setForm((current) => ({ ...current, precio: event.target.value }))} required /></Field>
            <Field label="Precio venta"><Input type="number" step="0.01" value={form.precioVenta} onChange={(event) => setForm((current) => ({ ...current, precioVenta: event.target.value }))} /></Field>
            <Field label="Moneda *"><SearchableSelect value={form.monedaId} options={currencyOptions} placeholder="Seleccionar moneda" onChange={(value) => setForm((current) => ({ ...current, monedaId: value }))} /></Field>
            <Field label="Impuesto"><SearchableSelect value={form.impuestoId} options={taxOptions} placeholder="Sin impuesto" onChange={(value) => setForm((current) => ({ ...current, impuestoId: value }))} /></Field>
          </div>
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
          <DialogDescription>
            ¿Seguro que deseas eliminar {state.item?.detalle}? Esta accion no se puede deshacer.
          </DialogDescription>
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
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
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

function Badge({ children }) {
  return <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-950">{children}</span>;
}

function Field({ label, children }) {
  return <div className="space-y-1"><Label className="text-[11px] font-bold text-slate-600">{label}</Label>{children}</div>;
}
