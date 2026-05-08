"use client";

import { useMemo, useRef, useState } from "react";
import { Car, Clock, Download, DollarSign, Edit3, Filter, History, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";

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
import { useCarPrices } from "@/hooks/carprices/useCarPrices";
import { hasPerm } from "@/lib/permissions";

export default function CarPricesPage({ userPermissions }) {
  const data = useCarPrices();
  const fileInputRef = useRef(null);
  const [view, setView] = useState("prices");
  const [filters, setFilters] = useState({ query: "", marcaId: "", modeloId: "", monedaId: "", estado: "" });
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [historyDialog, setHistoryDialog] = useState({ open: false });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null });
  const [importMessage, setImportMessage] = useState("");
  const canView = hasPerm(userPermissions, ["inventariocarros", "view"]);
  const canCreate = hasPerm(userPermissions, ["inventariocarros", "create"]);
  const canEdit = hasPerm(userPermissions, ["inventariocarros", "edit"]);
  const canDelete = hasPerm(userPermissions, ["inventariocarros", "delete"]);
  const canImport = hasPerm(userPermissions, ["inventariocarros", "import"]) || canCreate || canEdit;
  const canExport = hasPerm(userPermissions, ["inventariocarros", "export"]) || canView;
  const canHistory = hasPerm(userPermissions, ["inventariocarros", "history"]) || canView;

  const filteredPrices = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return data.prices.filter((item) => {
      const matchesQuery = !query || `${item.marcaName} ${item.modeloName} ${item.version}`.toLowerCase().includes(query);
      const matchesBrand = !filters.marcaId || Number(filters.marcaId) === item.marcaId;
      const matchesModel = !filters.modeloId || Number(filters.modeloId) === item.modeloId;
      const matchesCurrency = !filters.monedaId || Number(filters.monedaId) === item.monedaId;
      const matchesState = !filters.estado || (filters.estado === "stock" && item.enStock && item.existe) || (filters.estado === "pedido" && !item.enStock && item.existe) || (filters.estado === "no_ofrece" && !item.existe);
      return matchesQuery && matchesBrand && matchesModel && matchesCurrency && matchesState;
    });
  }, [data.prices, filters]);

  const brandOptions = [{ value: "", label: "Todas" }, ...data.options.brands.map((item) => ({ value: item.id, label: item.name }))];
  const modelFilterOptions = [{ value: "", label: "Todos" }, ...data.options.models.filter((item) => !filters.marcaId || Number(filters.marcaId) === item.marcaId).map((item) => ({ value: item.id, label: item.name }))];
  const currencyOptions = [{ value: "", label: "Todas" }, ...data.options.currencies.map((item) => ({ value: item.id, label: `${item.codigo} ${item.simbolo}` }))];
  const stateOptions = [{ value: "", label: "Todos" }, { value: "stock", label: "En stock" }, { value: "pedido", label: "Bajo pedido" }, { value: "no_ofrece", label: "No se ofrece" }];

  async function exportPrices() {
    const XLSX = await import("xlsx");
    const rows = data.prices.map((item) => ({
      marca_id: item.marcaId,
      marca: item.marcaName,
      modelo_id: item.modeloId,
      modelo: item.modeloName,
      version: item.version,
      moneda_id: item.monedaId,
      moneda: item.monedaCodigo,
      precio_base: item.precioBase,
      en_stock: item.enStock ? 1 : 0,
      existe: item.existe ? 1 : 0,
      tiempo_entrega_dias: item.tiempoEntregaDias,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ marca_id: "", marca: "", modelo_id: "", modelo: "", version: "", moneda_id: "", moneda: "", precio_base: "", en_stock: 1, existe: 1, tiempo_entrega_dias: 0 }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "precios_carros");
    XLSX.writeFile(workbook, "precios_carros.xlsx");
  }

  async function importPrices(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportMessage("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      const result = await data.importRows(rows);
      setImportMessage(`Importados ${result.imported}. Actualizados ${result.updated}.`);
    } catch (error) {
      setImportMessage(error.message || "No se pudo importar el archivo.");
    } finally {
      event.target.value = "";
    }
  }

  if (!canView) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver precios de carros.</div>;
  }

  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-violet-700 text-white shadow-sm"><Car className="size-5" /></div>
          <div>
            <h1 className="text-3xl font-bold leading-none text-violet-700">Precios de Carros</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">Gestiona precios por marca, modelo y version</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport ? <Button variant="outline" onClick={exportPrices}><Download className="size-4" />Exportar</Button> : null}
          {canImport ? <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="size-4" />Importar</Button> : null}
          {canHistory ? <Button variant="outline" onClick={() => setView((current) => current === "history" ? "prices" : "history")}><History className="size-4" />Historial</Button> : null}
          {canCreate ? <Button variant="outline" onClick={() => setHistoryDialog({ open: true })}><Plus className="size-4" />Crear carro</Button> : null}
          {canCreate ? (
            <Button onClick={() => setDialog({ open: true, item: null })} className="bg-violet-700 text-white hover:bg-violet-800">
              <Plus className="size-4" />
              Nuevo Precio
            </Button>
          ) : null}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importPrices} />
        </div>
      </div>
      {importMessage ? <p className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">{importMessage}</p> : null}

      <div className="mb-4 grid gap-3 md:grid-cols-5">
        <Stat label="Total" value={data.stats.total} icon={DollarSign} />
        <Stat label="Marcas" value={data.stats.brands} icon={Car} />
        <Stat label="Modelos" value={data.stats.models} icon={Car} tone="green" />
        <Stat label="En Stock" value={data.stats.stock} icon={Filter} tone="green" />
        <Stat label="Bajo Pedido" value={data.stats.pedido} icon={Clock} tone="orange" />
      </div>

      <div className="mb-4 w-full overflow-x-auto rounded-lg bg-slate-100 p-1">
        <div className="flex min-w-max gap-1">
          <button className={`h-8 rounded-md px-6 text-xs font-bold ${view === "prices" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} onClick={() => setView("prices")}>Precios</button>
          <button className={`h-8 rounded-md px-6 text-xs font-bold ${view === "history" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} onClick={() => setView("history")}>Historial</button>
        </div>
      </div>

      {view === "prices" ? <section className="mb-4 rounded-lg border border-violet-200 bg-white shadow-sm">
        <div className="bg-violet-50/40 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-violet-700"><Filter className="size-5" />Filtros</h2>
        </div>
        <div className="space-y-3 p-4">
          <Field label="Buscar">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Marca, modelo, version..." className="h-9 bg-white pl-9" />
            </div>
          </Field>
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="Marca"><SearchableSelect value={filters.marcaId} options={brandOptions} placeholder="Todas" onChange={(value) => setFilters((current) => ({ ...current, marcaId: value, modeloId: "" }))} /></Field>
            <Field label="Modelo"><SearchableSelect value={filters.modeloId} options={modelFilterOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, modeloId: value }))} /></Field>
            <Field label="Moneda"><SearchableSelect value={filters.monedaId} options={currencyOptions} placeholder="Todas" onChange={(value) => setFilters((current) => ({ ...current, monedaId: value }))} /></Field>
            <Field label="Estado"><SearchableSelect value={filters.estado} options={stateOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, estado: value }))} /></Field>
            <div className="flex items-end"><Button variant="outline" className="h-9 w-full" onClick={() => setFilters({ query: "", marcaId: "", modeloId: "", monedaId: "", estado: "" })}>Limpiar</Button></div>
          </div>
          <p className="text-sm font-medium text-slate-500">Mostrando {filteredPrices.length} de {data.prices.length} precios</p>
        </div>
      </section> : null}

      {view === "prices" ? <section className="overflow-hidden rounded-lg border border-violet-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-950">
              <tr>
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">Marca</th>
                <th className="px-3 py-3">Modelo</th>
                <th className="px-3 py-3">Version</th>
                <th className="px-3 py-3">Precio Base</th>
                <th className="px-3 py-3">En Stock</th>
                <th className="px-3 py-3">Existe</th>
                <th className="px-3 py-3">Entrega</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.loading ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
              ) : filteredPrices.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 font-bold text-violet-700">#{item.id}</td>
                  <td className="px-3 py-3 font-medium">{item.marcaName}</td>
                  <td className="px-3 py-3">{item.modeloName}</td>
                  <td className="px-3 py-3 font-semibold">{item.version}</td>
                  <td className="px-3 py-3 font-bold text-emerald-700">{item.monedaSimbolo} {item.precioBase.toFixed(2)}</td>
                  <td className="px-3 py-3"><StockBadge active={item.enStock} /></td>
                  <td className="px-3 py-3"><OfferBadge active={item.existe} /></td>
                  <td className="px-3 py-3">{item.enStock ? "Disponible" : `${item.tiempoEntregaDias} dias`}</td>
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
      </section> : <HistorySection loading={data.loading} history={data.history} />}

      {dialog.open ? (
        <CarPriceDialog
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
      {historyDialog.open ? (
        <HistoryDialog
          prices={data.prices}
          onClose={() => setHistoryDialog({ open: false })}
          onSubmit={async (payload) => {
            await data.createHistory(payload);
            setHistoryDialog({ open: false });
            setView("history");
          }}
        />
      ) : null}
    </div>
  );
}

function HistoryDialog({ prices, onClose, onSubmit }) {
  const [form, setForm] = useState({ vin: "", precioId: "", numeroFactura: "", precioCompra: "", precioVenta: "", facturacionAt: "", llegadaCentroAt: "", entregaAt: "" });
  const priceOptions = prices.map((item) => ({ value: item.id, label: `${item.marcaName} ${item.modeloName} ${item.version}` }));
  const selected = prices.find((item) => Number(item.id) === Number(form.precioId));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(94vw,560px)] overflow-y-auto bg-white text-slate-950">
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-violet-700">Crear carro en historial</DialogTitle>
            <DialogDescription>Registra un VIN para una version de precio.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="VIN *"><Input value={form.vin} onChange={(event) => setForm((current) => ({ ...current, vin: event.target.value }))} required /></Field>
              <Field label="Vehiculo *"><SearchableSelect value={form.precioId} options={priceOptions} placeholder="Seleccionar vehiculo" onChange={(value) => setForm((current) => ({ ...current, precioId: value, precioVenta: selected?.precioBase ?? current.precioVenta }))} /></Field>
              <Field label="Factura"><Input value={form.numeroFactura} onChange={(event) => setForm((current) => ({ ...current, numeroFactura: event.target.value }))} /></Field>
              <Field label="Precio compra"><Input type="number" step="0.01" value={form.precioCompra} onChange={(event) => setForm((current) => ({ ...current, precioCompra: event.target.value }))} /></Field>
              <Field label="Precio venta"><Input type="number" step="0.01" value={form.precioVenta} onChange={(event) => setForm((current) => ({ ...current, precioVenta: event.target.value }))} /></Field>
              <Field label="Facturacion"><Input type="datetime-local" value={form.facturacionAt} onChange={(event) => setForm((current) => ({ ...current, facturacionAt: event.target.value }))} /></Field>
              <Field label="Llegada al centro"><Input type="datetime-local" value={form.llegadaCentroAt} onChange={(event) => setForm((current) => ({ ...current, llegadaCentroAt: event.target.value }))} /></Field>
              <Field label="Entrega"><Input type="datetime-local" value={form.entregaAt} onChange={(event) => setForm((current) => ({ ...current, entregaAt: event.target.value }))} /></Field>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-violet-700 text-white hover:bg-violet-800">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CarPriceDialog({ state, options, onClose, onSubmit }) {
  const [form, setForm] = useState({
    marcaId: state.item?.marcaId ? String(state.item.marcaId) : "",
    modeloId: state.item?.modeloId ? String(state.item.modeloId) : "",
    version: state.item?.version || "",
    monedaId: state.item?.monedaId ? String(state.item.monedaId) : "",
    precioBase: state.item?.precioBase ?? "",
    enStock: state.item?.enStock ?? true,
    existe: state.item?.existe ?? true,
    tiempoEntregaDias: state.item?.tiempoEntregaDias ?? 0,
  });
  const [error, setError] = useState("");
  const brandOptions = options.brands.map((item) => ({ value: item.id, label: item.name }));
  const modelOptions = options.models.filter((item) => !form.marcaId || Number(form.marcaId) === item.marcaId).map((item) => ({ value: item.id, label: item.name }));
  const currencyOptions = options.currencies.map((item) => ({ value: item.id, label: `${item.codigo} ${item.simbolo}` }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message || "No se pudo guardar el precio.");
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(94vw,560px)] overflow-y-auto bg-white text-slate-950">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-violet-700">{state.item ? "Editar precio" : "Nuevo precio"}</DialogTitle>
            <DialogDescription>Completa la configuracion del precio del carro.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3">
            <h3 className="mb-3 text-sm font-bold text-violet-700">Vehiculo</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Marca *"><SearchableSelect value={form.marcaId} options={brandOptions} placeholder="Seleccionar marca" onChange={(value) => setForm((current) => ({ ...current, marcaId: value, modeloId: "" }))} /></Field>
              <Field label="Modelo *"><SearchableSelect value={form.modeloId} options={modelOptions} placeholder="Seleccionar modelo" onChange={(value) => setForm((current) => ({ ...current, modeloId: value }))} /></Field>
              <Field label="Version *"><Input value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))} placeholder="Ej: LTZ 4x2" required /></Field>
              <Field label="Moneda *"><SearchableSelect value={form.monedaId} options={currencyOptions} placeholder="Seleccionar moneda" onChange={(value) => setForm((current) => ({ ...current, monedaId: value }))} /></Field>
            </div>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3">
            <h3 className="mb-3 text-sm font-bold text-violet-700">Precio y disponibilidad</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Precio base *"><Input type="number" step="0.01" value={form.precioBase} onChange={(event) => setForm((current) => ({ ...current, precioBase: event.target.value }))} required /></Field>
              <Field label="Tiempo entrega dias"><Input type="number" value={form.tiempoEntregaDias} onChange={(event) => setForm((current) => ({ ...current, tiempoEntregaDias: event.target.value }))} disabled={form.enStock} /></Field>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Toggle label="En stock" description="Disponible inmediatamente" checked={form.enStock} onCheckedChange={(checked) => setForm((current) => ({ ...current, enStock: Boolean(checked), tiempoEntregaDias: checked ? 0 : current.tiempoEntregaDias }))} />
              <Toggle label="Se ofrece" description="Visible para ventas" checked={form.existe} onCheckedChange={(checked) => setForm((current) => ({ ...current, existe: Boolean(checked) }))} />
            </div>
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
          <DialogTitle className="text-lg font-bold text-red-600">Eliminar precio</DialogTitle>
          <DialogDescription>Se eliminara {state.item?.marcaName} {state.item?.modeloName} {state.item?.version}.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm}>Eliminar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistorySection({ loading, history }) {
  return (
    <section className="overflow-hidden rounded-lg border border-violet-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-violet-700"><History className="size-5" />Historial de Carros</h2>
          <p className="text-xs font-medium text-slate-500">Consulta VIN, factura, precios y fechas del carro</p>
        </div>
        <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">{history.length} registros</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-950">
            <tr>
              <th className="px-3 py-3">VIN</th>
              <th className="px-3 py-3">Vehiculo</th>
              <th className="px-3 py-3">Factura</th>
              <th className="px-3 py-3">Compra</th>
              <th className="px-3 py-3">Venta</th>
              <th className="px-3 py-3">Registro</th>
              <th className="px-3 py-3">Facturacion</th>
              <th className="px-3 py-3">Llegada</th>
              <th className="px-3 py-3">Entrega</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={9} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
            ) : history.map((item) => (
              <tr key={item.vin}>
                <td className="px-3 py-3 font-bold text-violet-700">{item.vin}</td>
                <td className="px-3 py-3">{item.marcaName} {item.modeloName} <span className="font-semibold">{item.version}</span></td>
                <td className="px-3 py-3">{item.numeroFactura || "-"}</td>
                <td className="px-3 py-3 font-bold text-emerald-700">{formatMoney(item.monedaSimbolo, item.precioCompra)}</td>
                <td className="px-3 py-3 font-bold text-blue-700">{formatMoney(item.monedaSimbolo, item.precioVenta)}</td>
                <td className="px-3 py-3">{formatDate(item.createdAt)}</td>
                <td className="px-3 py-3">{formatDate(item.facturacionAt)}</td>
                <td className="px-3 py-3">{formatDate(item.llegadaCentroAt)}</td>
                <td className="px-3 py-3">{formatDate(item.entregaAt)}</td>
              </tr>
            ))}
            {!loading && history.length === 0 ? <tr><td colSpan={9} className="py-10 text-center text-slate-500">No hay historial registrado.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value, icon: Icon, tone = "purple" }) {
  const tones = {
    purple: "border-violet-200 bg-violet-50 text-violet-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
  };
  return (
    <div className={`flex min-h-24 items-center justify-between rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
      <div><p className="text-xs font-bold">{label}</p><p className="mt-3 text-2xl font-bold text-slate-950">{value}</p></div>
      <Icon className="size-8 opacity-45" />
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">{label}</Label>{children}</div>;
}

function Toggle({ label, description, checked, onCheckedChange }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-violet-100 bg-white p-3">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <span><span className="block text-sm font-bold text-violet-700">{label}</span><span className="text-xs text-slate-500">{description}</span></span>
    </label>
  );
}

function StockBadge({ active }) {
  return <span className={`rounded-full border px-2 py-1 text-xs font-bold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-orange-200 bg-orange-50 text-orange-700"}`}>{active ? "En stock" : "Bajo pedido"}</span>;
}

function OfferBadge({ active }) {
  return <span className={`rounded-full border px-2 py-1 text-xs font-bold ${active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-red-200 bg-red-50 text-red-700"}`}>{active ? "Si" : "No"}</span>;
}

function formatMoney(symbol, value) {
  if (value === null || value === undefined) return "-";
  return `${symbol} ${Number(value).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}
