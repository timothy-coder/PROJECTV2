"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Car, Clock, Download, DollarSign, Edit3, Eye, Filter, History, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";

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
  const inventoryFileInputRef = useRef(null);
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
  const canImport = hasPerm(userPermissions, ["inventariocarros", "import"]);
  const canExport = hasPerm(userPermissions, ["inventariocarros", "export"]);
  const canHistory = hasPerm(userPermissions, ["inventariocarros", "history"]);
  const canCreateHistory = hasPerm(userPermissions, ["inventariocarros", "history_create"]);
  const canHistoryEdit = hasPerm(userPermissions, ["inventariocarros", "history_edit"]);
  const canHistoryImport = hasPerm(userPermissions, ["inventariocarros", "history_import"]);
  const canHistoryExport = hasPerm(userPermissions, ["inventariocarros", "history_export"]);
  const canPendingPurchase = hasPerm(userPermissions, ["inventariocarros", "pending_purchase"]);
  const availableViews = useMemo(() => [
    canView ? "prices" : null,
    canHistory ? "history" : null,
    canPendingPurchase ? "pending" : null,
  ].filter(Boolean), [canHistory, canPendingPurchase, canView]);
  const activeView = availableViews.includes(view) ? view : availableViews[0] || "prices";

  const filteredPrices = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return data.prices.filter((item) => {
      const matchesQuery = !query || `${item.marcaName} ${item.modeloName} ${item.version} ${item.combustible}`.toLowerCase().includes(query);
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
      marca: item.marcaName,
      modelo: item.modeloName,
      version: item.version,
      combustible: item.combustible || "GASOLINA",
      moneda: item.monedaCodigo,
      precio_base: item.precioBase,
      en_stock: item.enStock ? 1 : 0,
      existe: item.existe ? 1 : 0,
      tiempo_entrega_dias: item.tiempoEntregaDias,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ marca: "", modelo: "", version: "", combustible: "GASOLINA", moneda: "", precio_base: "", en_stock: 1, existe: 1, tiempo_entrega_dias: 0 }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "precios_carros");
    XLSX.writeFile(workbook, "precios_carros.xlsx");
  }

  async function exportInventory() {
    const XLSX = await import("xlsx");
    const rows = data.history.map((item) => ({
      vin: item.vin,
      marca: item.marcaName,
      modelo: item.modeloName,
      version: item.version,
      color_externo: item.colorExterno,
      color_interno: item.colorInterno,
      numero_motor: item.numeroMotor,
      numero_factura: item.numeroFactura,
      precio_compra: item.precioCompra ?? "",
      precio_venta: item.precioVenta ?? "",
      facturacion_at: formatDateTimeForSheet(item.facturacionAt),
      llegada_centro_at: formatDateTimeForSheet(item.llegadaCentroAt),
      entrega_at: formatDateTimeForSheet(item.entregaAt),
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{
      vin: "",
      marca: "",
      modelo: "",
      version: "",
      color_externo: "",
      color_interno: "",
      numero_motor: "",
      numero_factura: "",
      precio_compra: "",
      precio_venta: "",
      facturacion_at: "",
      llegada_centro_at: "",
      entrega_at: "",
    }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "inventario_carros");
    XLSX.writeFile(workbook, "inventario_carros.xlsx");
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

  async function importInventory(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportMessage("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      const result = await data.importHistoryRows(rows);
      setImportMessage(`Inventario importado ${result.imported}. Actualizados ${result.updated}.`);
    } catch (error) {
      setImportMessage(error.message || "No se pudo importar el inventario.");
    } finally {
      event.target.value = "";
    }
  }

  if (!canView) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver precios de carros.</div>;
  }

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 p-3 text-slate-950 md:h-svh sm:p-4">
      <div className="mb-3 flex shrink-0 flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-violet-700 text-white shadow-sm"><Car className="size-5" /></div>
          <div>
            <h1 className="text-3xl font-bold leading-none text-violet-700">Precios de Carros</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">Gestiona precios por marca, modelo y version</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport ? <Button variant="outline" onClick={exportPrices}><Download className="size-4" />Exportar precios</Button> : null}
          {canImport ? <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="size-4" />Importar precios</Button> : null}
          {canHistoryExport ? <Button variant="outline" onClick={exportInventory}><Download className="size-4" />Exportar inventario</Button> : null}
          {canHistoryImport ? <Button variant="outline" onClick={() => inventoryFileInputRef.current?.click()}><Upload className="size-4" />Importar inventario</Button> : null}
          {canHistory ? <Button variant="outline" onClick={() => setView("history")}><History className="size-4" />Inventario</Button> : null}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importPrices} />
          <input ref={inventoryFileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importInventory} />
        </div>
      </div>
      {importMessage ? <p className="mb-3 shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">{importMessage}</p> : null}

      <div className="mb-3 grid shrink-0 gap-2 md:grid-cols-5">
        <Stat label="Total" value={data.stats.total} icon={DollarSign} />
        <Stat label="Marcas" value={data.stats.brands} icon={Car} />
        <Stat label="Modelos" value={data.stats.models} icon={Car} tone="green" />
        <Stat label="En Stock" value={data.stats.stock} icon={Filter} tone="green" />
        <Stat label="Bajo Pedido" value={data.stats.pedido} icon={Clock} tone="orange" />
      </div>

      <div className="mb-3 w-full shrink-0 overflow-x-auto rounded-lg bg-slate-100 p-1">
        <div className="flex min-w-max gap-1">
          {canView ? <button className={`h-8 rounded-md px-6 text-xs font-bold ${activeView === "prices" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} onClick={() => setView("prices")}>Precios</button> : null}
          {canHistory ? <button className={`h-8 rounded-md px-6 text-xs font-bold ${activeView === "history" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} onClick={() => setView("history")}>Inventario</button> : null}
          {canPendingPurchase ? <button className={`h-8 rounded-md px-6 text-xs font-bold ${activeView === "pending" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} onClick={() => setView("pending")}>Pendientes de compra</button> : null}
        </div>
      </div>

      {activeView === "prices" ? <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm">
        <div className="shrink-0 space-y-2 border-b border-slate-200 px-3 py-2">
          <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_160px_160px_130px_130px_auto_auto] lg:items-end">
            <Field label="Buscar">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Marca, modelo, version..." className="h-9 bg-white pl-9" />
              </div>
            </Field>
            <Field label="Marca"><SearchableSelect value={filters.marcaId} options={brandOptions} placeholder="Todas" onChange={(value) => setFilters((current) => ({ ...current, marcaId: value, modeloId: "" }))} /></Field>
            <Field label="Modelo"><SearchableSelect value={filters.modeloId} options={modelFilterOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, modeloId: value }))} /></Field>
            <Field label="Moneda"><SearchableSelect value={filters.monedaId} options={currencyOptions} placeholder="Todas" onChange={(value) => setFilters((current) => ({ ...current, monedaId: value }))} /></Field>
            <Field label="Estado"><SearchableSelect value={filters.estado} options={stateOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, estado: value }))} /></Field>
            <Button variant="outline" className="h-9" onClick={() => setFilters({ query: "", marcaId: "", modeloId: "", monedaId: "", estado: "" })}>Limpiar</Button>
            {canCreate ? (
              <Button onClick={() => setDialog({ open: true, item: null })} className="h-9 bg-violet-700 text-white hover:bg-violet-800">
                <Plus className="size-4" />
                Nuevo Precio
              </Button>
            ) : null}
          </div>
          <p className="text-xs font-medium text-slate-500">Mostrando {filteredPrices.length} de {data.prices.length} precios</p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-950">
              <tr>
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">Marca</th>
                <th className="px-3 py-3">Modelo</th>
                <th className="px-3 py-3">Version</th>
                <th className="px-3 py-3">Combustible</th>
                <th className="px-3 py-3">Precio Base</th>
                <th className="px-3 py-3">En Stock</th>
                <th className="px-3 py-3">Existe</th>
                <th className="px-3 py-3">Entrega</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.loading ? (
                <tr><td colSpan={10} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
              ) : filteredPrices.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 font-bold text-violet-700">#{item.id}</td>
                  <td className="px-3 py-3 font-medium">{item.marcaName}</td>
                  <td className="px-3 py-3">{item.modeloName}</td>
                  <td className="px-3 py-3 font-semibold">{item.version}</td>
                  <td className="px-3 py-3"><FuelBadge value={item.combustible} /></td>
                  <td className="px-3 py-3 font-bold text-emerald-700">{formatMoney(item.monedaSimbolo, item.precioBase)}</td>
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
      </section> : null}

      {activeView === "history" && canHistory ? <HistorySection loading={data.loading} history={data.history} canEdit={canHistoryEdit} canCreate={canCreateHistory} onCreate={() => setHistoryDialog({ open: true })} onEdit={(item) => setHistoryDialog({ open: true, item })} /> : null}
      {activeView === "pending" && canPendingPurchase ? <PendingPurchasesSection loading={data.loading} rows={data.pendingPurchases || []} /> : null}

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
      {historyDialog.open && canHistory && (historyDialog.item ? canHistoryEdit : canCreateHistory) ? (
        <HistoryDialog
          item={historyDialog.item}
          prices={data.prices}
          onClose={() => setHistoryDialog({ open: false, item: null })}
          onSubmit={async (payload) => {
            if (historyDialog.item) await data.updateHistory(historyDialog.item.vin, payload);
            else await data.createHistory(payload);
            setHistoryDialog({ open: false, item: null });
            setView("history");
          }}
        />
      ) : null}
    </div>
  );
}

function HistoryDialog({ item, prices, onClose, onSubmit }) {
  const [form, setForm] = useState({
    vin: item?.vin || "",
    precioId: item?.precioId ? String(item.precioId) : "",
    colorExterno: item?.colorExterno || "",
    colorInterno: item?.colorInterno || "",
    numeroMotor: item?.numeroMotor || "",
    numeroFactura: item?.numeroFactura || "",
    precioCompra: item?.precioCompra ?? "",
    precioVenta: item?.precioVenta ?? "",
    facturacionAt: dateTimeInputValue(item?.facturacionAt),
    llegadaCentroAt: dateTimeInputValue(item?.llegadaCentroAt),
    entregaAt: dateTimeInputValue(item?.entregaAt),
  });
  const priceOptions = prices.map((item) => ({ value: item.id, label: `${item.marcaName} ${item.modeloName} ${item.version}` }));
  const isEdit = Boolean(item);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(94vw,560px)] overflow-y-auto bg-white text-slate-950">
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-violet-700">{isEdit ? "Editar carro en inventario" : "Crear carro en inventario"}</DialogTitle>
            <DialogDescription>{isEdit ? "Actualiza la informacion del VIN seleccionado." : "Registra un VIN para una version de precio."}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="VIN *"><Input value={form.vin} onChange={(event) => setForm((current) => ({ ...current, vin: event.target.value }))} disabled={isEdit} required /></Field>
              <Field label="Vehiculo *"><SearchableSelect value={form.precioId} options={priceOptions} placeholder="Seleccionar vehiculo" onChange={(value) => {
                const selected = prices.find((price) => Number(price.id) === Number(value));
                setForm((current) => ({ ...current, precioId: value, precioVenta: selected?.precioBase ?? current.precioVenta }));
              }} /></Field>
              <Field label="Color externo"><Input value={form.colorExterno} onChange={(event) => setForm((current) => ({ ...current, colorExterno: event.target.value }))} placeholder="Ej: Blanco" /></Field>
              <Field label="Color interno"><Input value={form.colorInterno} onChange={(event) => setForm((current) => ({ ...current, colorInterno: event.target.value }))} placeholder="Ej: Negro" /></Field>
              <Field label="Numero de motor"><Input value={form.numeroMotor} onChange={(event) => setForm((current) => ({ ...current, numeroMotor: event.target.value }))} placeholder="Numero de motor" /></Field>
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
    combustible: state.item?.combustible || "GASOLINA",
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
  const fuelOptions = [
    { value: "GASOLINA", label: "Gasolina" },
    { value: "DIESEL", label: "Diesel" },
    { value: "BICOMBUSTIBLE", label: "Bicombustible" },
  ];

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
              <Field label="Combustible *"><SearchableSelect value={form.combustible} options={fuelOptions} placeholder="Seleccionar combustible" onChange={(value) => setForm((current) => ({ ...current, combustible: value }))} /></Field>
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

function HistorySection({ loading, history, canEdit, canCreate, onCreate, onEdit }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredHistory = useMemo(() => {
    if (!normalizedQuery) return history;
    return history.filter((item) => `${item.vin} ${item.marcaName} ${item.modeloName} ${item.version} ${item.numeroFactura} ${item.numeroMotor}`.toLowerCase().includes(normalizedQuery));
  }, [history, normalizedQuery]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm">
      <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 px-3 py-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-violet-700"><History className="size-4" />Inventario de Carros</h2>
          <p className="text-[11px] font-medium text-slate-500">Consulta VIN, factura, precios y fechas del carro</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar vehiculo, VIN, factura o motor" className="h-9 w-full bg-white pl-9 sm:w-72" />
          </div>
          <span className="w-fit rounded-full bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">{filteredHistory.length} de {history.length} registros</span>
          {canCreate ? <Button variant="outline" onClick={onCreate} className="h-9"><Plus className="size-4" />Crear carro</Button> : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-950">
            <tr>
              <th className="px-3 py-3">VIN</th>
              <th className="px-3 py-3">Vehiculo</th>
              <th className="px-3 py-3">Color Ext.</th>
              <th className="px-3 py-3">Color Int.</th>
              <th className="px-3 py-3">Motor</th>
              <th className="px-3 py-3">Factura</th>
              <th className="px-3 py-3">Compra</th>
              <th className="px-3 py-3">Venta</th>
              <th className="px-3 py-3">Registro</th>
              <th className="px-3 py-3">Facturacion</th>
              <th className="px-3 py-3">Llegada</th>
              <th className="px-3 py-3">Entrega</th>
              <th className="px-3 py-3">Reserva</th>
              {canEdit ? <th className="px-3 py-3 text-right">Acciones</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={canEdit ? 14 : 13} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
            ) : filteredHistory.map((item) => (
              <tr key={item.vin}>
                <td className="px-3 py-3"><InventoryVinCell item={item} /></td>
                <td className="px-3 py-3">{item.marcaName} {item.modeloName} <span className="font-semibold">{item.version}</span></td>
                <td className="px-3 py-3">{item.colorExterno || "-"}</td>
                <td className="px-3 py-3">{item.colorInterno || "-"}</td>
                <td className="px-3 py-3">{item.numeroMotor || "-"}</td>
                <td className="px-3 py-3">{item.numeroFactura || "-"}</td>
                <td className="px-3 py-3 font-bold text-emerald-700">{formatMoney(item.monedaSimbolo, item.precioCompra)}</td>
                <td className="px-3 py-3 font-bold text-blue-700">{formatMoney(item.monedaSimbolo, item.precioVenta)}</td>
                <td className="px-3 py-3">{formatDate(item.createdAt)}</td>
                <td className="px-3 py-3">{formatDate(item.facturacionAt)}</td>
                <td className="px-3 py-3">{formatDate(item.llegadaCentroAt)}</td>
                <td className="px-3 py-3">{formatDate(item.entregaAt)}</td>
                <td className="px-3 py-3"><ReservationUsageBadge item={item} /></td>
                {canEdit ? <td className="px-3 py-3 text-right"><Button variant="outline" size="icon" onClick={() => onEdit(item)}><Edit3 className="size-4" /></Button></td> : null}
              </tr>
            ))}
            {!loading && filteredHistory.length === 0 ? <tr><td colSpan={canEdit ? 14 : 13} className="py-10 text-center text-slate-500">No hay historial registrado.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PendingPurchasesSection({ loading, rows }) {
  const [query, setQuery] = useState("");
  const clean = query.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!clean) return rows;
    return rows.filter((item) => `${item.reservaId} ${item.cliente} ${item.marcaName} ${item.modeloName} ${item.version} ${item.colorExterno} ${item.colorInterno} ${item.estado}`.toLowerCase().includes(clean));
  }, [clean, rows]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm">
      <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 px-3 py-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-violet-700"><Car className="size-4" />Carros pendientes de compra</h2>
          <p className="text-[11px] font-medium text-slate-500">Reservas sin VIN asignado que requieren compra o asignacion de unidad</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar reserva, cliente o vehiculo" className="h-9 w-full bg-white pl-9 sm:w-72" />
          </div>
          <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">{filteredRows.length} de {rows.length} pendientes</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-950">
            <tr>
              <th className="px-3 py-3">Reserva</th>
              <th className="px-3 py-3">Cliente</th>
              <th className="px-3 py-3">Marca</th>
              <th className="px-3 py-3">Modelo</th>
              <th className="px-3 py-3">Version</th>
              <th className="px-3 py-3">Año</th>
              <th className="px-3 py-3">Color Ext.</th>
              <th className="px-3 py-3">Color Int.</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={11} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
            ) : filteredRows.map((item) => (
              <tr key={`${item.reservaId}-${item.precioId}`}>
                <td className="px-3 py-3 font-bold text-violet-700">#{item.reservaId}</td>
                <td className="px-3 py-3 font-medium">{item.cliente}</td>
                <td className="px-3 py-3">{item.marcaName}</td>
                <td className="px-3 py-3">{item.modeloName}</td>
                <td className="px-3 py-3 font-semibold">{item.version}</td>
                <td className="px-3 py-3">{item.anio || "-"}</td>
                <td className="px-3 py-3">{item.colorExterno || "-"}</td>
                <td className="px-3 py-3">{item.colorInterno || "-"}</td>
                <td className="px-3 py-3"><span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700">{item.estado || "pendiente"}</span></td>
                <td className="px-3 py-3">{formatDate(item.createdAt)}</td>
                <td className="px-3 py-3 text-right">
                  <Link className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-violet-200 bg-white px-2 text-xs font-bold text-violet-700 hover:bg-violet-50" href={`/reservas/${item.reservaId}`}>
                    <Eye className="size-4" />
                    Ir a reserva
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && filteredRows.length === 0 ? <tr><td colSpan={11} className="py-10 text-center text-slate-500">No hay carros pendientes de compra.</td></tr> : null}
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
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${tones[tone]}`}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold leading-4">{label}</p>
        <p className="mt-0.5 text-xl font-bold leading-6 text-slate-950">{value}</p>
      </div>
      <Icon className="size-5 shrink-0 opacity-50" />
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1"><Label className="text-[11px] font-bold text-slate-600">{label}</Label>{children}</div>;
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

function ReservationUsageBadge({ item }) {
  if (!item.enReserva) {
    return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Libre</span>;
  }
  return (
    <Link className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-violet-200 bg-white px-3 text-xs font-bold text-violet-700 hover:bg-violet-50" href={`/reservas/${item.reservaId}`}>
        <Eye className="size-3.5" />
        Ir a reserva
    </Link>
  );
}

function InventoryVinCell({ item }) {
  return (
    <div className="flex min-w-40 flex-col gap-1">
      <span className="font-bold text-violet-700">{item.vin}</span>
      {item.enReserva ? (
        <span className="w-fit rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700">
          Reserva #{item.reservaId}
        </span>
      ) : null}
    </div>
  );
}

function FuelBadge({ value }) {
  const labels = { GASOLINA: "Gasolina", DIESEL: "Diesel", BICOMBUSTIBLE: "Bicombustible" };
  const tones = {
    GASOLINA: "border-emerald-200 bg-emerald-50 text-emerald-700",
    DIESEL: "border-slate-200 bg-slate-50 text-slate-700",
    BICOMBUSTIBLE: "border-violet-200 bg-violet-50 text-violet-700",
  };
  const normalized = value || "GASOLINA";
  return <span className={`rounded-full border px-2 py-1 text-xs font-bold ${tones[normalized] || tones.GASOLINA}`}>{labels[normalized] || normalized}</span>;
}

function formatMoney(symbol, value) {
  if (value === null || value === undefined) return "-";
  return `${symbol} ${Number(value).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTimeForSheet(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function dateTimeInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
