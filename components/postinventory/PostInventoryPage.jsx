"use client";

import { useMemo, useState } from "react";
import { Boxes, Edit3, Eye, Loader2, MapPin, Package, Plus, RefreshCw, Search, Settings2, Trash2, TrendingUp, TriangleAlert } from "lucide-react";

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
import { usePostInventory } from "@/hooks/postinventory/usePostInventory";
import { hasPerm } from "@/lib/permissions";

export default function PostInventoryPage({ userPermissions }) {
  const data = usePostInventory();
  const [query, setQuery] = useState("");
  const [minStock, setMinStock] = useState(5);
  const [productDialog, setProductDialog] = useState({ open: false, item: null, readonly: false });
  const [stockDialog, setStockDialog] = useState({ open: false, product: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, title: "", onConfirm: null });
  const canView = hasPerm(userPermissions, ["inventario", "view"]);
  const canCreate = hasPerm(userPermissions, ["inventario", "create"]);
  const canEdit = hasPerm(userPermissions, ["inventario", "edit"]);
  const canDelete = hasPerm(userPermissions, ["inventario", "delete"]);

  const filteredProducts = useMemo(() => {
    const clean = query.trim().toLowerCase();
    const filtered = clean
      ? data.products.filter((product) => `${product.numeroParte} ${product.descripcion}`.toLowerCase().includes(clean))
      : data.products;
    return filtered.map((product) => ({
      ...product,
      available: Number(product.stockDisponible ?? product.stock.reduce((sum, item) => sum + Number(item.stock || 0), 0)),
    }));
  }, [data.products, query]);
  const lowStock = filteredProducts.filter((product) => product.available <= Number(minStock)).length;

  if (!canView) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver inventario.</div>;
  }

  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-violet-700 text-white">
            <Package className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Inventario</h1>
            <p className="text-xs font-medium text-slate-500">Gestion de productos y stock</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={data.reload}><RefreshCw className="size-4" />Recargar</Button>
          {canCreate ? <Button onClick={() => setProductDialog({ open: true, item: null, readonly: false })} className="bg-violet-700 text-white hover:bg-violet-800"><Plus className="size-4" />Nuevo Producto</Button> : null}
        </div>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-4">
        <Stat label="Total Productos" value={data.stats.products} tone="blue" icon={Package} />
        <Stat label="Stock Total" value={data.stats.totalStock} tone="green" icon={TrendingUp} />
        <Stat label="Stock Bajo" value={lowStock} tone="red" icon={TriangleAlert} />
        <Stat label="Valor Total" value={`S/ ${data.stats.totalValue.toFixed(2)}`} tone="purple" icon={TrendingUp} />
      </div>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-950"><Settings2 className="size-4" />Filtros y busqueda</h2>
        </div>
        <div className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_320px]">
          <div className="space-y-1.5">
            <Label>Buscar producto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por N parte o descripcion..." className="h-9 bg-white pl-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Minimo stock</Label>
            <Input type="number" value={minStock} onChange={(event) => setMinStock(event.target.value)} className="h-9 bg-white" />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-3">N Parte</th>
                <th className="px-3 py-3">Descripcion</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">Disponible</th>
                <th className="px-3 py-3">Precio Venta</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.loading ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
              ) : filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-3 py-3 font-bold text-slate-950">{product.numeroParte}</td>
                  <td className="px-3 py-3">{product.descripcion}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{product.tipoNombre}</span></td>
                  <td className="px-3 py-3 font-bold text-emerald-700">{product.available}</td>
                  <td className="px-3 py-3">S/ {product.precioVenta.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setProductDialog({ open: true, item: product, readonly: true })}><Eye className="size-4" /></Button>
                      {canEdit ? <Button variant="ghost" size="icon" onClick={() => setProductDialog({ open: true, item: product, readonly: false })}><Edit3 className="size-4" /></Button> : null}
                      {canEdit ? <Button variant="ghost" size="icon" onClick={() => setStockDialog({ open: true, product })}><Boxes className="size-4" /></Button> : null}
                      {canDelete ? <Button variant="destructive" size="icon" onClick={() => setDeleteDialog({ open: true, title: `Eliminar ${product.numeroParte}`, onConfirm: () => data.deleteProduct(product.id) })}><Trash2 className="size-4" /></Button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
          <span>Pagina 1 de 1 - {filteredProducts.length} de {data.products.length} productos</span>
          <div className="flex gap-2"><Button variant="outline" disabled>Anterior</Button><Button variant="outline" disabled>Siguiente</Button></div>
        </div>
      </section>

      {productDialog.open ? (
        <ProductDialog
          key={`${productDialog.item?.id || "new"}-${productDialog.readonly}`}
          state={productDialog}
          options={data.options}
          onClose={() => setProductDialog({ open: false, item: null, readonly: false })}
          onSubmit={async (payload) => {
            if (productDialog.item) await data.updateProduct(productDialog.item.id, payload);
            else await data.createProduct(payload);
            setProductDialog({ open: false, item: null, readonly: false });
          }}
        />
      ) : null}
      {stockDialog.open ? <StockDistributionDialog state={stockDialog} options={data.options} actions={data} onClose={() => setStockDialog({ open: false, product: null })} /> : null}
      <DeleteDialog state={deleteDialog} onClose={() => setDeleteDialog({ open: false, title: "", onConfirm: null })} />
    </div>
  );
}

function ProductDialog({ state, options, onClose, onSubmit }) {
  const readonly = state.readonly;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    numeroParte: state.item?.numeroParte || "",
    descripcion: state.item?.descripcion || "",
    tipoId: state.item?.tipoId ? String(state.item.tipoId) : "",
    fechaIngreso: state.item?.fechaIngreso ? String(state.item.fechaIngreso).slice(0, 10) : "",
    stockTotal: state.item?.stockTotal || "",
    precioCompra: state.item?.precioCompra || "",
    precioVenta: state.item?.precioVenta || "",
  });
  const typeOptions = (options?.types || []).map((item) => ({ value: item.id, label: item.nombre }));

  async function submit(event) {
    event.preventDefault();
    if (readonly) return onClose();
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        tipoId: form.tipoId || null,
        fechaIngreso: form.fechaIngreso || null,
        stockTotal: form.stockTotal || 0,
        precioCompra: form.precioCompra || 0,
        precioVenta: form.precioVenta || 0,
      });
    } catch (err) {
      setError(err.message || "No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(94vw,430px)] overflow-y-auto bg-white p-0 text-slate-950">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-violet-100 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700"><Package className="size-5" />{readonly ? "Detalle" : state.item ? "Editar" : "Nuevo"} producto</DialogTitle>
            <DialogDescription>Completa la informacion y guarda</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Panel number="1" title="Informacion General">
              <Field label="Numero de parte *"><Input disabled={readonly} value={form.numeroParte} placeholder="Ej: ABC-12345" onChange={(e) => setForm((f) => ({ ...f, numeroParte: e.target.value }))} required /></Field>
              <Field label="Descripcion *"><Input disabled={readonly} value={form.descripcion} placeholder="Descripcion del producto" onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} required /></Field>
            </Panel>
            <Panel number="2" title="Clasificacion">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo de inventario">
                  <SearchableSelect
                    disabled={readonly}
                    value={form.tipoId}
                    options={typeOptions}
                    placeholder={typeOptions.length ? "Seleccionar tipo" : "Sin tipos cargados"}
                    searchPlaceholder="Buscar tipo..."
                    emptyText="No hay tipos de inventario."
                    onChange={(value) => setForm((f) => ({ ...f, tipoId: value }))}
                  />
                </Field>
                <Field label="Fecha ingreso"><Input disabled={readonly} type="date" value={form.fechaIngreso} onChange={(e) => setForm((f) => ({ ...f, fechaIngreso: e.target.value }))} /></Field>
              </div>
            </Panel>
            <Panel number="3" title="Precios">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Stock total"><Input disabled={readonly} type="number" value={form.stockTotal} onChange={(e) => setForm((f) => ({ ...f, stockTotal: e.target.value }))} /></Field>
                <Field label="Precio compra"><Input disabled={readonly} type="number" step="0.01" value={form.precioCompra} onChange={(e) => setForm((f) => ({ ...f, precioCompra: e.target.value }))} /></Field>
                <Field label="Precio venta"><Input disabled={readonly} type="number" step="0.01" value={form.precioVenta} onChange={(e) => setForm((f) => ({ ...f, precioVenta: e.target.value }))} /></Field>
              </div>
            </Panel>
            {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</p> : null}
          </div>
          <DialogFooter className="border-t border-slate-200 p-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            {!readonly ? <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">{saving ? "Guardando..." : "Guardar"}</Button> : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StockDistributionDialog({ state, options, actions, onClose }) {
  const product = state.product;
  const assigned = product.stock.reduce((sum, item) => sum + Number(item.stock || 0), 0);
  const available = Math.max(Number(product.stockTotal || 0) - assigned, 0);
  const [locationDialog, setLocationDialog] = useState({ open: false, item: null });

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(94vw,430px)] overflow-y-auto bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-violet-100 p-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700"><Package className="size-5" />Distribucion de Stock</DialogTitle>
          <DialogDescription>Numero de parte: {product.numeroParte}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Total Producto" value={product.stockTotal} />
            <MiniStat label="Asignado" value={assigned} />
            <MiniStat label="Disponible" value={available} />
          </div>
          <Button onClick={() => setLocationDialog({ open: true, item: null })} className="w-full bg-violet-700 text-white hover:bg-violet-800"><Plus className="size-4" />Nueva ubicacion</Button>
          <div className="space-y-2">
            {product.stock.map((stock) => (
              <div key={stock.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-violet-700">{stockLabel(stock)}</p>
                  <p className="text-xs font-medium text-slate-500">Centro: {stock.centroName}</p>
                </div>
                <div className="rounded-md bg-violet-100 px-3 py-2 text-center text-violet-700"><p className="text-xs">Stock</p><p className="font-bold">{stock.stock}</p></div>
                <Button variant="outline" size="icon" onClick={() => setLocationDialog({ open: true, item: stock })}><Edit3 className="size-4" /></Button>
                <Button variant="destructive" size="icon" onClick={() => actions.deleteStock(stock.id)}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="border-t border-slate-200 p-3"><Button variant="outline" onClick={onClose}>Cerrar</Button></DialogFooter>
        {locationDialog.open ? (
          <LocationDialog
            state={locationDialog}
            product={product}
            options={options}
            assigned={assigned}
            available={available}
            onClose={() => setLocationDialog({ open: false, item: null })}
            onSubmit={async (payload) => {
              if (locationDialog.item) await actions.updateStock(locationDialog.item.id, payload);
              else await actions.createStock(payload);
              setLocationDialog({ open: false, item: null });
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LocationDialog({ state, product, options, assigned, available, onClose, onSubmit }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    centroId: state.item?.centroId ? String(state.item.centroId) : "",
    tallerId: state.item?.tallerId ? String(state.item.tallerId) : "",
    mostradorId: state.item?.mostradorId ? String(state.item.mostradorId) : "",
    stock: state.item?.stock || 0,
  });
  const centerOptions = options.centers.map((item) => ({ value: item.id, label: item.nombre }));
  const workshopOptions = options.workshops.filter((item) => !form.centroId || Number(item.centroId) === Number(form.centroId)).map((item) => ({ value: item.id, label: item.nombre }));
  const counterOptions = options.counters.filter((item) => !form.centroId || Number(item.centroId) === Number(form.centroId)).map((item) => ({ value: item.id, label: item.nombre }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit({ ...form, productoId: product.id });
    } catch (err) {
      setError(err.message || "No se pudo guardar la ubicacion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(94vw,430px)] bg-white p-0 text-slate-950">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-violet-100 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700"><MapPin className="size-5" />{state.item ? "Editar" : "Nueva"} ubicacion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Panel number="1" title="Ubicacion">
              <Field label="Centro *"><SearchableSelect value={form.centroId} options={centerOptions} placeholder="Seleccione centro" onChange={(value) => setForm((f) => ({ ...f, centroId: value, tallerId: "", mostradorId: "" }))} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Taller"><SearchableSelect value={form.tallerId} options={workshopOptions} disabled={Boolean(form.mostradorId)} placeholder="Seleccione taller" onChange={(value) => setForm((f) => ({ ...f, tallerId: value, mostradorId: "" }))} /></Field>
                <Field label="Mostrador"><SearchableSelect value={form.mostradorId} options={counterOptions} disabled={Boolean(form.tallerId)} placeholder="Seleccione mostrador" onChange={(value) => setForm((f) => ({ ...f, mostradorId: value, tallerId: "" }))} /></Field>
              </div>
              <p className="rounded-md bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">Selecciona solo un Taller o un Mostrador, no ambos.</p>
            </Panel>
            <Panel number="2" title="Stock">
              <Field label="Cantidad a asignar *"><Input type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} required /></Field>
            </Panel>
            <Panel number="" title="Informacion de Stock">
              <div className="grid grid-cols-2 gap-2 text-center">
                <MiniStat label="Total Producto" value={product.stockTotal} />
                <MiniStat label="Usado" value={assigned} />
                <MiniStat label="Disponible" value={available} />
              </div>
            </Panel>
            {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</p> : null}
          </div>
          <DialogFooter className="border-t border-slate-200 p-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ state, onClose }) {
  if (!state.open) return null;
  async function confirm() {
    await state.onConfirm?.();
    onClose();
  }
  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-white text-slate-950">
        <DialogHeader><DialogTitle className="text-lg font-bold text-red-600">{state.title}</DialogTitle><DialogDescription>Esta accion no se puede deshacer.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button variant="destructive" onClick={confirm}>Eliminar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Panel({ number, title, children }) {
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-violet-700">{number ? <span className="flex size-6 items-center justify-center rounded-full bg-violet-700 text-xs text-white">{number}</span> : null}{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label className="text-xs font-bold text-violet-700">{label}</Label>{children}</div>;
}

function Stat({ label, value, tone, icon: Icon }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    purple: "border-violet-200 bg-violet-50 text-violet-700",
  };
  return <div className={`flex min-h-24 items-center justify-between rounded-lg border p-4 shadow-sm ${tones[tone]}`}><div><p className="text-xs font-bold">{label}</p><p className="mt-3 text-2xl font-bold text-slate-950">{value}</p></div><Icon className="size-8 opacity-40" /></div>;
}

function MiniStat({ label, value }) {
  return <div className="rounded-lg bg-violet-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold text-violet-700">{value}</p></div>;
}

function stockLabel(stock) {
  return stock.tallerName ? `${stock.centroName} - ${stock.tallerName}` : stock.mostradorName ? `${stock.centroName} - ${stock.mostradorName}` : stock.centroName;
}
