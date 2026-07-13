"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Car, ChevronDown, Clock, Download, DollarSign, Edit3, Eye, Filter, History, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";

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
  const [filters, setFilters] = useState({ query: "", marcaId: "", modeloId: "", estado: "" });
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [historyDialog, setHistoryDialog] = useState({ open: false });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null });
  const [importMessage, setImportMessage] = useState("");
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const canView = hasPerm(userPermissions, ["inventariocarros", "view"]);
  const canCreate = hasPerm(userPermissions, ["inventariocarros", "create"]);
  const canEdit = hasPerm(userPermissions, ["inventariocarros", "edit"]);
  const canDelete = hasPerm(userPermissions, ["inventariocarros", "delete"]);
  const canImport = hasPerm(userPermissions, ["inventariocarros", "import"]);
  const canExport = hasPerm(userPermissions, ["inventariocarros", "export"]);
  const canHistory = hasPerm(userPermissions, ["inventariocarros", "history"]);
  const canDeliveredCars = hasPerm(userPermissions, ["inventariocarros", "delivered"]);
  const canCreateHistory = hasPerm(userPermissions, ["inventariocarros", "history_create"]);
  const canHistoryEdit = hasPerm(userPermissions, ["inventariocarros", "history_edit"]);
  const canHistoryImport = hasPerm(userPermissions, ["inventariocarros", "history_import"]);
  const canHistoryExport = hasPerm(userPermissions, ["inventariocarros", "history_export"]);
  const canPendingPurchase = hasPerm(userPermissions, ["inventariocarros", "pending_purchase"]);
  const availableViews = useMemo(() => [
    canView ? "prices" : null,
    canHistory ? "history" : null,
    canDeliveredCars ? "sold" : null,
    canPendingPurchase ? "pending" : null,
  ].filter(Boolean), [canDeliveredCars, canHistory, canPendingPurchase, canView]);
  const activeView = availableViews.includes(view) ? view : availableViews[0] || "prices";
  const inventoryHistory = useMemo(() => data.history.filter((item) => !item.vendido), [data.history]);
  const soldHistory = useMemo(() => data.history.filter((item) => item.vendido), [data.history]);

  const filteredPrices = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return data.prices.filter((item) => {
      const matchesQuery = !query || `${item.marcaName} ${item.modeloName} ${item.version} ${item.combustible}`.toLowerCase().includes(query);
      const matchesBrand = !filters.marcaId || Number(filters.marcaId) === item.marcaId;
      const matchesModel = !filters.modeloId || Number(filters.modeloId) === item.modeloId;
      const matchesState = !filters.estado || (filters.estado === "stock" && item.enStock && item.existe) || (filters.estado === "pedido" && !item.enStock && item.existe) || (filters.estado === "no_ofrece" && !item.existe);
      return matchesQuery && matchesBrand && matchesModel && matchesState;
    });
  }, [data.prices, filters]);

  const brandOptions = [{ value: "", label: "Todas" }, ...data.options.brands.map((item) => ({ value: item.id, label: item.name }))];
  const modelFilterOptions = [{ value: "", label: "Todos" }, ...data.options.models.filter((item) => !filters.marcaId || Number(filters.marcaId) === item.marcaId).map((item) => ({ value: item.id, label: item.name }))];
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
    const rows = inventoryHistory.map((item) => ({
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
      const rowErrors = Array.isArray(result.errors) && result.errors.length ? ` Errores: ${result.errors.slice(0, 3).join(" | ")}` : "";
      setImportMessage(`Inventario importado ${result.imported}. Actualizados ${result.updated}.${rowErrors}`);
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
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">

            <Car className="size-5" />
            </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-violet-700">Precios de Carros</h1>
            <p className="mt-0.5 text-xs font-medium text-violet-400">Gestiona precios por marca, modelo y version</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {(canExport || canImport || canHistoryExport || canHistoryImport) ? (
            <div className="relative w-full sm:w-56">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActionsMenuOpen((current) => !current)}
                className="w-full justify-center"
              >
                Opciones
                <ChevronDown className={`size-4 transition ${actionsMenuOpen ? "rotate-180" : ""}`} />
              </Button>
              {actionsMenuOpen ? (
                <div className="absolute right-0 top-11 z-30 w-full overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
                  {canExport ? <MenuItem icon={Download} label="Exportar precios" onClick={exportPrices} close={() => setActionsMenuOpen(false)} /> : null}
                  {canImport ? <MenuItem icon={Upload} label="Importar precios" onClick={() => fileInputRef.current?.click()} close={() => setActionsMenuOpen(false)} /> : null}
                  {canHistoryExport ? <MenuItem icon={Download} label="Exportar inventario" onClick={exportInventory} close={() => setActionsMenuOpen(false)} /> : null}
                  {canHistoryImport ? <MenuItem icon={Upload} label="Importar inventario" onClick={() => inventoryFileInputRef.current?.click()} close={() => setActionsMenuOpen(false)} /> : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importPrices} />
          <input ref={inventoryFileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importInventory} />
        </div>
      </div>
      {importMessage ? <p className="mb-3 shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">{importMessage}</p> : null}

      <div className="mb-2 grid grid-cols-3 shrink-0 gap-1.5">
        <Stat label="Vehículos con precio" value={data.stats.total} icon={DollarSign} />
        <Stat label="Vehículos libres" value={data.stats.stock} icon={Filter} tone="green" />
        <Stat label="Pendiente compra" value={data.stats.pedido} icon={Clock} tone="orange" />
      </div>

      <div className="mb-3 w-full shrink-0 overflow-x-auto rounded-lg bg-slate-100 p-1">
        <div className="flex min-w-max gap-1">
          {canView ? <button className={`h-8 rounded-md px-6 text-xs font-bold ${activeView === "prices" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} onClick={() => setView("prices")}>Precios</button> : null}
          {canHistory ? <button className={`h-8 rounded-md px-6 text-xs font-bold ${activeView === "history" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} onClick={() => setView("history")}>Inventario</button> : null}
          {canDeliveredCars ? <button className={`h-8 rounded-md px-6 text-xs font-bold ${activeView === "sold" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} onClick={() => setView("sold")}>Carros entregados</button> : null}
          {canPendingPurchase ? <button className={`h-8 rounded-md px-6 text-xs font-bold ${activeView === "pending" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} onClick={() => setView("pending")}>Pendientes de compra</button> : null}
        </div>
      </div>

      {activeView === "prices" ? <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm">
        <div className="shrink-0 space-y-2 border-b border-slate-200 px-3 py-2">
          <div className="grid gap-2 lg:grid-cols-[minmax(180px,1fr)_minmax(220px,260px)_minmax(280px,340px)_minmax(200px,240px)_auto_auto] lg:items-end">
            <Field label="Buscar">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Marca, modelo, version..." className="h-9 bg-white pl-9" />
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
              <Field label="Marca"><SearchableSelect value={filters.marcaId} options={brandOptions} placeholder="Todas" onChange={(value) => setFilters((current) => ({ ...current, marcaId: value, modeloId: "" }))} /></Field>
              <Field label="Modelo"><SearchableSelect value={filters.modeloId} options={modelFilterOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, modeloId: value }))} /></Field>
              <Field label="Estado"><SearchableSelect value={filters.estado} options={stateOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, estado: value }))} /></Field>
              <Button variant="outline" className="h-9" onClick={() => setFilters({ query: "", marcaId: "", modeloId: "", estado: "" })}>Limpiar</Button>
            </div>
            {canCreate ? (
              <Button onClick={() => setDialog({ open: true, item: null })} className="h-9 bg-violet-700 text-white hover:bg-violet-800">
                <Plus className="size-4" />
                Nuevo Precio
              </Button>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-sm sm:min-w-[760px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-950">
              <tr>
                <th className="px-3 py-3">Marca</th>
                <th className="hidden px-3 py-3 sm:table-cell">Modelo</th>
                <th className="hidden px-3 py-3 sm:table-cell">Version</th>
                <th className="hidden px-3 py-3 sm:table-cell">Combustible</th>
                <th className="px-3 py-3">Precio Base</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.loading ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
              ) : filteredPrices.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-950">{item.marcaName} <span className="font-normal">{item.modeloName}</span></div>
                    <div className="mt-1 text-xs font-semibold text-slate-600 sm:hidden">{item.version}</div>
                  </td>
                  <td className="hidden px-3 py-3 sm:table-cell">{item.modeloName}</td>
                  <td className="hidden px-3 py-3 font-semibold sm:table-cell">{item.version}</td>
                  <td className="hidden px-3 py-3 sm:table-cell"><FuelBadge value={item.combustible} /></td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-emerald-700">{formatMoney(item.monedaSimbolo, item.precioBase)}</div>
                    <div className="mt-1 sm:hidden"><FuelBadge value={item.combustible} /></div>
                  </td>
                  <td className="px-3 py-3">
                    <PriceRowActions
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onEdit={() => setDialog({ open: true, item })}
                      onDelete={() => setDeleteDialog({ open: true, item })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          <span className="font-medium">Pagina 1 de 1</span>
          <span className="text-center font-medium">{filteredPrices.length} de {data.prices.length} registros</span>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled className="h-9">
              Anterior
            </Button>
            <Button variant="outline" disabled className="h-9">
              Siguiente
            </Button>
          </div>
        </div>
      </section> : null}

      {activeView === "history" && canHistory ? <HistorySection loading={data.loading} history={inventoryHistory} canEdit={canHistoryEdit} canCreate={canCreateHistory} onCreate={() => setHistoryDialog({ open: true })} onEdit={(item) => setHistoryDialog({ open: true, item })} /> : null}
      {activeView === "sold" && canDeliveredCars ? <HistorySection loading={data.loading} history={soldHistory} canEdit={canHistoryEdit} canCreate={false} onEdit={(item) => setHistoryDialog({ open: true, item })} title="Carros entregados" description="Unidades con registro de entrega" emptyMessage="No hay carros entregados registrados." showDelivery /> : null}
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
          showDelivery={activeView === "sold"}
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

function HistoryDialog({ item, prices, showDelivery = false, onClose, onSubmit }) {
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
      <DialogContent className="max-h-[94svh] max-w-[min(96vw,760px)] overflow-y-auto bg-white text-slate-950">
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-violet-700">{isEdit ? "Editar carro en inventario" : "Crear carro en inventario"}</DialogTitle>
            <DialogDescription>{isEdit ? "Actualiza la informacion del VIN seleccionado." : "Registra un VIN para una version de precio."}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="VIN *"><Input value={form.vin} onChange={(event) => setForm((current) => ({ ...current, vin: event.target.value }))} disabled={isEdit} required /></Field>
              <Field label="Vehiculo *" className="sm:col-span-2"><SearchableSelect value={form.precioId} options={priceOptions} placeholder="Seleccionar vehiculo" onChange={(value) => {
                const selected = prices.find((price) => Number(price.id) === Number(value));
                setForm((current) => ({ ...current, precioId: value, precioVenta: selected?.precioBase ?? current.precioVenta }));
              }} className="min-h-9 whitespace-normal py-2" /></Field>
              <Field label="Color externo"><Input value={form.colorExterno} onChange={(event) => setForm((current) => ({ ...current, colorExterno: event.target.value }))} placeholder="Ej: Blanco" /></Field>
              <Field label="Color interno"><Input value={form.colorInterno} onChange={(event) => setForm((current) => ({ ...current, colorInterno: event.target.value }))} placeholder="Ej: Negro" /></Field>
              <Field label="Numero de motor"><Input value={form.numeroMotor} onChange={(event) => setForm((current) => ({ ...current, numeroMotor: event.target.value }))} placeholder="Numero de motor" /></Field>
              <Field label="Factura"><Input value={form.numeroFactura} onChange={(event) => setForm((current) => ({ ...current, numeroFactura: event.target.value }))} /></Field>
              <Field label="Precio compra"><Input type="number" step="0.01" value={form.precioCompra} onChange={(event) => setForm((current) => ({ ...current, precioCompra: event.target.value }))} /></Field>
              <Field label="Precio venta"><Input type="number" step="0.01" value={form.precioVenta} onChange={(event) => setForm((current) => ({ ...current, precioVenta: event.target.value }))} /></Field>
              <Field label="Facturacion"><Input type="datetime-local" value={form.facturacionAt} onChange={(event) => setForm((current) => ({ ...current, facturacionAt: event.target.value }))} /></Field>
              <Field label="Llegada al centro"><Input type="datetime-local" value={form.llegadaCentroAt} onChange={(event) => setForm((current) => ({ ...current, llegadaCentroAt: event.target.value }))} /></Field>
              {showDelivery ? <Field label="Entrega concesionario"><Input type="datetime-local" value={form.entregaAt} onChange={(event) => setForm((current) => ({ ...current, entregaAt: event.target.value }))} /></Field> : null}
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

function HistorySection({
  loading,
  history,
  canEdit,
  canCreate,
  onCreate,
  onEdit,
  title = "Inventario de Carros",
  description = "Consulta VIN, factura, precios y fechas del carro",
  emptyMessage = "No hay historial registrado.",
  showDelivery = false,
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ marca: "", modelo: "" });
  const [sort, setSort] = useState({ key: "createdAt", direction: "desc" });
  const normalizedQuery = query.trim().toLowerCase();
  const brandOptions = useMemo(() => buildOptionList(history, "marcaName", "Todas"), [history]);
  const modelOptions = useMemo(() => buildOptionList(history.filter((item) => !filters.marca || item.marcaName === filters.marca), "modeloName", "Todos"), [history, filters.marca]);
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesQuery = !normalizedQuery || `${item.vin} ${item.marcaName} ${item.modeloName} ${item.version} ${item.numeroFactura} ${item.numeroMotor}`.toLowerCase().includes(normalizedQuery);
      const matchesBrand = !filters.marca || item.marcaName === filters.marca;
      const matchesModel = !filters.modelo || item.modeloName === filters.modelo;
      return matchesQuery && matchesBrand && matchesModel;
    });
  }, [filters, history, normalizedQuery]);
  const sortedHistory = useMemo(() => sortRows(filteredHistory, sort), [filteredHistory, sort]);
  const columnCount = (showDelivery ? 13 : 12) + (canEdit ? 1 : 0);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm">
      <div className="shrink-0 space-y-2 border-b border-slate-200 px-3 py-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-violet-700"><History className="size-4" />{title}</h2>
          <p className="text-[11px] font-medium text-slate-500">{description}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar vehiculo, VIN, factura o motor" className="h-9 w-full bg-white pl-9 sm:w-72" />
          </div>
          {canCreate ? <Button variant="outline" onClick={onCreate} className="h-9"><Plus className="size-4" />Crear carro</Button> : null}
        </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(180px,240px)_minmax(180px,260px)_auto] sm:items-end">
          <Field label="Marca"><SearchableSelect value={filters.marca} options={brandOptions} placeholder="Todas" onChange={(value) => setFilters((current) => ({ ...current, marca: value, modelo: "" }))} /></Field>
          <Field label="Modelo"><SearchableSelect value={filters.modelo} options={modelOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, modelo: value }))} /></Field>
          <Button variant="outline" className="h-9" onClick={() => { setQuery(""); setFilters({ marca: "", modelo: "" }); }}>Limpiar</Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-950">
            <tr>
              <SortableHeader sortKey="vin" sort={sort} onSort={setSort}>VIN</SortableHeader>
              <SortableHeader sortKey="marcaName" sort={sort} onSort={setSort}>Vehiculo</SortableHeader>
              <SortableHeader sortKey="colorExterno" sort={sort} onSort={setSort}>Color Ext.</SortableHeader>
              <SortableHeader sortKey="colorInterno" sort={sort} onSort={setSort}>Color Int.</SortableHeader>
              <SortableHeader sortKey="numeroMotor" sort={sort} onSort={setSort}>Motor</SortableHeader>
              <SortableHeader sortKey="numeroFactura" sort={sort} onSort={setSort}>Factura</SortableHeader>
              <SortableHeader sortKey="precioCompra" sort={sort} onSort={setSort}>Compra</SortableHeader>
              <SortableHeader sortKey="precioVenta" sort={sort} onSort={setSort}>Venta</SortableHeader>
              <SortableHeader sortKey="createdAt" sort={sort} onSort={setSort}>Registro</SortableHeader>
              <SortableHeader sortKey="facturacionAt" sort={sort} onSort={setSort}>Facturacion</SortableHeader>
              <SortableHeader sortKey="llegadaCentroAt" sort={sort} onSort={setSort}>Llegada</SortableHeader>
              {showDelivery ? <SortableHeader sortKey="entregaAt" sort={sort} onSort={setSort}>Entrega</SortableHeader> : null}
              <SortableHeader sortKey="enReserva" sort={sort} onSort={setSort}>Reserva</SortableHeader>
              {canEdit ? <th className="px-3 py-3 text-right">Acciones</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={columnCount} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
            ) : sortedHistory.map((item) => (
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
                {showDelivery ? <td className="px-3 py-3">{formatDate(item.entregaAt)}</td> : null}
                <td className="px-3 py-3"><ReservationUsageBadge item={item} /></td>
                {canEdit ? <td className="px-3 py-3 text-right"><Button variant="outline" size="icon" onClick={() => onEdit(item)}><Edit3 className="size-4" /></Button></td> : null}
              </tr>
            ))}
            {!loading && sortedHistory.length === 0 ? <tr><td colSpan={columnCount} className="py-10 text-center text-slate-500">{emptyMessage}</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
        <span className="font-medium">Pagina 1 de 1</span>
        <span className="text-center font-medium">{sortedHistory.length} de {history.length} registros</span>
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
  );
}

function PendingPurchasesSection({ loading, rows }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ marca: "", modelo: "" });
  const [sort, setSort] = useState({ key: "createdAt", direction: "desc" });
  const clean = query.trim().toLowerCase();
  const brandOptions = useMemo(() => buildOptionList(rows, "marcaName", "Todas"), [rows]);
  const modelOptions = useMemo(() => buildOptionList(rows.filter((item) => !filters.marca || item.marcaName === filters.marca), "modeloName", "Todos"), [rows, filters.marca]);
  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      const matchesQuery = !clean || `${item.reservaId} ${item.cliente} ${item.marcaName} ${item.modeloName} ${item.version} ${item.colorExterno} ${item.colorInterno} ${item.estado}`.toLowerCase().includes(clean);
      const matchesBrand = !filters.marca || item.marcaName === filters.marca;
      const matchesModel = !filters.modelo || item.modeloName === filters.modelo;
      return matchesQuery && matchesBrand && matchesModel;
    });
  }, [clean, filters, rows]);
  const sortedRows = useMemo(() => sortRows(filteredRows, sort), [filteredRows, sort]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm">
      <div className="shrink-0 space-y-2 border-b border-slate-200 px-3 py-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-violet-700"><Car className="size-4" />Carros pendientes de compra</h2>
            <p className="text-[11px] font-medium text-slate-500">Reservas sin VIN asignado que requieren compra o asignacion de unidad</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar reserva, cliente o vehiculo" className="h-9 w-full bg-white pl-9 sm:w-80" />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(180px,240px)_minmax(180px,260px)_auto] sm:items-end">
          <Field label="Marca"><SearchableSelect value={filters.marca} options={brandOptions} placeholder="Todas" onChange={(value) => setFilters((current) => ({ ...current, marca: value, modelo: "" }))} /></Field>
          <Field label="Modelo"><SearchableSelect value={filters.modelo} options={modelOptions} placeholder="Todos" onChange={(value) => setFilters((current) => ({ ...current, modelo: value }))} /></Field>
          <Button variant="outline" className="h-9" onClick={() => { setQuery(""); setFilters({ marca: "", modelo: "" }); }}>Limpiar</Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-950">
            <tr>
              <SortableHeader sortKey="reservaId" sort={sort} onSort={setSort}>Reserva</SortableHeader>
              <SortableHeader sortKey="cliente" sort={sort} onSort={setSort}>Cliente</SortableHeader>
              <SortableHeader sortKey="marcaName" sort={sort} onSort={setSort}>Marca</SortableHeader>
              <SortableHeader sortKey="modeloName" sort={sort} onSort={setSort}>Modelo</SortableHeader>
              <SortableHeader sortKey="version" sort={sort} onSort={setSort}>Version</SortableHeader>
              <SortableHeader sortKey="anio" sort={sort} onSort={setSort}>Año</SortableHeader>
              <SortableHeader sortKey="colorExterno" sort={sort} onSort={setSort}>Color Ext.</SortableHeader>
              <SortableHeader sortKey="colorInterno" sort={sort} onSort={setSort}>Color Int.</SortableHeader>
              <SortableHeader sortKey="estado" sort={sort} onSort={setSort}>Estado</SortableHeader>
              <SortableHeader sortKey="createdAt" sort={sort} onSort={setSort}>Fecha</SortableHeader>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={11} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
            ) : sortedRows.map((item) => (
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
            {!loading && sortedRows.length === 0 ? <tr><td colSpan={11} className="py-10 text-center text-slate-500">No hay carros pendientes de compra.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
        <span className="font-medium">Pagina 1 de 1</span>
        <span className="text-center font-medium">{sortedRows.length} de {rows.length} registros</span>
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
  );
}

function buildOptionList(rows, key, allLabel) {
  const values = Array.from(new Set(rows.map((item) => String(item?.[key] || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return [{ value: "", label: allLabel }, ...values.map((value) => ({ value, label: value }))];
}

function sortRows(rows, sort) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => compareSortValues(a?.[sort.key], b?.[sort.key]) * direction);
}

function compareSortValues(a, b) {
  const dateA = parseSortDate(a);
  const dateB = parseSortDate(b);
  if (dateA || dateB) return (dateA || 0) - (dateB || 0);
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
  return String(a ?? "").localeCompare(String(b ?? ""), "es", { numeric: true, sensitivity: "base" });
}

function parseSortDate(value) {
  if (!value) return 0;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  const text = String(value);
  if (!/\d{4}-\d{2}-\d{2}|T\d{2}:\d{2}|\/\d{1,2}\//.test(text)) return 0;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function SortableHeader({ sortKey, sort, onSort, children, className = "" }) {
  const active = sort.key === sortKey;
  const direction = active ? sort.direction : "";
  return (
    <th className={`px-3 py-3 ${className}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold text-slate-950 hover:text-violet-700"
        onClick={() => onSort((current) => ({ key: sortKey, direction: current.key === sortKey && current.direction === "asc" ? "desc" : "asc" }))}
      >
        {children}
        <ArrowUpDown className={`size-3.5 ${active ? "text-violet-700" : "text-slate-400"}`} />
        {active ? <span className="text-[10px] text-violet-700">{direction === "asc" ? "ASC" : "DESC"}</span> : null}
      </button>
    </th>
  );
}

function MenuItem({ icon: Icon, label, onClick, close, className = "" }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        close?.();
      }}
      className={[
        "flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50",
        className,
      ].join(" ")}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {label}
    </button>
  );
}

function PriceRowActions({ canEdit, canDelete, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex justify-end">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((current) => !current)}
        className="ml-auto flex h-8 gap-1 px-2 sm:hidden"
      >
        Acciones
        <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
      </Button>

      {open ? (
        <div className="absolute right-0 top-10 z-30 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg sm:hidden">
          {canEdit ? <MenuItem icon={Edit3} label="Editar" onClick={onEdit} close={() => setOpen(false)} /> : null}
          {canDelete ? <MenuItem icon={Trash2} label="Eliminar" onClick={onDelete} close={() => setOpen(false)} className="text-red-600 hover:bg-red-50" /> : null}
        </div>
      ) : null}

      <div className="hidden justify-end gap-2 sm:flex">
        {canEdit ? <Button variant="outline" size="icon" onClick={onEdit}><Edit3 className="size-4" /></Button> : null}
        {canDelete ? <Button variant="destructive" size="icon" onClick={onDelete}><Trash2 className="size-4" /></Button> : null}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone = "purple" }) {
  const tones = {
    purple: "border-violet-200 bg-violet-50 text-violet-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
  };
  return (
    <div className={`flex items-center justify-between rounded-md border px-2 py-1.5 ${tones[tone]}`}>
      <div className="min-w-0">
        <p className="truncate text-[9px] font-semibold leading-3 sm:text-[10px]">{label}</p>
        <p className="mt-0.5 text-base font-bold leading-5 text-slate-950 sm:text-lg">{value}</p>
      </div>
      <Icon className="hidden size-4 shrink-0 opacity-50 sm:block" />
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return <div className={`space-y-1 ${className}`}><Label className="text-[11px] font-bold text-slate-600">{label}</Label>{children}</div>;
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
