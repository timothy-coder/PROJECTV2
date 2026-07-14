"use client";

import { useMemo, useRef, useState } from "react";
import { Boxes, ChevronDown, Download, Edit3, Layers3, List, Loader2, MapPin, Package, Plus, RefreshCw, Search, Trash2, TrendingUp, Upload, X } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePostInventory } from "@/hooks/postinventory/usePostInventory";
import { hasPerm } from "@/lib/permissions";

function money(value, symbol = "S/") {
  return `${symbol || "S/"} ${Number(value || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const MONTHS = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

function monthName(value) {
  return MONTHS.find((item) => Number(item.value) === Number(value))?.label || "";
}

function monthIndex(year, month) {
  return Number(year || 0) * 12 + Number(month || 0) - 1;
}

function productTypeCode(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "";
  const exact = text.match(/^[ABCDN]$/)?.[0];
  if (exact) return exact;
  return text.match(/\b([ABCDN])\b/)?.[1] || "";
}

function Hint({ label, children, side = "top" }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

function rowValue(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return "";
}

function roundMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : "";
}

function roundPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(4)) : "";
}

function calculateSaleWithoutTax(priceWithTax, factor) {
  const price = Number(priceWithTax || 0);
  if (!Number.isFinite(price) || price <= 0 || !factor) return "";
  return roundMoney(price / factor);
}

function calculateMargin(purchase, saleWithoutTax) {
  const purchaseNumber = Number(purchase || 0);
  const saleNumber = Number(saleWithoutTax || 0);
  if (!Number.isFinite(purchaseNumber) || !Number.isFinite(saleNumber) || saleNumber <= 0) return "";
  return roundPercent((1 - purchaseNumber / saleNumber) * 100);
}

function calculateFromMargin(purchase, margin, taxFactor) {
  const purchaseNumber = Number(purchase || 0);
  const marginNumber = Number(margin || 0);
  if (!Number.isFinite(purchaseNumber) || !Number.isFinite(marginNumber) || purchaseNumber <= 0 || marginNumber >= 100) {
    return { precioVentaSinIgv: "", precioVentaConIgv: "" };
  }
  const withoutTax = purchaseNumber / (1 - marginNumber / 100);
  return {
    precioVentaSinIgv: roundMoney(withoutTax),
    precioVentaConIgv: roundMoney(withoutTax * taxFactor),
  };
}

function buildImportPricingRow(row, index, taxFactor) {
  const precioCompra = rowValue(row, ["precio_compra", "Precio Compra", "PRECIO DE COMPRA", "PRECIO DE COMPRA (SIN IGV)", "precioCompra"]) || 0;
  const precioVentaConIgvInput = rowValue(row, ["precio_venta_con_igv", "Precio Venta Con IGV", "PRECIO VENTA CON IGV", "precio_venta", "Precio Venta", "precioVenta"]) || 0;
  const precioVentaSinIgv = rowValue(row, ["precio_venta_sin_igv", "Precio Venta Sin IGV", "PRECIO VENTA SIN IGV"]) || calculateSaleWithoutTax(precioVentaConIgvInput, taxFactor);
  const margenComercial = rowValue(row, ["margen_comercial", "Margen Comercial", "MARGEN COMERCIAL", "MARGEN COMERCIAL (%)", "margen"]) || calculateMargin(precioCompra, precioVentaSinIgv);
  const calculatedFromMargin = margenComercial !== "" ? calculateFromMargin(precioCompra, margenComercial, taxFactor) : {};
  const precioVentaConIgv = precioVentaConIgvInput || calculatedFromMargin.precioVentaConIgv || "";
  return {
    key: `${index}-${rowValue(row, ["numero_parte", "Numero Parte", "NUMERO DE PARTE", "N Parte", "numeroParte"])}-${rowValue(row, ["numero_comprobante", "Numero Comprobante", "NUMERO DE COMPROBANTE", "numero_factura", "Numero Factura", "NUMERO DE FACTURA"])}`,
    original: row,
    numeroParte: rowValue(row, ["numero_parte", "Numero Parte", "NUMERO DE PARTE", "N Parte", "numeroParte"]),
    descripcion: rowValue(row, ["descripcion", "Descripcion", "DESCRIPCION", "DescripciÃ³n"]),
    numeroFactura: rowValue(row, ["numero_comprobante", "Numero Comprobante", "NUMERO DE COMPROBANTE", "numero_factura", "Numero Factura", "NUMERO DE FACTURA"]),
    unidadMedida: rowValue(row, ["unidad_medida", "Unidad Medida", "UNIDAD DE MEDIDA", "tipo_medida", "Tipo Medida"]),
    fechaVencimiento: rowValue(row, ["fecha_vencimiento", "Fecha Vencimiento", "FECHA DE VENCIMIENTO", "FEHCHA DE VENCIMIENTO"]),
    proveedor: rowValue(row, ["proveedor", "Proveedor", "PROVEEDOR"]),
    procedencia: rowValue(row, ["procedencia", "Procedencia", "PROCEDENCIA"]),
    precioCompra,
    margenComercial,
    precioVentaSinIgv: precioVentaSinIgv || calculatedFromMargin.precioVentaSinIgv || "",
    precioVentaConIgv,
  };
}

function getDefaultCurrencyId(options) {
  return String(
    options?.defaultPostventaCurrencyId ||
      (options?.allCurrencies || []).find((item) => item.isDefaultPosventa)?.id ||
      (options?.currencies || [])[0]?.id ||
      ""
  );
}

export default function PostInventoryPage({ userPermissions, currentUserId = null, fixedView = "", title = "Inventario", subtitle = "Gestion de productos y stock" }) {
  const data = usePostInventory();
  const productImportRef = useRef(null);
  const stockImportRef = useRef(null);
  const soldImportRef = useRef(null);
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [view, setView] = useState(fixedView || "products");
  const [productDialog, setProductDialog] = useState({ open: false, item: null, readonly: false });
  const [productImportDialog, setProductImportDialog] = useState({ open: false, rows: [] });
  const [comboDialog, setComboDialog] = useState({ open: false, item: null, readonly: false });
  const [soldDialog, setSoldDialog] = useState({ open: false, item: null, readonly: false });
  const [stockDialog, setStockDialog] = useState({ open: false, product: null });
  const [locationDialog, setLocationDialog] = useState({ open: false, item: null });
  const [lotDialog, setLotDialog] = useState({ open: false, product: null, item: null, readonly: false });
  const [lotListDialog, setLotListDialog] = useState({ open: false, product: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, title: "", onConfirm: null });
  const [formatsMenuOpen, setFormatsMenuOpen] = useState(false);
  const canView = hasPerm(userPermissions, ["inventario", "view"]);
  const canCreate = hasPerm(userPermissions, ["inventario", "create"]);
  const canEdit = hasPerm(userPermissions, ["inventario", "edit"]);
  const canDelete = hasPerm(userPermissions, ["inventario", "delete"]);
  const canLocationView = hasPerm(userPermissions, ["ubicacion_inventario", "view"]);
  const canLocationCreate = hasPerm(userPermissions, ["ubicacion_inventario", "create"]);
  const canLocationEdit = hasPerm(userPermissions, ["ubicacion_inventario", "edit"]);
  const canLocationDelete = hasPerm(userPermissions, ["ubicacion_inventario", "delete"]);
  const canLocationImport = hasPerm(userPermissions, ["ubicacion_inventario", "import"]);
  const hasLegacyLots = hasPerm(userPermissions, ["inventario", "lotes"]);
  const canLotsViewOwn = hasPerm(userPermissions, ["inventario", "lotes_view"]) || hasLegacyLots;
  const canLotsViewAll = hasPerm(userPermissions, ["inventario", "lotes_viewall"]);
  const canLotsEditOwn = hasPerm(userPermissions, ["inventario", "lotes_edit"]) || hasLegacyLots;
  const canLotsEditAll = hasPerm(userPermissions, ["inventario", "lotes_editall"]);
  const canLots = canLotsViewOwn || canLotsViewAll;
  const canCreateLot = canLotsEditOwn || canLotsEditAll;
  const inventorySettings = data.options?.settings || {};
  const assignedShelfIds = useMemo(() => new Set((data.options?.shelves || []).map((item) => Number(item.id))), [data.options?.shelves]);
  const scopedProducts = useMemo(() => data.products.map((product) => ({
    ...product,
    lotes: (product.lotes || []).filter((lot) => {
      if (canLotsViewAll) return true;
      if (!canLotsViewOwn) return false;
      return Number(lot.createdBy || 0) === Number(currentUserId || 0);
    }),
  })), [canLotsViewAll, canLotsViewOwn, currentUserId, data.products]);

  const stockRotationByProduct = useMemo(() => {
    const now = new Date();
    const currentIndex = monthIndex(now.getFullYear(), now.getMonth() + 1);
    const previousSixMonths = new Set(Array.from({ length: 6 }, (_, index) => currentIndex - index - 1));
    const totals = new Map();

    (data.soldProducts || []).forEach((item) => {
      const key = monthIndex(item.anio, item.mes);
      if (!previousSixMonths.has(key)) return;
      const productId = Number(item.productoId || 0);
      totals.set(productId, (totals.get(productId) || 0) + Number(item.cantidad || 0));
    });

    const result = new Map();
    totals.forEach((total, productId) => {
      result.set(productId, {
        sixMonthSales: total,
        average: total / 6,
      });
    });
    return result;
  }, [data.soldProducts]);

  const filteredProducts = useMemo(() => {
    const clean = query.trim().toLowerCase();
    const filtered = scopedProducts.filter((product) => {
      const matchesQuery = !clean || `${product.numeroParte} ${product.descripcion} ${product.marca} ${product.procedencia}`.toLowerCase().includes(clean);
      const matchesBrand = !brandFilter || String(product.marca || "").toLowerCase() === String(brandFilter).toLowerCase();
      const matchesProvider = !providerFilter || (product.lotes || []).some((lot) => String(lot.proveedorId || "") === String(providerFilter));
      return matchesQuery && matchesBrand && matchesProvider;
    });
    return filtered.map((product) => ({
      ...product,
      ...(() => {
        const available = Number(product.stockDisponible ?? product.stock.reduce((sum, item) => sum + Number(item.stock || 0), 0));
        const rotation = stockRotationByProduct.get(Number(product.id)) || { average: 0, sixMonthSales: 0 };
        const typeCode = productTypeCode(product.respuestaFinalLogistica || product.tipoLogistico);
        const isLowStockByRotation = ["A", "B", "C"].includes(typeCode) && rotation.average > 0 && available < rotation.average;
        return {
          available,
          rotationAverage: rotation.average,
          rotationSixMonthSales: rotation.sixMonthSales,
          typeCode,
          isLowStockByRotation,
        };
      })(),
    }));
  }, [brandFilter, providerFilter, query, scopedProducts, stockRotationByProduct]);
  const brandOptions = useMemo(() => {
    const names = Array.from(new Set(data.products.map((product) => String(product.marca || "").trim()).filter(Boolean)));
    return [{ value: "__all", label: "Todas" }, ...names.sort((a, b) => a.localeCompare(b, "es")).map((name) => ({ value: name, label: name }))];
  }, [data.products]);
  const providerFilterOptions = useMemo(() => (data.options?.providers || []).map((item) => ({
    value: item.id,
    label: `${item.nombre}${item.ruc ? ` - ${item.ruc}` : ""}`,
  })), [data.options?.providers]);
  const providerOptionsWithAll = useMemo(() => [{ value: "__all", label: "Todos" }, ...providerFilterOptions], [providerFilterOptions]);
  const filteredCombos = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return clean
      ? data.combos.filter((combo) => `${combo.codigo} ${combo.nombre} ${combo.descripcion}`.toLowerCase().includes(clean))
      : data.combos;
  }, [data.combos, query]);
  const filteredSoldProducts = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return clean
      ? data.soldProducts.filter((item) => `${item.numeroParte} ${item.descripcion} ${item.anio} ${monthName(item.mes)}`.toLowerCase().includes(clean))
      : data.soldProducts;
  }, [data.soldProducts, query]);
  const filteredLocations = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return clean
      ? data.stocks.filter((item) => `${item.numeroParte} ${item.descripcion} ${item.loteLabel} ${item.anaquelCodigo} ${item.nivelCodigo} ${item.posicion} ${item.tallerName} ${item.mostradorName}`.toLowerCase().includes(clean))
      : data.stocks;
  }, [data.stocks, query]);
  const searchLabel = view === "products" ? "Buscar producto" : view === "combos" ? "Buscar combo" : view === "locations" ? "Buscar ubicacion" : "Buscar producto vendido";
  const searchPlaceholder = view === "products"
    ? "Buscar por N parte o descripcion..."
    : view === "combos"
      ? "Buscar por codigo, nombre o descripcion..."
      : view === "locations"
        ? "Buscar por producto, lote, anaquel, nivel o posicion..."
        : "Buscar por producto, anio o mes...";

  const isLocationPage = fixedView === "locations";
  const canPageView = isLocationPage ? canLocationView : canView;

  if (!canPageView) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver {isLocationPage ? "ubicaciones de inventario" : "inventario"}.</div>;
  }

  async function exportProductsFormat() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet([
      {
        "NUMERO DE PARTE": "ABC-12345",
        DESCRIPCION: "Filtro de aceite",
        MARCA: "FORD",
        "TIPO INVENTARIO": "Repuestos",
        "FECHA INGRESO": "2026-06-05",
        "UNIDAD DE MEDIDA": "Unidad",
        "FECHA DE VENCIMIENTO": "2027-06-05",
        "NUMERO DE FACTURA": "F001-000123",
        PROVEEDOR: "Proveedor SAC",
        PROCEDENCIA: "FORD",
        "STOCK LOTE": 10,
        "PRECIO DE COMPRA (SIN IGV)": 25,
        "MARGEN COMERCIAL (%)": 37.5,
        "PRECIO VENTA SIN IGV": 40,
        "PRECIO VENTA CON IGV": 47.2,
        MONEDA: "PEN",
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "productos");
    XLSX.writeFile(workbook, "formato_productos_inventario.xlsx");
  }

  async function exportStockFormat() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet([
      {
        lote_id: 1,
        anaquel: "A-01",
        nivel: "N1",
        posicion: 1,
        cantidad: 5,
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "stock");
    XLSX.writeFile(workbook, "formato_stock_inventario.xlsx");
  }

  async function exportSoldProductsFormat() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet([
      {
        numero_parte: "ABC-12345",
        fecha_venta: "15/07/2022 17:28:13",
        cantidad: 1,
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "productos_vendidos");
    XLSX.writeFile(workbook, "formato_productos_vendidos.xlsx");
  }

  async function importRowsFromFile(event, importer, successLabel) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      const result = await importer(rows);
      const errorsText = result.errors?.length ? ` Filas con error: ${result.errors.length}.` : "";
      toast.success(`${successLabel}: ${result.imported || 0} importados${result.updated ? `, ${result.updated} actualizados` : ""}.${errorsText}`);
    } catch (error) {
      toast.error(error.message || "No se pudo importar el archivo.");
    } finally {
      event.target.value = "";
    }
  }

  async function readRowsFromFile(event) {
    const file = event.target.files?.[0];
    if (!file) return [];
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  }

  async function openProductImportDialog(event) {
    try {
      const rows = await readRowsFromFile(event);
      if (!rows.length) {
        toast.error("El archivo no tiene filas para importar.");
        return;
      }
      setProductImportDialog({ open: true, rows });
    } catch (error) {
      toast.error(error.message || "No se pudo leer el archivo.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 p-3 text-slate-950 md:h-svh sm:p-4">
      <div className="mb-3 flex shrink-0 flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-violet-700 text-white">
            {isLocationPage ? <MapPin className="size-5" /> : <Package className="size-5" />}
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-950">{title}</h1>
            <p className="text-xs font-medium text-slate-500">{subtitle}</p>
          </div>
        </div>
        {(isLocationPage ? canLocationImport : canCreate) ? (
          <div className="relative w-full sm:w-64">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormatsMenuOpen((current) => !current)}
              className="h-10 w-full justify-center"
            >
              Opciones
              <ChevronDown className={`size-4 transition ${formatsMenuOpen ? "rotate-180" : ""}`} />
            </Button>
            {formatsMenuOpen ? (
              <div className="absolute right-0 top-11 z-30 w-full overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
                {!isLocationPage && canCreate ? <MenuItem icon={Download} label="Formato productos" onClick={exportProductsFormat} close={() => setFormatsMenuOpen(false)} /> : null}
                {!isLocationPage && canCreate ? <MenuItem icon={Upload} label="Ingreso masivo productos" onClick={() => productImportRef.current?.click()} close={() => setFormatsMenuOpen(false)} /> : null}
                {isLocationPage && canLocationImport ? <MenuItem icon={Download} label="Formato ubicaciones" onClick={exportStockFormat} close={() => setFormatsMenuOpen(false)} /> : null}
                {isLocationPage && canLocationImport ? <MenuItem icon={Upload} label="Ingreso masivo ubicaciones" onClick={() => stockImportRef.current?.click()} close={() => setFormatsMenuOpen(false)} /> : null}
                {!isLocationPage && canCreate ? <MenuItem icon={Download} label="Formato vendidos" onClick={exportSoldProductsFormat} close={() => setFormatsMenuOpen(false)} /> : null}
                {!isLocationPage && canCreate ? <MenuItem icon={Upload} label="Importar vendidos" onClick={() => soldImportRef.current?.click()} close={() => setFormatsMenuOpen(false)} /> : null}
              </div>
            ) : null}
            <input ref={productImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={openProductImportDialog} />
            <input ref={stockImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => importRowsFromFile(event, data.importStock, "Ubicaciones importadas")} />
            <input ref={soldImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => importRowsFromFile(event, data.importSoldProducts, "Productos vendidos importados")} />
          </div>
        ) : null}
      </div>

      <div className="mb-3 grid grid-cols-3 shrink-0 gap-2">
        <Stat label="Total Productos" value={data.stats.products} tone="blue" icon={Package} />
        <Stat label="Stock Total" value={data.stats.totalStock} tone="green" icon={TrendingUp} />
        <Stat label="Combos / Vendidos" value={`${data.stats.combos} / ${data.stats.soldProducts}`} tone="purple" icon={Layers3} />
      </div>

      {!fixedView ? <div className="mb-3 inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        <Button type="button" size="sm" variant={view === "products" ? "default" : "ghost"} onClick={() => setView("products")} className={view === "products" ? "bg-violet-700 text-white hover:bg-violet-800" : ""}>
          <Package className="size-4" />Productos
        </Button>
        <Button type="button" size="sm" variant={view === "combos" ? "default" : "ghost"} onClick={() => setView("combos")} className={view === "combos" ? "bg-violet-700 text-white hover:bg-violet-800" : ""}>
          <Layers3 className="size-4" />Combos
        </Button>
        <Button type="button" size="sm" variant={view === "soldProducts" ? "default" : "ghost"} onClick={() => setView("soldProducts")} className={view === "soldProducts" ? "bg-violet-700 text-white hover:bg-violet-800" : ""}>
          <TrendingUp className="size-4" />Productos vendidos
        </Button>
      </div> : null}

      <section className="mb-3 shrink-0 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="min-w-0 space-y-1.5">
            <Label>{searchLabel}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} className="h-10 bg-white pl-9" />
            </div>
          </div>
          <div className={view === "products" ? "grid grid-cols-2 items-end gap-2 md:grid-cols-[180px_220px_auto_auto] md:justify-end" : "grid grid-cols-2 gap-2 sm:flex sm:flex-row md:justify-end"}>
            {view === "products" ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[11px] sm:text-xs">Marca</Label>
                  <SearchableSelect
                    value={brandFilter}
                    options={brandOptions}
                    placeholder="Todas las marcas"
                    searchPlaceholder="Buscar marca..."
                    emptyText="No hay marcas."
                    onChange={(value) => setBrandFilter(value === "__all" ? "" : value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] sm:text-xs">Proveedor</Label>
                  <SearchableSelect
                    value={providerFilter}
                    options={providerOptionsWithAll}
                    placeholder="Todos los proveedores"
                    searchPlaceholder="Buscar proveedor..."
                    emptyText="No hay proveedores."
                    onChange={(value) => setProviderFilter(value === "__all" ? "" : value)}
                  />
                </div>
              </>
            ) : null}
            <Button variant="outline" onClick={data.reload} className="h-10 px-2 text-xs sm:px-4 sm:text-sm"><RefreshCw className="size-4" />Recargar</Button>
            {canCreate && view === "products" ? <Button onClick={() => setProductDialog({ open: true, item: null, readonly: false })} className="h-10 bg-violet-700 px-2 text-xs text-white hover:bg-violet-800 sm:px-4 sm:text-sm"><Plus className="size-4" />Nuevo Producto</Button> : null}
            {canCreate && view === "combos" ? <Button onClick={() => setComboDialog({ open: true, item: null, readonly: false })} className="h-10 bg-violet-700 text-white hover:bg-violet-800"><Plus className="size-4" />Nuevo Combo</Button> : null}
            {canLocationCreate && view === "locations" ? <Button onClick={() => setLocationDialog({ open: true, item: null })} className="h-10 bg-violet-700 text-white hover:bg-violet-800"><Plus className="size-4" />Nueva ubicacion</Button> : null}
            {canCreate && view === "soldProducts" ? <Button onClick={() => setSoldDialog({ open: true, item: null, readonly: false })} className="h-10 bg-violet-700 text-white hover:bg-violet-800"><Plus className="size-4" />Nuevo vendido</Button> : null}
          </div>
        </div>
      </section>

      {view === "products" ? <ProductsTable
        loading={data.loading}
        products={filteredProducts}
        total={data.products.length}
        canEdit={canEdit}
        canDelete={canDelete}
        canStock={canLocationView}
        canLots={canLots}
        canCreateLot={canCreateLot}
        currentUserId={currentUserId}
        canEditLotOwn={canLotsEditOwn}
        canEditLotAll={canLotsEditAll}
        settings={inventorySettings}
        onEdit={(product) => setProductDialog({ open: true, item: product, readonly: false })}
        onStock={(product) => setStockDialog({ open: true, product })}
        onLot={(product) => setLotDialog({ open: true, product, item: null, readonly: false })}
        onManageLots={(product) => setLotListDialog({ open: true, product })}
        onEditLot={(product, item, readonly = false) => setLotDialog({ open: true, product, item, readonly })}
        onDeleteLot={(lot) => setDeleteDialog({ open: true, title: `Eliminar lote ${lot.numeroFactura}`, onConfirm: () => data.deleteLot(lot.id) })}
        onDelete={(product) => setDeleteDialog({ open: true, title: `Eliminar ${product.numeroParte}`, onConfirm: () => data.deleteProduct(product.id) })}
      /> : view === "combos" ? <CombosTable
        loading={data.loading}
        combos={filteredCombos}
        total={data.combos.length}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={(combo) => setComboDialog({ open: true, item: combo, readonly: false })}
        onToggleActive={(combo, checked) => data.updateCombo(combo.id, {
          codigo: combo.codigo,
          nombre: combo.nombre,
          descripcion: combo.descripcion,
          isActive: checked,
          items: combo.items,
        })}
        onDelete={(combo) => setDeleteDialog({ open: true, title: `Eliminar ${combo.nombre}`, onConfirm: () => data.deleteCombo(combo.id) })}
      /> : view === "locations" && canLocationView ? <InventoryLocationsTable
        loading={data.loading}
        locations={filteredLocations}
        total={data.stocks.length}
        canEdit={canLocationEdit}
        canDelete={canLocationDelete}
        assignedShelfIds={assignedShelfIds}
        onEdit={(item) => setLocationDialog({ open: true, item })}
        onDelete={(item) => setDeleteDialog({ open: true, title: `Eliminar ubicacion ${item.numeroParte}`, onConfirm: () => data.deleteStock(item.id) })}
      /> : <SoldProductsTable
        loading={data.loading}
        items={filteredSoldProducts}
        total={data.soldProducts.length}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={(item) => setSoldDialog({ open: true, item, readonly: false })}
        onDelete={(item) => setDeleteDialog({ open: true, title: `Eliminar venta ${item.numeroParte}`, onConfirm: () => data.deleteSoldProduct(item.id) })}
      />}

      {productDialog.open ? (
        <ProductDialog
          key={`${productDialog.item?.id || "new"}-${productDialog.readonly}`}
          state={productDialog}
          options={data.options}
          settings={inventorySettings}
          onClose={() => setProductDialog({ open: false, item: null, readonly: false })}
          onSubmit={async (payload) => {
            if (productDialog.item) {
              await data.updateProduct(productDialog.item.id, payload);
              toast.success("Producto actualizado");
            } else {
              await data.createProduct(payload);
              toast.success("Producto creado");
            }
            setProductDialog({ open: false, item: null, readonly: false });
          }}
        />
      ) : null}
      {lotDialog.open ? (
        <LotDialog
          key={`${lotDialog.product?.id || "product"}-${lotDialog.item?.id || "new"}-${lotDialog.readonly}`}
          state={lotDialog}
          options={data.options}
          settings={inventorySettings}
          onClose={() => setLotDialog({ open: false, product: null, item: null, readonly: false })}
          onSubmit={async (payload) => {
            if (lotDialog.item) {
              await data.updateLot(lotDialog.item.id, payload);
              toast.success("Lote actualizado");
            } else {
              await data.createLot(payload);
              toast.success("Lote creado");
            }
            setLotDialog({ open: false, product: null, item: null, readonly: false });
          }}
        />
      ) : null}
      {productImportDialog.open ? (
        <ProductImportPricingDialog
          state={productImportDialog}
          options={data.options}
          onClose={() => setProductImportDialog({ open: false, rows: [] })}
          onSubmit={async (rows) => {
            const result = await data.importProducts(rows);
            const errorsText = result.errors?.length ? ` Filas con error: ${result.errors.length}.` : "";
            const lotsText = result.lotsImported || result.lotsUpdated ? ` Lotes: ${result.lotsImported || 0} creados${result.lotsUpdated ? `, ${result.lotsUpdated} actualizados` : ""}.` : "";
            toast.success(`Productos importados: ${result.imported || 0} importados${result.updated ? `, ${result.updated} actualizados` : ""}.${lotsText}${errorsText}`);
            setProductImportDialog({ open: false, rows: [] });
          }}
        />
      ) : null}
      {lotListDialog.open ? (
        <LotsListDialog
          product={lotListDialog.product}
          currentUserId={currentUserId}
          canEditOwn={canLotsEditOwn}
          canEditAll={canLotsEditAll}
          canDelete={canDelete}
          onClose={() => setLotListDialog({ open: false, product: null })}
          onEditLot={(product, lot) => {
            setLotListDialog({ open: false, product: null });
            setLotDialog({ open: true, product, item: lot, readonly: false });
          }}
          onDeleteLot={(lot) => setDeleteDialog({ open: true, title: `Eliminar lote ${lot.numeroFactura}`, onConfirm: () => data.deleteLot(lot.id) })}
        />
      ) : null}
      {comboDialog.open ? (
        <ComboDialog
          key={`${comboDialog.item?.id || "new"}-${comboDialog.readonly}`}
          state={comboDialog}
          products={data.products}
          activeTax={data.options.activeTax}
          onClose={() => setComboDialog({ open: false, item: null, readonly: false })}
          onSubmit={async (payload) => {
            if (comboDialog.item) {
              await data.updateCombo(comboDialog.item.id, payload);
              toast.success("Combo actualizado");
            } else {
              await data.createCombo(payload);
              toast.success("Combo creado");
            }
            setComboDialog({ open: false, item: null, readonly: false });
          }}
        />
      ) : null}
      {soldDialog.open ? (
        <SoldProductDialog
          key={`${soldDialog.item?.id || "new"}-${soldDialog.readonly}`}
          state={soldDialog}
          products={data.products}
          onClose={() => setSoldDialog({ open: false, item: null, readonly: false })}
          onSubmit={async (payload) => {
            if (soldDialog.item) {
              await data.updateSoldProduct(soldDialog.item.id, payload);
              toast.success("Producto vendido actualizado");
            } else {
              await data.createSoldProduct(payload);
              toast.success("Producto vendido guardado");
            }
            setSoldDialog({ open: false, item: null, readonly: false });
          }}
        />
      ) : null}
      {stockDialog.open ? (
        <StockDistributionDialog
          state={stockDialog}
          options={data.options}
          actions={data}
          canCreate={canLocationCreate}
          canEdit={canLocationEdit}
          canDelete={canLocationDelete}
          assignedShelfIds={assignedShelfIds}
          onClose={() => setStockDialog({ open: false, product: null })}
        />
      ) : null}
      {locationDialog.open ? (
        <InventoryLocationDialog
          key={locationDialog.item?.id || "new-location"}
          state={locationDialog}
          options={data.options}
          onClose={() => setLocationDialog({ open: false, item: null })}
          onSubmit={async (payload) => {
            if (locationDialog.item) {
              await data.updateStock(locationDialog.item.id, payload);
              toast.success("Ubicacion actualizada");
            } else {
              await data.createStock(payload);
              toast.success("Ubicacion creada");
            }
            setLocationDialog({ open: false, item: null });
          }}
        />
      ) : null}
      <DeleteDialog state={deleteDialog} onClose={() => setDeleteDialog({ open: false, title: "", onConfirm: null })} />
    </div>
  );
}

function ProductsTable({ loading, products, total, canEdit, canDelete, canStock, canLots, canCreateLot, currentUserId, canEditLotOwn, canEditLotAll, settings, onEdit, onStock, onLot, onManageLots, onEditLot, onDeleteLot, onDelete }) {
  const useLots = settings?.habilitarLotes !== false;
  function canManageLot(lot) {
    const isOwn = Number(lot.createdBy || 0) === Number(currentUserId || 0);
    return (canEditLotAll || (canEditLotOwn && isOwn)) && lot.canAccessLocation;
  }
  const showProcedencia = Boolean(settings?.habilitarProcedencia);
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-3">N Parte</th>
                <th className="px-3 py-3">Descripcion</th>
                <th className="px-3 py-3">Marca</th>
                {showProcedencia ? <th className="px-3 py-3">Procedencia</th> : null}
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">Disponible</th>
                <th className="px-3 py-3">Precio Venta</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={showProcedencia ? 8 : 7} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
              ) : products.map((product) => (
                <tr key={product.id} className={product.isLowStockByRotation ? "bg-violet-50/80 hover:bg-violet-100/80" : undefined}>
                  <td className="px-3 py-3 font-bold text-slate-950">{product.numeroParte}</td>
                  <td className="px-3 py-3">{product.descripcion}</td>
                  <td className="px-3 py-3">{product.marca || "-"}</td>
                  {showProcedencia ? <td className="px-3 py-3">{product.procedencia || "-"}</td> : null}
                  <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{product.tipoNombre}</span></td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-emerald-700">{product.available}</div>
                    {product.isLowStockByRotation ? (
                      <div className="text-xs font-black text-violet-700">
                        Stock bajo
                      </div>
                    ) : null}
                    {useLots ? <div className="text-xs font-medium text-slate-500">{product.lotes?.length || 0} lotes</div> : null}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-slate-950">{money(product.precioVenta, product.monedaSimbolo)}</div>
                    <div className="text-xs font-medium text-slate-500">{product.monedaCodigo || "Sin moneda"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      {canEdit ? <Button variant="ghost" size="icon" onClick={() => onEdit(product)}><Edit3 className="size-4" /></Button> : null}
                      {useLots && canCreateLot ? <Button variant="ghost" size="icon" onClick={() => onLot(product)} title="Agregar lote"><Layers3 className="size-4" /></Button> : null}
                      {useLots ? <Button variant="ghost" size="icon" onClick={() => onManageLots(product)} title="Ver lotes"><List className="size-4" /></Button> : null}
                      {canStock ? <Button variant="ghost" size="icon" onClick={() => onStock(product)}><Boxes className="size-4" /></Button> : null}
                      {canDelete ? <Button variant="destructive" size="icon" onClick={() => onDelete(product)}><Trash2 className="size-4" /></Button> : null}
                    </div>
                    {useLots && product.lotes?.length ? (
                      <div className="mt-2 flex justify-end gap-1">
                        {product.lotes.slice(0, 2).map((lot) => {
                          const canManage = canManageLot(lot);
                          return (
                          <span key={lot.id} className="inline-flex overflow-hidden rounded-full bg-violet-50 text-[11px] font-bold text-violet-700">
                            <button
                              type="button"
                              title={canManage ? "Editar lote" : "Ver lote"}
                              onClick={() => onEditLot(product, lot, !canManage)}
                              className="px-2 py-1 hover:bg-violet-100"
                            >
                              {lot.numeroFactura} ({lot.stockDisponible})
                            </button>
                            {canDelete && canManage ? <button type="button" onClick={() => onDeleteLot(lot)} className="border-l border-violet-100 px-1.5 py-1 text-red-600">x</button> : null}
                          </span>
                          );
                        })}
                        {product.lotes.length > 2 ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">+{product.lotes.length - 2}</span> : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span>Pagina 1 de 1 - {products.length} de {total} productos</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2 py-1 font-bold text-violet-700">
              <span className="size-2 rounded-full bg-violet-600" />
              Morado: stock bajo
            </span>
          </div>
          <div className="flex gap-2"><Button variant="outline" disabled>Anterior</Button><Button variant="outline" disabled>Siguiente</Button></div>
        </div>
      </section>
  );
}

function LotsListDialog({ product, currentUserId, canEditOwn, canEditAll, canDelete, onClose, onEditLot, onDeleteLot }) {
  const lots = product?.lotes || [];
  function canManageLot(lot) {
    const isOwn = Number(lot.createdBy || 0) === Number(currentUserId || 0);
    const hasScope = canEditAll || (canEditOwn && isOwn);
    return hasScope && lot.canAccessLocation;
  }
  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] w-[min(98vw,1180px)] max-w-none overflow-hidden bg-white p-0 text-slate-950 sm:max-w-[1180px]">
        <DialogHeader className="border-b border-violet-100 p-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700">
            <Layers3 className="size-5" />Lotes ingresados
          </DialogTitle>
          <DialogDescription>{product?.numeroParte} - {product?.descripcion}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70svh] overflow-auto p-3">
          <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs font-bold text-slate-500">
              <tr>
                <th className="w-[15%] border-b px-3 py-2">Comprobante</th>
                <th className="w-[19%] border-b px-3 py-2">Proveedor</th>
                <th className="w-[12%] border-b px-3 py-2">Medida</th>
                <th className="w-[12%] border-b px-3 py-2">Vencimiento</th>
                <th className="w-[12%] border-b px-3 py-2">Compra</th>
                <th className="w-[11%] border-b px-3 py-2">Stock</th>
                <th className="w-[12%] border-b px-3 py-2">Creado por</th>
                <th className="w-[7%] border-b px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lots.length ? lots.map((lot) => {
                const canManage = canManageLot(lot);
                return (
                  <tr key={lot.id}>
                    <td className="px-3 py-2">
                      <div className="truncate font-bold text-slate-950">{lot.numeroFactura || "-"}</div>
                      <div className="truncate text-xs font-semibold text-violet-600">{lot.tipoComprobanteNombre || lot.tipoComprobanteCodigo || "-"}</div>
                    </td>
                    <td className="truncate px-3 py-2 text-slate-600">{lot.proveedorNombre || "-"}</td>
                    <td className="truncate px-3 py-2 text-slate-600">{lot.tipoMedidaNombre || lot.tipoMedidaAbreviatura || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{lot.fechaVencimiento ? new Date(lot.fechaVencimiento).toLocaleDateString("es-PE") : "-"}</td>
                    <td className="truncate px-3 py-2 font-semibold text-slate-950">{money(lot.precioCompra, lot.monedaSimbolo || product?.monedaSimbolo)}</td>
                    <td className="px-3 py-2">
                      <div className="font-bold text-emerald-700">{lot.stockDisponible}</div>
                      <div className="text-xs text-slate-500">Total {lot.stockLote} / usado {lot.stockUsado}</div>
                    </td>
                    <td className="truncate px-3 py-2 text-slate-600">{lot.createdByName || "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        {canManage ? <Button variant="ghost" size="icon" onClick={() => onEditLot(product, lot)} title="Editar lote"><Edit3 className="size-4" /></Button> : null}
                        {canDelete && canManage ? <Button variant="destructive" size="icon" onClick={() => onDeleteLot(lot)} title="Eliminar lote"><Trash2 className="size-4" /></Button> : null}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={8} className="py-10 text-center text-slate-500">No hay lotes registrados para este producto.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <DialogFooter className="border-t border-slate-200 p-3">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InventoryLocationsTable({ loading, locations, total, canEdit, canDelete, assignedShelfIds, onEdit, onDelete }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-3 py-3">Producto</th>
              <th className="px-3 py-3">Descripcion</th>
              <th className="px-3 py-3">Lote</th>
              <th className="px-3 py-3">Ubicacion</th>
              <th className="px-3 py-3">Cantidad</th>
              <th className="px-3 py-3">Creado</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
            ) : locations.length ? locations.map((item) => {
              const locationLabel = compactStockLabel(item);
              const placeLabel = item.tallerName || item.mostradorName || "-";
              const fullLocation = stockTooltipLabel(item);
              const canManageRow = assignedShelfIds.has(Number(item.anaquelId));
              return (
              <tr key={item.id}>
                <td className="px-3 py-3 font-bold text-violet-700">{item.numeroParte || item.productoId}</td>
                <td className="max-w-[360px] truncate px-3 py-3 text-slate-600">{item.descripcion || "-"}</td>
                <td className="px-3 py-3 font-bold text-slate-950">{item.loteLabel || item.loteId}</td>
                <td className="px-3 py-3">
                  <Hint label={fullLocation} side="top">
                    <div className="w-fit max-w-[260px] cursor-help">
                      <div className="truncate font-bold text-slate-950">{locationLabel}</div>
                      <div className="truncate text-xs font-medium text-slate-500">{placeLabel}</div>
                    </div>
                  </Hint>
                </td>
                <td className="px-3 py-3 font-bold text-emerald-700">{item.stock}</td>
                <td className="px-3 py-3 text-slate-600">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("es-PE") : "-"}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    {canEdit && canManageRow ? (
                      <Hint label="Editar ubicacion">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(item)}><Edit3 className="size-4" /></Button>
                      </Hint>
                    ) : null}
                    {canDelete && canManageRow ? (
                      <Hint label="Eliminar ubicacion">
                        <Button variant="destructive" size="icon" onClick={() => onDelete(item)}><Trash2 className="size-4" /></Button>
                      </Hint>
                    ) : null}
                  </div>
                </td>
              </tr>
              );
            }) : (
              <tr><td colSpan={7} className="py-10 text-center text-slate-500">No hay ubicaciones registradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 justify-between bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
        <span>Pagina 1 de 1 - {locations.length} de {total} ubicaciones</span>
        <div className="flex gap-2"><Button variant="outline" disabled>Anterior</Button><Button variant="outline" disabled>Siguiente</Button></div>
      </div>
    </section>
  );
}

function CombosTable({ loading, combos, total, canEdit, canDelete, onEdit, onToggleActive, onDelete }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-3 py-3">Codigo</th>
              <th className="px-3 py-3">Nombre</th>
              <th className="px-3 py-3">Descripcion</th>
              <th className="px-3 py-3">Productos</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
            ) : combos.length ? combos.map((combo) => (
              <tr key={combo.id}>
                <td className="px-3 py-3 font-bold text-violet-700">{combo.codigo || "-"}</td>
                <td className="px-3 py-3 font-bold text-slate-950">{combo.nombre}</td>
                <td className="max-w-[320px] truncate px-3 py-3 text-slate-600">{combo.descripcion || "-"}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {combo.items.slice(0, 3).map((item) => (
                      <span key={item.id} className="rounded-full bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">
                        {item.numeroParte} x{item.cantidad}{Number(item.descuentoValor || 0) > 0 ? ` - Desc. ${item.descuentoTipo === "porcentaje" ? `${item.descuentoValor}%` : item.descuentoValor}` : ""}
                      </span>
                    ))}
                    {combo.items.length > 3 ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">+{combo.items.length - 3}</span> : null}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Switch
                    disabled={!canEdit}
                    checked={Boolean(combo.isActive)}
                    onCheckedChange={(checked) => onToggleActive(combo, checked)}
                    aria-label={combo.isActive ? "Desactivar combo" : "Activar combo"}
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    {canEdit ? <Button variant="ghost" size="icon" onClick={() => onEdit(combo)}><Edit3 className="size-4" /></Button> : null}
                    {canDelete ? <Button variant="destructive" size="icon" onClick={() => onDelete(combo)}><Trash2 className="size-4" /></Button> : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="py-10 text-center text-slate-500">No hay combos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 justify-between bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
        <span>Pagina 1 de 1 - {combos.length} de {total} combos</span>
        <div className="flex gap-2"><Button variant="outline" disabled>Anterior</Button><Button variant="outline" disabled>Siguiente</Button></div>
      </div>
    </section>
  );
}

function SoldProductsTable({ loading, items, total, canEdit, canDelete, onEdit, onDelete }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-3 py-3">Producto</th>
              <th className="px-3 py-3">Descripcion</th>
              <th className="px-3 py-3">Anio</th>
              <th className="px-3 py-3">Mes</th>
              <th className="px-3 py-3">Cantidad</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
            ) : items.length ? items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-3 font-bold text-violet-700">{item.numeroParte}</td>
                <td className="max-w-[360px] truncate px-3 py-3 text-slate-600">{item.descripcion}</td>
                <td className="px-3 py-3 font-bold text-slate-950">{item.anio}</td>
                <td className="px-3 py-3"><span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">{monthName(item.mes)}</span></td>
                <td className="px-3 py-3 font-bold text-emerald-700">{item.cantidad}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    {canEdit ? <Button variant="ghost" size="icon" onClick={() => onEdit(item)}><Edit3 className="size-4" /></Button> : null}
                    {canDelete ? <Button variant="destructive" size="icon" onClick={() => onDelete(item)}><Trash2 className="size-4" /></Button> : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="py-10 text-center text-slate-500">No hay productos vendidos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 justify-between bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
        <span>Pagina 1 de 1 - {items.length} de {total} registros</span>
        <div className="flex gap-2"><Button variant="outline" disabled>Anterior</Button><Button variant="outline" disabled>Siguiente</Button></div>
      </div>
    </section>
  );
}

function ProductImportPricingDialog({ state, options, onClose, onSubmit }) {
  const taxPercent = Number(options?.activeTax?.porcentaje || 0) || 18;
  const taxFactor = 1 + taxPercent / 100;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState(() => (state.rows || []).map((row, index) => buildImportPricingRow(row, index, taxFactor)));

  function updateRow(index, changes) {
    setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  }

  function updatePurchase(index, value) {
    const current = rows[index] || {};
    if (current.margenComercial !== "") {
      updateRow(index, { precioCompra: value, ...calculateFromMargin(value, current.margenComercial, taxFactor) });
      return;
    }
    const withoutTax = calculateSaleWithoutTax(current.precioVentaConIgv, taxFactor);
    updateRow(index, {
      precioCompra: value,
      precioVentaSinIgv: withoutTax,
      margenComercial: calculateMargin(value, withoutTax),
    });
  }

  function updateMargin(index, value) {
    const current = rows[index] || {};
    updateRow(index, { margenComercial: value, ...calculateFromMargin(current.precioCompra, value, taxFactor) });
  }

  function updateSaleWithTax(index, value) {
    const current = rows[index] || {};
    const withoutTax = calculateSaleWithoutTax(value, taxFactor);
    updateRow(index, {
      precioVentaConIgv: value,
      precioVentaSinIgv: withoutTax,
      margenComercial: calculateMargin(current.precioCompra, withoutTax),
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payloadRows = rows.map((item) => ({
        ...item.original,
        precio_compra: item.precioCompra || 0,
        margen_comercial: item.margenComercial,
        precio_venta_sin_igv: item.precioVentaSinIgv,
        precio_venta_con_igv: item.precioVentaConIgv,
        precio_venta: item.precioVentaConIgv,
      }));
      await onSubmit(payloadRows);
    } catch (err) {
      setError(err.message || "No se pudo importar productos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(98vw,1280px)] overflow-y-auto bg-white p-0 text-slate-950">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-violet-100 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700">
              <Upload className="size-5" />Confirmar importacion
            </DialogTitle>
            <DialogDescription>{state.rows.length} filas cargadas desde Excel. Ajusta los precios de cada producto o lote antes de agregarlos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Panel number="1" title="Precios de importacion">
              <div className="space-y-2">
                {rows.map((item, index) => (
                  <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-3 grid gap-2 text-xs font-bold text-slate-700 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
                      <div>
                        <p className="text-[10px] uppercase text-slate-400">Producto</p>
                        <p className="truncate text-sm text-slate-950">{item.numeroParte || "Sin numero"} - {item.descripcion || "Sin descripcion"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400">Lote</p>
                        <p className="truncate">{item.numeroFactura || "Sin comprobante"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400">Unidad / vencimiento</p>
                        <p className="truncate">{item.unidadMedida || "Sin unidad"} / {item.fechaVencimiento || "Sin vencimiento"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400">Proveedor / procedencia</p>
                        <p className="truncate">{item.proveedor || "Sin proveedor"} / {item.procedencia || "Sin procedencia"}</p>
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="PRECIO DE COMPRA (SIN IGV)">
                        <Input type="number" step="0.01" min="0" value={item.precioCompra} onChange={(event) => updatePurchase(index, event.target.value)} />
                      </Field>
                      <Field label="Margen comercial (%)">
                        <Input type="number" step="0.0001" min="0" max="99.9999" value={item.margenComercial} onChange={(event) => updateMargin(index, event.target.value)} />
                      </Field>
                      <Field label="Precio venta sin IGV">
                        <Input disabled type="number" step="0.01" value={item.precioVentaSinIgv} />
                      </Field>
                      <Field label={`Precio venta con IGV${taxPercent ? ` (${taxPercent}%)` : ""}`}>
                        <Input type="number" step="0.01" min="0" value={item.precioVentaConIgv} onChange={(event) => updateSaleWithTax(index, event.target.value)} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              Se importaran los productos y, si la fila contiene datos de lote, tambien se registrara el lote. El precio de compra medio del producto se recalcula automaticamente con sus lotes.
            </div>
            {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</p> : null}
          </div>
          <DialogFooter className="border-t border-slate-200 p-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">{saving ? "Agregando..." : "Agregar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductDialog({ state, options, settings, onClose, onSubmit }) {
  const readonly = state.readonly;
  const useLots = settings?.habilitarLotes !== false;
  const allowManualBrand = Boolean(settings?.habilitarMarcaManual);
  const showProcedencia = Boolean(settings?.habilitarProcedencia);
  const defaultCurrencyId = getDefaultCurrencyId(options);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    numeroParte: state.item?.numeroParte || "",
    descripcion: state.item?.descripcion || "",
    marca: state.item?.marca || "",
    procedencia: state.item?.procedencia || "",
    tipoId: state.item?.tipoId ? String(state.item.tipoId) : "",
    fechaIngreso: state.item?.fechaIngreso ? String(state.item.fechaIngreso).slice(0, 10) : "",
    stockTotal: state.item?.stockTotal || "",
    precioCompra: state.item?.precioCompra || "",
    precioVenta: state.item?.precioVenta || "",
    monedaId: state.item?.monedaId ? String(state.item.monedaId) : defaultCurrencyId,
  });
  const typeOptions = (options?.types || []).map((item) => ({ value: item.id, label: item.nombre }));
  const currencyOptions = (options?.allCurrencies || options?.currencies || []).map((item) => ({ value: item.id, label: `${item.codigo} ${item.simbolo} - ${item.nombre}` }));

  async function submit(event) {
    event.preventDefault();
    if (readonly) return onClose();
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        marca: form.marca || null,
        procedencia: form.procedencia || null,
        tipoId: form.tipoId || null,
        fechaIngreso: form.fechaIngreso || null,
        stockTotal: form.stockTotal || 0,
        precioVenta: form.precioVenta || 0,
        monedaId: form.monedaId || null,
      });
    } catch (err) {
      setError(err.message || "No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(98vw,1120px)] overflow-y-auto bg-white p-0 text-slate-950">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-violet-100 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700"><Package className="size-5" />{readonly ? "Detalle" : state.item ? "Editar" : "Nuevo"} producto</DialogTitle>
            <DialogDescription>Completa la informacion y guarda</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Panel number="1" title="Informacion General">
              <Field label="Numero de parte *"><Input disabled={readonly} value={form.numeroParte} placeholder="Ej: ABC-12345" onChange={(e) => setForm((f) => ({ ...f, numeroParte: e.target.value }))} required /></Field>
              <Field label="Descripcion *"><Input disabled={readonly} value={form.descripcion} placeholder="Descripcion del producto" onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} required /></Field>
              {allowManualBrand ? (
                <Field label="Marca">
                  <Input disabled={readonly} value={form.marca} placeholder="Ej: FORD" onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))} />
                </Field>
              ) : null}
              {showProcedencia ? (
                <Field label="Procedencia">
                  <Input disabled={readonly} value={form.procedencia} placeholder="Ej: Importado, Local, Ford" onChange={(e) => setForm((f) => ({ ...f, procedencia: e.target.value }))} />
                </Field>
              ) : null}
            </Panel>
            <Panel number="2" title="Clasificacion">
              <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
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
            <Panel number="3" title={useLots ? "Precios" : "Stock y precios"}>
              <div className={`grid gap-3 ${useLots ? "md:grid-cols-[1fr_1fr_1.45fr]" : "sm:grid-cols-2 lg:grid-cols-[0.8fr_1fr_1fr_1.35fr]"}`}>
                {!useLots ? <Field label="Stock total"><Input disabled={readonly} type="number" value={form.stockTotal} onChange={(e) => setForm((f) => ({ ...f, stockTotal: e.target.value }))} /></Field> : null}
                <Field label="Precio compra medio">
                  <Input disabled type="number" step="0.01" value={form.precioCompra} />
                </Field>
                <Field label="Precio venta"><Input disabled={readonly} type="number" step="0.01" value={form.precioVenta} onChange={(e) => setForm((f) => ({ ...f, precioVenta: e.target.value }))} /></Field>
                <Field label="Moneda">
                  <SearchableSelect
                    disabled={readonly}
                    value={form.monedaId}
                    options={currencyOptions}
                    placeholder={currencyOptions.length ? "Seleccionar moneda" : "Sin monedas cargadas"}
                    searchPlaceholder="Buscar moneda..."
                    emptyText="No hay monedas activas."
                    onChange={(value) => setForm((f) => ({ ...f, monedaId: value }))}
                  />
                </Field>
              </div>
              {useLots ? <p className="rounded-md bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">El stock total y el precio de compra medio se calculan automaticamente con los lotes registrados.</p> : null}
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

function LotDialog({ state, options, settings, onClose, onSubmit }) {
  const readonly = state.readonly;
  const product = state.product;
  const showMeasureType = settings?.habilitarTipoMedida !== false;
  const showProvider = settings?.habilitarProveedorEnLote !== false;
  const showExpiration = settings?.habilitarFechaVencimiento !== false;
  const defaultCurrencyId = getDefaultCurrencyId(options);
  const defaultCurrency = (options?.allCurrencies || options?.currencies || []).find((item) => String(item.id) === defaultCurrencyId);
  const taxPercent = Number(options?.activeTax?.porcentaje || 0) || 18;
  const taxFactor = 1 + taxPercent / 100;
  const initialPrecioCompra = state.item ? state.item.precioCompra || "" : "";
  const initialMonedaId = state.item?.monedaId ? String(state.item.monedaId) : defaultCurrencyId;
  const initialTipoCambio = state.item?.tipoCambio || "";
  const initialCompraCalculada = initialMonedaId && defaultCurrencyId && String(initialMonedaId) !== String(defaultCurrencyId)
    ? Number(initialPrecioCompra || 0) * Number(initialTipoCambio || 0)
    : initialPrecioCompra;
  const initialPrecioVentaConIgv = state.item?.precioVentaConIgv || product?.precioVenta || "";
  const initialPrecioVentaSinIgv = state.item?.precioVentaSinIgv || "";
  const initialMargen = state.item?.margenComercial || (initialPrecioCompra ? calculateMargin(initialCompraCalculada, initialPrecioVentaSinIgv) : "");
  const lastProductLot = !state.item && Array.isArray(product?.lotes) && product.lotes.length ? product.lotes[0] : null;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipoMedidaId: state.item?.tipoMedidaId ? String(state.item.tipoMedidaId) : lastProductLot?.tipoMedidaId ? String(lastProductLot.tipoMedidaId) : "",
    proveedorId: state.item?.proveedorId ? String(state.item.proveedorId) : "",
    numeroFactura: state.item?.numeroFactura || "",
    tipoComprobanteId: state.item?.tipoComprobanteId ? String(state.item.tipoComprobanteId) : "",
    fechaVencimiento: state.item?.fechaVencimiento ? String(state.item.fechaVencimiento).slice(0, 10) : "",
    precioCompra: initialPrecioCompra,
    margenComercial: initialMargen,
    precioVentaSinIgv: initialPrecioVentaSinIgv,
    precioVentaConIgv: initialPrecioVentaConIgv,
    monedaId: initialMonedaId,
    tipoCambio: initialTipoCambio,
    stockLote: state.item?.stockLote || "",
  });
  const effectiveMonedaId = form.monedaId || defaultCurrencyId;
  const selectedCurrencyIsDefault = !defaultCurrencyId || String(effectiveMonedaId) === String(defaultCurrencyId);
  const convertedPurchase = selectedCurrencyIsDefault
    ? Number(form.precioCompra || 0)
    : Number(form.precioCompra || 0) * Number(form.tipoCambio || 0);
  const measureOptions = (options?.measureTypes || []).map((item) => ({
    value: item.id,
    label: `${item.nombre}${item.abreviatura ? ` (${item.abreviatura})` : ""}`,
  }));
  const providerOptions = (options?.providers || []).map((item) => ({
    value: item.id,
    label: `${item.nombre}${item.ruc ? ` - ${item.ruc}` : ""}`,
  }));
  const voucherTypeOptions = (options?.voucherTypes || []).map((item) => ({
    value: item.id,
    label: `${item.codigo ? `${item.codigo} - ` : ""}${item.nombre}`,
  }));
  const currencyOptions = (options?.allCurrencies || options?.currencies || []).map((item) => ({
    value: item.id,
    label: `${item.codigo} - ${item.nombre}${item.simbolo ? ` (${item.simbolo})` : ""}`,
  }));

  function roundMoney(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Number(number.toFixed(2)) : "";
  }

  function roundPercent(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Number(number.toFixed(4)) : "";
  }

  function calculateSaleWithoutTax(priceWithTax, factor) {
    const price = Number(priceWithTax || 0);
    if (!Number.isFinite(price) || price <= 0 || !factor) return "";
    return roundMoney(price / factor);
  }

  function calculateMargin(purchase, saleWithoutTax) {
    const purchaseNumber = Number(purchase || 0);
    const saleNumber = Number(saleWithoutTax || 0);
    if (!Number.isFinite(purchaseNumber) || !Number.isFinite(saleNumber) || saleNumber <= 0) return "";
    return roundPercent((1 - purchaseNumber / saleNumber) * 100);
  }

  function calculateFromMargin(purchase, margin) {
    const purchaseNumber = Number(purchase || 0);
    const marginNumber = Number(margin || 0);
    if (!Number.isFinite(purchaseNumber) || !Number.isFinite(marginNumber) || purchaseNumber <= 0 || marginNumber >= 100) {
      return { precioVentaSinIgv: "", precioVentaConIgv: "" };
    }
    const withoutTax = purchaseNumber / (1 - marginNumber / 100);
    return {
      precioVentaSinIgv: roundMoney(withoutTax),
      precioVentaConIgv: roundMoney(withoutTax * taxFactor),
    };
  }

  function purchaseForCalculation(current, overrides = {}) {
    const currencyId = overrides.monedaId ?? current.monedaId ?? defaultCurrencyId;
    const purchase = Number(overrides.precioCompra ?? current.precioCompra ?? 0);
    const exchange = Number(overrides.tipoCambio ?? current.tipoCambio ?? 0);
    if (defaultCurrencyId && String(currencyId) !== String(defaultCurrencyId)) {
      return purchase * exchange;
    }
    return purchase;
  }

  function recalculateWithPurchase(current, overrides = {}) {
    const purchase = purchaseForCalculation(current, overrides);
    const margin = overrides.margenComercial ?? current.margenComercial;
    if (margin !== "") {
      return calculateFromMargin(purchase, margin);
    }
    const withoutTax = calculateSaleWithoutTax(overrides.precioVentaConIgv ?? current.precioVentaConIgv, taxFactor);
    return {
      precioVentaSinIgv: withoutTax,
      margenComercial: calculateMargin(purchase, withoutTax),
    };
  }

  function updateCurrency(value) {
    setForm((current) => {
      const nextTipoCambio = String(value) === String(defaultCurrencyId) ? "" : current.tipoCambio;
      return { ...current, monedaId: value, tipoCambio: nextTipoCambio };
    });
  }

  function calculateNow() {
    setForm((current) => ({ ...current, ...recalculateWithPurchase(current) }));
  }

  const readonlySaleWithoutTax = calculateSaleWithoutTax(form.precioVentaConIgv, taxFactor);
  const readonlyMargin = calculateMargin(convertedPurchase, readonlySaleWithoutTax);

  async function submit(event) {
    event.preventDefault();
    if (readonly) return onClose();
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        productoId: product.id,
        tipoMedidaId: form.tipoMedidaId || null,
        proveedorId: form.proveedorId || null,
        numeroFactura: form.numeroFactura,
        tipoComprobanteId: form.tipoComprobanteId || null,
        fechaVencimiento: form.fechaVencimiento || null,
        precioCompra: form.precioCompra || 0,
        margenComercial: form.margenComercial,
        precioVentaSinIgv: form.precioVentaSinIgv,
        precioVentaConIgv: form.precioVentaConIgv,
        monedaId: effectiveMonedaId || null,
        tipoCambio: selectedCurrencyIsDefault ? null : form.tipoCambio || 0,
        stockLote: form.stockLote || 0,
      });
    } catch (err) {
      setError(err.message || "No se pudo guardar el lote.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] w-[min(98vw,1120px)] max-w-none overflow-x-hidden overflow-y-auto bg-white p-0 text-slate-950 sm:max-w-[1120px]">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-violet-100 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700">
              <Layers3 className="size-5" />{readonly ? "Detalle" : state.item ? "Editar" : "Nuevo"} lote
            </DialogTitle>
            <DialogDescription>{product?.numeroParte} - {product?.descripcion}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Panel number="1" title="Datos del lote">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Numero de comprobante">
                  <Input disabled={readonly} value={form.numeroFactura} placeholder="Ej: F001-000123" onChange={(event) => setForm((current) => ({ ...current, numeroFactura: event.target.value }))} />
                </Field>
                <Field label="Tipo de comprobante">
                  <SearchableSelect
                    disabled={readonly}
                    value={form.tipoComprobanteId}
                    options={voucherTypeOptions}
                    placeholder={voucherTypeOptions.length ? "Seleccionar comprobante" : "Sin comprobantes activos"}
                    searchPlaceholder="Buscar comprobante..."
                    emptyText="No hay comprobantes activos."
                    onChange={(value) => setForm((current) => ({ ...current, tipoComprobanteId: value }))}
                  />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.9fr]">
                {showProvider ? (
                  <Field label="Proveedor">
                    <SearchableSelect
                      disabled={readonly}
                      value={form.proveedorId}
                      options={providerOptions}
                      placeholder={providerOptions.length ? "Seleccionar proveedor" : "Sin proveedores"}
                      searchPlaceholder="Buscar proveedor..."
                      emptyText="No hay proveedores."
                      onChange={(value) => setForm((current) => ({ ...current, proveedorId: value }))}
                    />
                  </Field>
                ) : null}
                {showMeasureType ? (
                  <Field label="Unidad de medida *">
                    <SearchableSelect
                      disabled={readonly}
                      value={form.tipoMedidaId}
                      options={measureOptions}
                      placeholder={measureOptions.length ? "Seleccionar unidad" : "Sin unidades"}
                      searchPlaceholder="Buscar unidad..."
                      emptyText="No hay unidades de medida."
                      onChange={(value) => setForm((current) => ({ ...current, tipoMedidaId: value }))}
                    />
                  </Field>
                ) : null}
                {showExpiration ? (
                  <Field label="Fecha de vencimiento">
                    <Input disabled={readonly} type="date" value={form.fechaVencimiento} onChange={(event) => setForm((current) => ({ ...current, fechaVencimiento: event.target.value }))} />
                  </Field>
                ) : null}
              </div>
            </Panel>
            <Panel
              number="2"
              title="Stock y compra"
              action={!readonly ? (
                <Button type="button" size="sm" variant="outline" className="h-8 border-violet-200 text-violet-700 hover:bg-violet-50" onClick={calculateNow}>
                  Calcular
                </Button>
              ) : null}
            >
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="PRECIO DE COMPRA (SIN IGV) *">
                    <Input
                      disabled={readonly}
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.precioCompra}
                      onChange={(event) => setForm((current) => ({ ...current, precioCompra: event.target.value }))}
                      required
                    />
                  </Field>
                  {!readonly ? (
                    <Field label="Margen comercial (%)">
                      <Input
                        disabled={readonly}
                        type="number"
                        step="0.0001"
                        min="0"
                        max="99.9999"
                        value={form.margenComercial}
                        onChange={(event) => setForm((current) => ({ ...current, margenComercial: event.target.value }))}
                      />
                    </Field>
                  ) : (
                    <ReadonlyMetric label="Margen comercial (%)" value={readonlyMargin !== "" ? `${readonlyMargin}%` : "-"} />
                  )}
                  {!readonly ? (
                    <Field label="Precio venta sin IGV">
                      <Input disabled type="number" step="0.01" min="0" value={form.precioVentaSinIgv} />
                    </Field>
                  ) : (
                    <ReadonlyMetric label="Precio venta sin IGV" value={readonlySaleWithoutTax !== "" ? money(readonlySaleWithoutTax, defaultCurrency?.simbolo || product?.monedaSimbolo) : "-"} />
                  )}
                  <Field label={`Precio venta con IGV${taxPercent ? ` (${taxPercent}%)` : ""}`}>
                    <Input
                      disabled={readonly}
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.precioVentaConIgv}
                      onChange={(event) => setForm((current) => ({ ...current, precioVentaConIgv: event.target.value }))}
                    />
                  </Field>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Stock lote *">
                    <Input disabled={readonly} type="number" min="0" value={form.stockLote} onChange={(event) => setForm((current) => ({ ...current, stockLote: event.target.value }))} required />
                  </Field>
                  <Field label="Moneda *">
                    <SearchableSelect
                      disabled={readonly}
                      value={effectiveMonedaId}
                      options={currencyOptions}
                      placeholder={currencyOptions.length ? "Seleccionar moneda" : "Sin monedas"}
                      searchPlaceholder="Buscar moneda..."
                      emptyText="No hay monedas."
                      onChange={updateCurrency}
                    />
                  </Field>
                  {!selectedCurrencyIsDefault ? (
                    <Field label={`Tipo de cambio${defaultCurrency?.codigo ? ` a ${defaultCurrency.codigo}` : ""} *`}>
                      <Input
                        disabled={readonly}
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={form.tipoCambio}
                        onChange={(event) => setForm((current) => ({ ...current, tipoCambio: event.target.value }))}
                        required
                      />
                    </Field>
                  ) : null}
                  {!selectedCurrencyIsDefault ? (
                    <Field label={`Compra convertida${defaultCurrency?.codigo ? ` en ${defaultCurrency.codigo}` : ""}`}>
                      <Input disabled type="number" step="0.01" value={Number.isFinite(convertedPurchase) ? roundMoney(convertedPurchase) : ""} />
                    </Field>
                  ) : null}
                </div>
              </div>
              {state.item ? <p className="rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">Stock usado: {state.item.stockUsado || 0}. Disponible: {state.item.stockDisponible || 0}.</p> : null}
            </Panel>
            {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</p> : null}
          </div>
          <DialogFooter className="border-t border-slate-200 p-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            {!readonly ? <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">{saving ? "Guardando..." : "Guardar lote"}</Button> : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SoldProductDialog({ state, products, onClose, onSubmit }) {
  const readonly = state.readonly;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    productoId: state.item?.productoId ? String(state.item.productoId) : "",
    anio: state.item?.anio || new Date().getFullYear(),
    mes: state.item?.mes ? String(state.item.mes) : String(new Date().getMonth() + 1),
    cantidad: state.item?.cantidad || 0,
  });
  const productOptions = products.map((item) => ({
    value: item.id,
    label: `${item.numeroParte} - ${item.descripcion}`,
  }));

  async function submit(event) {
    event.preventDefault();
    if (readonly) return onClose();
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        productoId: form.productoId,
        anio: form.anio,
        mes: form.mes,
        cantidad: form.cantidad || 0,
      });
    } catch (err) {
      setError(err.message || "No se pudo guardar el producto vendido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(94vw,430px)] overflow-y-auto bg-white p-0 text-slate-950">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-violet-100 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700">
              <TrendingUp className="size-5" />{readonly ? "Detalle" : state.item ? "Editar" : "Nuevo"} producto vendido
            </DialogTitle>
            <DialogDescription>Registra la cantidad vendida por producto, anio y mes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Panel number="1" title="Producto">
              <Field label="Producto *">
                <SearchableSelect
                  disabled={readonly}
                  value={form.productoId}
                  options={productOptions}
                  placeholder="Seleccionar producto"
                  searchPlaceholder="Buscar producto..."
                  emptyText="No hay productos."
                  onChange={(value) => setForm((current) => ({ ...current, productoId: value }))}
                />
              </Field>
            </Panel>
            <Panel number="2" title="Periodo y cantidad">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Anio *">
                  <Input disabled={readonly} type="number" min="2000" max="2100" value={form.anio} onChange={(event) => setForm((current) => ({ ...current, anio: event.target.value }))} required />
                </Field>
                <Field label="Mes *">
                  <SearchableSelect
                    disabled={readonly}
                    value={form.mes}
                    options={MONTHS}
                    placeholder="Mes"
                    onChange={(value) => setForm((current) => ({ ...current, mes: value }))}
                  />
                </Field>
                <Field label="Cantidad *">
                  <Input disabled={readonly} type="number" min="0" value={form.cantidad} onChange={(event) => setForm((current) => ({ ...current, cantidad: event.target.value }))} required />
                </Field>
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

function calculateComboItemPrices(item, product, activeTax) {
  const quantity = Math.max(1, Number(item.cantidad || 1));
  const purchaseUnit = Number(product?.precioCompra || 0);
  const saleWithTaxUnit = Number(product?.precioVenta || 0);
  const taxFactor = 1 + Number(activeTax?.porcentaje || 18) / 100;
  const discountValue = Math.max(0, Number(item.descuentoValor || 0));
  const discountUnit = item.descuentoTipo === "porcentaje"
    ? saleWithTaxUnit * (discountValue / 100)
    : discountValue;
  const purchaseTotal = purchaseUnit * quantity;
  const originalSaleWithTaxTotal = saleWithTaxUnit * quantity;
  const saleWithTaxDiscountedUnit = Math.max(saleWithTaxUnit - discountUnit, 0);
  const saleWithTaxTotal = saleWithTaxDiscountedUnit * quantity;
  const saleWithoutTaxTotal = saleWithTaxDiscountedUnit > 0 ? (saleWithTaxDiscountedUnit / taxFactor) * quantity : 0;
  return {
    symbol: product?.monedaSimbolo || "S/",
    purchase: roundMoney(purchaseTotal) || 0,
    originalSaleWithTax: roundMoney(originalSaleWithTaxTotal) || 0,
    defaultSaleWithTax: roundMoney(saleWithTaxTotal) || 0,
    saleWithoutTax: roundMoney(saleWithoutTaxTotal) || 0,
    saleWithTax: roundMoney(saleWithTaxTotal) || 0,
    margin: calculateMargin(purchaseTotal, saleWithoutTaxTotal) || 0,
    taxFactor,
  };
}

function calculateComboDiscountFromMargin(item, product, activeTax, marginValue) {
  const quantity = Math.max(1, Number(item.cantidad || 1));
  const purchaseTotal = Number(product?.precioCompra || 0) * quantity;
  const saleWithTaxUnit = Number(product?.precioVenta || 0);
  const originalSaleWithTaxTotal = saleWithTaxUnit * quantity;
  const margin = Number(marginValue || 0);
  const taxFactor = 1 + Number(activeTax?.porcentaje || 18) / 100;
  if (!Number.isFinite(margin) || margin >= 100 || purchaseTotal <= 0 || originalSaleWithTaxTotal <= 0) return 0;
  const targetSaleWithoutTaxTotal = purchaseTotal / (1 - margin / 100);
  const targetSaleWithTaxTotal = targetSaleWithoutTaxTotal * taxFactor;
  const discountTotal = Math.max(originalSaleWithTaxTotal - targetSaleWithTaxTotal, 0);
  if (item.descuentoTipo === "porcentaje") {
    return roundMoney((discountTotal / originalSaleWithTaxTotal) * 100) || 0;
  }
  return roundMoney(discountTotal / quantity) || 0;
}

function formatLotExpiration(value) {
  if (!value) return "Sin vencimiento";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin vencimiento" : date.toLocaleDateString("es-PE");
}

function comboLotValue(productId, lotId) {
  return lotId ? `${productId}:${lotId}` : String(productId || "");
}

function parseComboLotValue(value) {
  const [productId, lotId] = String(value || "").split(":");
  return { productId, lotId: lotId || "" };
}

function getComboProductForPrice(product, lot) {
  if (!product || !lot) return product;
  return {
    ...product,
    precioCompra: Number(lot.precioCompra || 0) || product.precioCompra,
    precioVenta: Number(lot.precioVentaConIgv || 0) || product.precioVenta,
    monedaSimbolo: lot.monedaSimbolo || product.monedaSimbolo,
  };
}

function ComboDialog({ state, products, activeTax, onClose, onSubmit }) {
  const readonly = state.readonly;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  function firstLotIdForProduct(productId) {
    const product = products.find((item) => Number(item.id) === Number(productId));
    return product?.lotes?.[0]?.id ? String(product.lotes[0].id) : "";
  }
  const [form, setForm] = useState({
    codigo: state.item?.codigo || "",
    nombre: state.item?.nombre || "",
    descripcion: state.item?.descripcion || "",
    isActive: state.item?.isActive ?? true,
    items: state.item?.items?.length
      ? state.item.items.map((item) => ({
          productoId: String(item.productoId),
          loteId: firstLotIdForProduct(item.productoId),
          cantidad: item.cantidad || 1,
          descuentoTipo: item.descuentoTipo === "porcentaje" ? "porcentaje" : "monto",
          descuentoValor: item.descuentoValor ?? 0,
          margenComercial: "",
        }))
      : [{ productoId: "", loteId: "", cantidad: 1, descuentoTipo: "monto", descuentoValor: 0, margenComercial: "" }],
  });
  const productOptions = products.flatMap((product) => {
    const lots = Array.isArray(product.lotes) ? product.lotes : [];
    if (!lots.length) {
      return [{
        value: comboLotValue(product.id, ""),
        label: `${product.numeroParte} - ${product.descripcion} - Sin lote - Vence: Sin vencimiento`,
      }];
    }
    return lots.map((lot) => ({
      value: comboLotValue(product.id, lot.id),
      label: `${product.numeroParte} - ${product.descripcion} - ${lot.numeroFactura || `Lote ${lot.id}`} - Vence: ${formatLotExpiration(lot.fechaVencimiento)}`,
    }));
  });

  function updateItem(index, changes) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item),
    }));
  }

  function removeItem(index) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateItemMargin(index, marginValue, product, quantity) {
    const current = form.items[index] || {};
    const nextDiscount = calculateComboDiscountFromMargin({ ...current, cantidad: quantity }, product, activeTax, marginValue);
    updateItem(index, { margenComercial: marginValue, descuentoValor: nextDiscount });
  }

  async function submit(event) {
    event.preventDefault();
    if (readonly) return onClose();
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        codigo: form.codigo,
        nombre: form.nombre,
        descripcion: form.descripcion,
        isActive: form.isActive,
        items: form.items.filter((item) => item.productoId).map((item) => ({
          ...(() => {
            const product = products.find((productItem) => Number(productItem.id) === Number(item.productoId));
            const lot = product?.lotes?.find((lotItem) => Number(lotItem.id) === Number(item.loteId));
            const prices = calculateComboItemPrices(item, getComboProductForPrice(product, lot), activeTax);
            return {
              productoId: item.productoId,
              cantidad: item.cantidad || 1,
              precioVenta: prices.saleWithTax,
              descuentoTipo: item.descuentoTipo === "porcentaje" ? "porcentaje" : "monto",
              descuentoValor: item.descuentoValor || 0,
            };
          })(),
        })),
      });
    } catch (err) {
      setError(err.message || "No se pudo guardar el combo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] !w-[min(98vw,1440px)] !max-w-[min(98vw,1440px)] overflow-y-auto bg-white p-0 text-slate-950">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-violet-100 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700">
              <Layers3 className="size-5" />{readonly ? "Detalle" : state.item ? "Editar" : "Nuevo"} combo
            </DialogTitle>
            <DialogDescription>Arma combos con productos del inventario posventa</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Panel number="1" title="Informacion del Combo">
              <div className="grid gap-3 md:grid-cols-[260px_1fr]">
                <Field label="Codigo"><Input disabled={readonly} value={form.codigo} placeholder="Ej: COMBO-001" onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} /></Field>
                <Field label="Nombre *"><Input disabled={readonly} value={form.nombre} placeholder="Nombre del combo" onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} required /></Field>
              </div>
              <Field label="Descripcion"><Textarea disabled={readonly} value={form.descripcion} placeholder="Descripcion breve del combo" onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></Field>
            </Panel>
            <Panel number="2" title="Productos del Combo">
              <div className="space-y-2">
                {form.items.map((item, index) => {
                  const product = products.find((productItem) => Number(productItem.id) === Number(item.productoId));
                  const lot = product?.lotes?.find((lotItem) => Number(lotItem.id) === Number(item.loteId));
                  const productForPrice = getComboProductForPrice(product, lot);
                  const prices = calculateComboItemPrices(item, productForPrice, activeTax);
                  return (
                    <div key={`${index}-${item.productoId}`} className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                      <div className="space-y-2">
                        <Field label="Producto">
                          <SearchableSelect
                            disabled={readonly}
                            value={comboLotValue(item.productoId, item.loteId)}
                            options={productOptions}
                            placeholder="Seleccionar lote"
                            searchPlaceholder="Buscar lote..."
                            emptyText="No hay lotes."
                            onChange={(value) => {
                              const parsed = parseComboLotValue(value);
                              updateItem(index, { productoId: parsed.productId, loteId: parsed.lotId, margenComercial: "" });
                            }}
                          />
                        </Field>
                      </div>
                      <div className="grid gap-2 md:grid-cols-[110px_210px_150px_auto]">
                        <Field label="Cantidad">
                          <Input disabled={readonly} type="number" min="1" value={item.cantidad} onChange={(e) => updateItem(index, { cantidad: e.target.value, margenComercial: "" })} />
                        </Field>
                        <Field label="Tipo descuento">
                          <div className="flex h-10 items-center justify-between rounded-md border border-slate-200 bg-white px-3">
                            <span className="text-xs font-bold text-slate-600">Monto</span>
                            <Switch disabled={readonly} checked={item.descuentoTipo === "porcentaje"} onCheckedChange={(checked) => updateItem(index, { descuentoTipo: checked ? "porcentaje" : "monto", margenComercial: "" })} />
                            <span className="text-xs font-bold text-slate-600">%</span>
                          </div>
                        </Field>
                        <Field label={item.descuentoTipo === "porcentaje" ? "Descuento (%)" : "Descuento monto"}>
                          <Input disabled={readonly} type="number" min="0" step="0.01" value={item.descuentoValor} onChange={(e) => updateItem(index, { descuentoValor: e.target.value, margenComercial: "" })} />
                        </Field>
                        {!readonly ? (
                          <div className="flex items-end">
                            <Button type="button" variant="outline" size="icon" onClick={() => removeItem(index)} disabled={form.items.length === 1}>
                              <X className="size-4" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-2 rounded-md bg-violet-50/60 p-2 text-xs md:grid-cols-5">
                        <ComboPrice label="Precio venta sin descuento" value={money(prices.originalSaleWithTax, prices.symbol)} />
                        <ComboPrice label="Precio compra" value={money(prices.purchase, prices.symbol)} />
                        <ComboPrice label="Precio venta sin IGV" value={money(prices.saleWithoutTax, prices.symbol)} />
                        <Field label="Margen (%)">
                          <Input
                            disabled={readonly}
                            type="number"
                            min="0"
                            max="99.99"
                            step="0.01"
                            value={item.margenComercial !== "" ? item.margenComercial : Number(prices.margin || 0).toFixed(2)}
                            onChange={(event) => updateItemMargin(index, event.target.value, productForPrice, item.cantidad)}
                            className="h-8 bg-white text-xs font-black"
                          />
                        </Field>
                        <ComboPrice label="Precio venta con descuento" value={money(prices.saleWithTax, prices.symbol)} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {!readonly ? (
                <Button type="button" variant="outline" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { productoId: "", loteId: "", cantidad: 1, descuentoTipo: "monto", descuentoValor: 0, margenComercial: "" }] }))}>
                  <Plus className="size-4" />Agregar producto
                </Button>
              ) : null}
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

function ComboPrice({ label, value }) {
  return (
    <div className="rounded-md border border-violet-100 bg-white px-2 py-1">
      <p className="font-bold text-slate-500">{label}</p>
      <p className="mt-0.5 font-black text-slate-950">{value}</p>
    </div>
  );
}

function StockDistributionDialog({ state, options, actions, canCreate, canEdit, canDelete, assignedShelfIds = new Set(), onClose }) {
  const product = state.product;
  const assigned = product.stock.reduce((sum, item) => sum + Number(item.stock || 0), 0);
  const available = Math.max(Number(product.stockTotal || 0) - assigned, 0);
  const [locationDialog, setLocationDialog] = useState({ open: false, item: null });

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] !w-[min(96vw,1120px)] !max-w-[min(96vw,1120px)] overflow-y-auto bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-violet-100 p-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700"><Package className="size-5" />Distribucion de Stock</DialogTitle>
          <DialogDescription>Numero de parte: {product.numeroParte}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Total Producto" value={product.stockTotal} />
            <MiniStat label="Productos con ubicacion" value={assigned} />
            <MiniStat label="Productos sin ubicacion" value={available} />
          </div>
          {canCreate ? <Button onClick={() => setLocationDialog({ open: true, item: null })} className="w-full bg-violet-700 text-white hover:bg-violet-800"><Plus className="size-4" />Nueva ubicacion</Button> : null}
          <div className="space-y-2">
            {product.stock.map((stock) => {
              const canManageRow = assignedShelfIds.has(Number(stock.anaquelId));
              return (
                <div key={stock.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate text-sm font-bold text-violet-700">{stockLabel(stock)}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{stockOwnerLabel(stock)}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-500">{stock.loteLabel || `Lote ${stock.loteId}`}</p>
                  </div>
                  <div className="w-full rounded-md bg-violet-100 px-3 py-2 text-center text-violet-700 sm:w-24">
                    <p className="text-xs">Stock</p>
                    <p className="font-bold">{stock.stock}</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    {canEdit && canManageRow ? <Button variant="outline" size="icon" onClick={() => setLocationDialog({ open: true, item: stock })}><Edit3 className="size-4" /></Button> : null}
                    {canDelete && canManageRow ? <Button variant="destructive" size="icon" onClick={() => actions.deleteStock(stock.id)}><Trash2 className="size-4" /></Button> : null}
                  </div>
                </div>
              );
            })}
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
    loteId: state.item?.loteId ? String(state.item.loteId) : "",
    anaquelId: state.item?.anaquelId ? String(state.item.anaquelId) : "",
    nivelId: state.item?.nivelId ? String(state.item.nivelId) : "",
    posicionId: state.item?.posicionId ? String(state.item.posicionId) : "",
    stock: state.item?.stock || 0,
  });
  const lotOptions = options.lots.filter((item) => Number(item.productoId) === Number(product.id)).map((item) => ({
    value: item.id,
    label: item.label || `${product.numeroParte} - Lote ${item.id}`,
  }));
  const shelfOptions = options.shelves.map((item) => ({
    value: item.id,
    label: `${item.codigo}${item.descripcion ? ` - ${item.descripcion}` : ""}`,
  }));
  const levelOptions = options.shelfLevels.filter((item) => !form.anaquelId || Number(item.anaquelId) === Number(form.anaquelId)).map((item) => ({ value: item.id, label: item.codigoNivel }));
  const positionOptions = options.shelfPositions.filter((item) => !form.nivelId || Number(item.nivelId) === Number(form.nivelId)).map((item) => ({ value: item.id, label: String(item.posicion) }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message || "No se pudo guardar la ubicacion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(94vw,640px)] bg-white p-0 text-slate-950">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-violet-100 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700"><MapPin className="size-5" />{state.item ? "Editar" : "Nueva"} ubicacion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Panel number="1" title="Lote">
              <Field label="Lote *">
                <SearchableSelect
                  value={form.loteId}
                  options={lotOptions}
                  placeholder="Seleccione lote"
                  searchPlaceholder="Buscar lote..."
                  emptyText="No hay lotes para este producto."
                  onChange={(value) => setForm((f) => ({ ...f, loteId: value }))}
                />
              </Field>
            </Panel>
            <Panel number="2" title="Ubicacion">
              <Field label="Anaquel *"><SearchableSelect value={form.anaquelId} options={shelfOptions} placeholder="Seleccione anaquel" onChange={(value) => setForm((f) => ({ ...f, anaquelId: value, nivelId: "", posicionId: "" }))} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nivel"><SearchableSelect value={form.nivelId} options={levelOptions} disabled={!form.anaquelId} placeholder="Seleccione nivel" onChange={(value) => setForm((f) => ({ ...f, nivelId: value, posicionId: "" }))} /></Field>
                <Field label="Posicion"><SearchableSelect value={form.posicionId} options={positionOptions} disabled={!form.nivelId} placeholder="Seleccione posicion" onChange={(value) => setForm((f) => ({ ...f, posicionId: value }))} /></Field>
              </div>
            </Panel>
            <Panel number="3" title="Stock">
              <Field label="Cantidad a asignar *"><Input type="number" min="0" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} required /></Field>
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

function InventoryLocationDialog({ state, options, onClose, onSubmit }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    loteId: state.item?.loteId ? String(state.item.loteId) : "",
    anaquelId: state.item?.anaquelId ? String(state.item.anaquelId) : "",
    nivelId: state.item?.nivelId ? String(state.item.nivelId) : "",
    posicionId: state.item?.posicionId ? String(state.item.posicionId) : "",
    stock: state.item?.stock || 0,
  });
  const lotOptions = options.lots.map((item) => ({
    value: item.id,
    label: item.label || `${item.numeroParte} - Lote ${item.id}`,
  }));
  const shelfOptions = options.shelves.map((item) => ({
    value: item.id,
    label: `${item.codigo}${item.descripcion ? ` - ${item.descripcion}` : ""}`,
  }));
  const levelOptions = options.shelfLevels.filter((item) => !form.anaquelId || Number(item.anaquelId) === Number(form.anaquelId)).map((item) => ({
    value: item.id,
    label: item.codigoNivel,
  }));
  const positionOptions = options.shelfPositions.filter((item) => !form.nivelId || Number(item.nivelId) === Number(form.nivelId)).map((item) => ({
    value: item.id,
    label: String(item.posicion),
  }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message || "No se pudo guardar la ubicacion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(94vw,520px)] bg-white p-0 text-slate-950">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-violet-100 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700"><MapPin className="size-5" />{state.item ? "Editar" : "Nueva"} ubicacion de inventario</DialogTitle>
            <DialogDescription>Asigna cantidad por lote, anaquel, nivel y posicion.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Panel number="1" title="Lote">
              <Field label="Lote *">
                <SearchableSelect
                  value={form.loteId}
                  options={lotOptions}
                  placeholder="Seleccione lote"
                  searchPlaceholder="Buscar lote..."
                  emptyText="No hay lotes."
                  onChange={(value) => setForm((f) => ({ ...f, loteId: value }))}
                />
              </Field>
            </Panel>
            <Panel number="2" title="Ubicacion">
              <Field label="Anaquel *"><SearchableSelect value={form.anaquelId} options={shelfOptions} placeholder="Seleccione anaquel" onChange={(value) => setForm((f) => ({ ...f, anaquelId: value, nivelId: "", posicionId: "" }))} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nivel"><SearchableSelect value={form.nivelId} options={levelOptions} disabled={!form.anaquelId} placeholder="Seleccione nivel" onChange={(value) => setForm((f) => ({ ...f, nivelId: value, posicionId: "" }))} /></Field>
                <Field label="Posicion"><SearchableSelect value={form.posicionId} options={positionOptions} disabled={!form.nivelId} placeholder="Seleccione posicion" onChange={(value) => setForm((f) => ({ ...f, posicionId: value }))} /></Field>
              </div>
            </Panel>
            <Panel number="3" title="Stock">
              <Field label="Cantidad *"><Input type="number" min="0" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} required /></Field>
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

function Panel({ number, title, action, children }) {
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-bold text-violet-700">{number ? <span className="flex size-6 items-center justify-center rounded-full bg-violet-700 text-xs text-white">{number}</span> : null}{title}</p>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label className="text-xs font-bold text-violet-700">{label}</Label>{children}</div>;
}

function ReadonlyMetric({ label, value }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-violet-700">{label}</Label>
      <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
        {value}
      </div>
    </div>
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

function Stat({ label, value, tone, icon: Icon }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    purple: "border-violet-200 bg-violet-50 text-violet-700",
  };
  return (
    <div className={`flex items-center justify-between rounded-lg border px-2 py-2 sm:px-3 ${tones[tone]}`}>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold leading-4 sm:text-[11px]">{label}</p>
        <p className="mt-0.5 text-xl font-bold leading-6 text-slate-950">{value}</p>
      </div>
      <Icon className="hidden size-5 shrink-0 opacity-50 sm:block" />
    </div>
  );
}

function MiniStat({ label, value }) {
  return <div className="rounded-lg bg-violet-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold text-violet-700">{value}</p></div>;
}

function stockLabel(stock) {
  const parts = [stock.anaquelCodigo, stock.nivelCodigo, stock.posicion ? `Pos. ${stock.posicion}` : ""].filter(Boolean);
  return parts.length ? parts.join(" / ") : "-";
}

function stockOwnerLabel(stock) {
  if (stock.tallerName) return `Almacen: ${stock.tallerName}`;
  if (stock.mostradorName) return `Mostrador: ${stock.mostradorName}`;
  return "Sin almacen/mostrador";
}

function compactStockLabel(stock) {
  const parts = [stock.anaquelCodigo, stock.nivelCodigo, stock.posicion].filter(Boolean);
  return parts.length ? parts.join(" / ") : "-";
}

function stockTooltipLabel(stock) {
  const details = [
    `Anaquel: ${stock.anaquelCodigo || "-"}`,
    `Nivel: ${stock.nivelCodigo || "-"}`,
    `Posicion: ${stock.posicion || "-"}`,
    `Almacen/Mostrador: ${stock.tallerName || stock.mostradorName || "-"}`,
  ];
  return details.join(" | ");
}
