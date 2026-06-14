"use client";

import { useMemo, useRef, useState } from "react";
import { Boxes, ChevronDown, Download, Edit3, Eye, Layers3, Loader2, MapPin, Package, Plus, RefreshCw, Search, Trash2, TrendingUp, TriangleAlert, Upload, X } from "lucide-react";
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

export default function PostInventoryPage({ userPermissions }) {
  const data = usePostInventory();
  const productImportRef = useRef(null);
  const stockImportRef = useRef(null);
  const soldImportRef = useRef(null);
  const [query, setQuery] = useState("");
  const [minStock, setMinStock] = useState(5);
  const [view, setView] = useState("products");
  const [productDialog, setProductDialog] = useState({ open: false, item: null, readonly: false });
  const [comboDialog, setComboDialog] = useState({ open: false, item: null, readonly: false });
  const [soldDialog, setSoldDialog] = useState({ open: false, item: null, readonly: false });
  const [stockDialog, setStockDialog] = useState({ open: false, product: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, title: "", onConfirm: null });
  const [formatsMenuOpen, setFormatsMenuOpen] = useState(false);
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
  const searchLabel = view === "products" ? "Buscar producto" : view === "combos" ? "Buscar combo" : "Buscar producto vendido";
  const searchPlaceholder = view === "products"
    ? "Buscar por N parte o descripcion..."
    : view === "combos"
      ? "Buscar por codigo, nombre o descripcion..."
      : "Buscar por producto, anio o mes...";

  if (!canView) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver inventario.</div>;
  }

  async function exportProductsFormat() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet([
      {
        numero_parte: "ABC-12345",
        descripcion: "Filtro de aceite",
        tipo_inventario: "Repuestos",
        fecha_ingreso: "2026-06-05",
        stock_total: 10,
        precio_compra: 25,
        precio_venta: 40,
        moneda: "PEN",
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
        numero_parte: "ABC-12345",
        centro: "Centro principal",
        taller: "Taller principal",
        mostrador: "",
        stock: 5,
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

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 p-3 text-slate-950 md:h-svh sm:p-4">
      <div className="mb-3 flex shrink-0 flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-violet-700 text-white">
            <Package className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-950">Inventario</h1>
            <p className="text-xs font-medium text-slate-500">Gestion de productos y stock</p>
          </div>
        </div>
        {canCreate ? (
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
                <MenuItem icon={Download} label="Formato productos" onClick={exportProductsFormat} close={() => setFormatsMenuOpen(false)} />
                <MenuItem icon={Upload} label="Ingreso masivo productos" onClick={() => productImportRef.current?.click()} close={() => setFormatsMenuOpen(false)} />
                <MenuItem icon={Download} label="Formato stock" onClick={exportStockFormat} close={() => setFormatsMenuOpen(false)} />
                <MenuItem icon={Upload} label="Ingreso masivo stock" onClick={() => stockImportRef.current?.click()} close={() => setFormatsMenuOpen(false)} />
                <MenuItem icon={Download} label="Formato vendidos" onClick={exportSoldProductsFormat} close={() => setFormatsMenuOpen(false)} />
                <MenuItem icon={Upload} label="Importar vendidos" onClick={() => soldImportRef.current?.click()} close={() => setFormatsMenuOpen(false)} />
              </div>
            ) : null}
            <input ref={productImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => importRowsFromFile(event, data.importProducts, "Productos importados")} />
            <input ref={stockImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => importRowsFromFile(event, data.importStock, "Stock importado")} />
            <input ref={soldImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => importRowsFromFile(event, data.importSoldProducts, "Productos vendidos importados")} />
          </div>
        ) : null}
      </div>

      <div className="mb-3 grid grid-cols-4 shrink-0 gap-2">
        <Stat label="Total Productos" value={data.stats.products} tone="blue" icon={Package} />
        <Stat label="Stock Total" value={data.stats.totalStock} tone="green" icon={TrendingUp} />
        <Stat label="Stock Bajo" value={lowStock} tone="red" icon={TriangleAlert} />
        <Stat label="Combos / Vendidos" value={`${data.stats.combos} / ${data.stats.soldProducts}`} tone="purple" icon={Layers3} />
      </div>

      <div className="mb-3 inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        <Button type="button" size="sm" variant={view === "products" ? "default" : "ghost"} onClick={() => setView("products")} className={view === "products" ? "bg-violet-700 text-white hover:bg-violet-800" : ""}>
          <Package className="size-4" />Productos
        </Button>
        <Button type="button" size="sm" variant={view === "combos" ? "default" : "ghost"} onClick={() => setView("combos")} className={view === "combos" ? "bg-violet-700 text-white hover:bg-violet-800" : ""}>
          <Layers3 className="size-4" />Combos
        </Button>
        <Button type="button" size="sm" variant={view === "soldProducts" ? "default" : "ghost"} onClick={() => setView("soldProducts")} className={view === "soldProducts" ? "bg-violet-700 text-white hover:bg-violet-800" : ""}>
          <TrendingUp className="size-4" />Productos vendidos
        </Button>
      </div>

      <section className="mb-3 shrink-0 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="min-w-0 space-y-1.5">
            <Label>{searchLabel}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} className="h-10 bg-white pl-9" />
            </div>
          </div>
          <div className={view === "products" ? "grid grid-cols-[84px_1fr_1fr] items-end gap-2 md:grid-cols-[120px_auto_auto] md:justify-end" : "grid grid-cols-2 gap-2 sm:flex sm:flex-row md:justify-end"}>
            {view === "products" ? <div className="space-y-1.5">
              <Label className="text-[11px] sm:text-xs">Min. stock</Label>
              <Input type="number" value={minStock} onChange={(event) => setMinStock(event.target.value)} className="h-10 bg-white" />
            </div> : null}
            <Button variant="outline" onClick={data.reload} className="h-10 px-2 text-xs sm:px-4 sm:text-sm"><RefreshCw className="size-4" />Recargar</Button>
            {canCreate && view === "products" ? <Button onClick={() => setProductDialog({ open: true, item: null, readonly: false })} className="h-10 bg-violet-700 px-2 text-xs text-white hover:bg-violet-800 sm:px-4 sm:text-sm"><Plus className="size-4" />Nuevo Producto</Button> : null}
            {canCreate && view === "combos" ? <Button onClick={() => setComboDialog({ open: true, item: null, readonly: false })} className="h-10 bg-violet-700 text-white hover:bg-violet-800"><Plus className="size-4" />Nuevo Combo</Button> : null}
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
        onView={(product) => setProductDialog({ open: true, item: product, readonly: true })}
        onEdit={(product) => setProductDialog({ open: true, item: product, readonly: false })}
        onStock={(product) => setStockDialog({ open: true, product })}
        onDelete={(product) => setDeleteDialog({ open: true, title: `Eliminar ${product.numeroParte}`, onConfirm: () => data.deleteProduct(product.id) })}
      /> : view === "combos" ? <CombosTable
        loading={data.loading}
        combos={filteredCombos}
        total={data.combos.length}
        canEdit={canEdit}
        canDelete={canDelete}
        onView={(combo) => setComboDialog({ open: true, item: combo, readonly: true })}
        onEdit={(combo) => setComboDialog({ open: true, item: combo, readonly: false })}
        onDelete={(combo) => setDeleteDialog({ open: true, title: `Eliminar ${combo.nombre}`, onConfirm: () => data.deleteCombo(combo.id) })}
      /> : <SoldProductsTable
        loading={data.loading}
        items={filteredSoldProducts}
        total={data.soldProducts.length}
        canEdit={canEdit}
        canDelete={canDelete}
        onView={(item) => setSoldDialog({ open: true, item, readonly: true })}
        onEdit={(item) => setSoldDialog({ open: true, item, readonly: false })}
        onDelete={(item) => setDeleteDialog({ open: true, title: `Eliminar venta ${item.numeroParte}`, onConfirm: () => data.deleteSoldProduct(item.id) })}
      />}

      {productDialog.open ? (
        <ProductDialog
          key={`${productDialog.item?.id || "new"}-${productDialog.readonly}`}
          state={productDialog}
          options={data.options}
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
      {comboDialog.open ? (
        <ComboDialog
          key={`${comboDialog.item?.id || "new"}-${comboDialog.readonly}`}
          state={comboDialog}
          products={data.products}
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
      {stockDialog.open ? <StockDistributionDialog state={stockDialog} options={data.options} actions={data} onClose={() => setStockDialog({ open: false, product: null })} /> : null}
      <DeleteDialog state={deleteDialog} onClose={() => setDeleteDialog({ open: false, title: "", onConfirm: null })} />
    </div>
  );
}

function ProductsTable({ loading, products, total, canEdit, canDelete, onView, onEdit, onStock, onDelete }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600">
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
              {loading ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr>
              ) : products.map((product) => (
                <tr key={product.id}>
                  <td className="px-3 py-3 font-bold text-slate-950">{product.numeroParte}</td>
                  <td className="px-3 py-3">{product.descripcion}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{product.tipoNombre}</span></td>
                  <td className="px-3 py-3 font-bold text-emerald-700">{product.available}</td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-slate-950">{money(product.precioVenta, product.monedaSimbolo)}</div>
                    <div className="text-xs font-medium text-slate-500">{product.monedaCodigo || "Sin moneda"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onView(product)}><Eye className="size-4" /></Button>
                      {canEdit ? <Button variant="ghost" size="icon" onClick={() => onEdit(product)}><Edit3 className="size-4" /></Button> : null}
                      {canEdit ? <Button variant="ghost" size="icon" onClick={() => onStock(product)}><Boxes className="size-4" /></Button> : null}
                      {canDelete ? <Button variant="destructive" size="icon" onClick={() => onDelete(product)}><Trash2 className="size-4" /></Button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex shrink-0 justify-between bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
          <span>Pagina 1 de 1 - {products.length} de {total} productos</span>
          <div className="flex gap-2"><Button variant="outline" disabled>Anterior</Button><Button variant="outline" disabled>Siguiente</Button></div>
        </div>
      </section>
  );
}

function CombosTable({ loading, combos, total, canEdit, canDelete, onView, onEdit, onDelete }) {
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
                      <span key={item.id} className="rounded-full bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">{item.numeroParte} x{item.cantidad}</span>
                    ))}
                    {combo.items.length > 3 ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">+{combo.items.length - 3}</span> : null}
                  </div>
                </td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${combo.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{combo.isActive ? "Activo" : "Inactivo"}</span></td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onView(combo)}><Eye className="size-4" /></Button>
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

function SoldProductsTable({ loading, items, total, canEdit, canDelete, onView, onEdit, onDelete }) {
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
                    <Button variant="ghost" size="icon" onClick={() => onView(item)}><Eye className="size-4" /></Button>
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
    monedaId: state.item?.monedaId ? String(state.item.monedaId) : "",
  });
  const typeOptions = (options?.types || []).map((item) => ({ value: item.id, label: item.nombre }));
  const currencyOptions = (options?.currencies || []).map((item) => ({ value: item.id, label: `${item.codigo} ${item.simbolo} - ${item.nombre}` }));

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

function ComboDialog({ state, products, onClose, onSubmit }) {
  const readonly = state.readonly;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    codigo: state.item?.codigo || "",
    nombre: state.item?.nombre || "",
    descripcion: state.item?.descripcion || "",
    isActive: state.item?.isActive ?? true,
    items: state.item?.items?.length ? state.item.items.map((item) => ({ productoId: String(item.productoId), cantidad: item.cantidad || 1 })) : [{ productoId: "", cantidad: 1 }],
  });
  const productOptions = products.map((item) => ({
    value: item.id,
    label: `${item.numeroParte} - ${item.descripcion}`,
  }));

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
        items: form.items.filter((item) => item.productoId).map((item) => ({ productoId: item.productoId, cantidad: item.cantidad || 1 })),
      });
    } catch (err) {
      setError(err.message || "No se pudo guardar el combo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94svh] max-w-[min(94vw,720px)] overflow-y-auto bg-white p-0 text-slate-950">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-violet-100 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700">
              <Layers3 className="size-5" />{readonly ? "Detalle" : state.item ? "Editar" : "Nuevo"} combo
            </DialogTitle>
            <DialogDescription>Arma combos con productos del inventario posventa</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Panel number="1" title="Informacion del Combo">
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <Field label="Codigo"><Input disabled={readonly} value={form.codigo} placeholder="Ej: COMBO-001" onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} /></Field>
                <Field label="Nombre *"><Input disabled={readonly} value={form.nombre} placeholder="Nombre del combo" onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} required /></Field>
              </div>
              <Field label="Descripcion"><Textarea disabled={readonly} value={form.descripcion} placeholder="Descripcion breve del combo" onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></Field>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-bold text-slate-950">Combo activo</p>
                  <p className="text-xs font-medium text-slate-500">Visible para usarlo en posventa</p>
                </div>
                <Switch disabled={readonly} checked={form.isActive} onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))} />
              </div>
            </Panel>
            <Panel number="2" title="Productos del Combo">
              <div className="space-y-2">
                {form.items.map((item, index) => (
                  <div key={`${index}-${item.productoId}`} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-[1fr_110px_auto]">
                    <Field label="Producto">
                      <SearchableSelect
                        disabled={readonly}
                        value={item.productoId}
                        options={productOptions}
                        placeholder="Seleccionar producto"
                        searchPlaceholder="Buscar producto..."
                        emptyText="No hay productos."
                        onChange={(value) => updateItem(index, { productoId: value })}
                      />
                    </Field>
                    <Field label="Cantidad">
                      <Input disabled={readonly} type="number" min="1" value={item.cantidad} onChange={(e) => updateItem(index, { cantidad: e.target.value })} />
                    </Field>
                    {!readonly ? (
                      <div className="flex items-end">
                        <Button type="button" variant="outline" size="icon" onClick={() => removeItem(index)} disabled={form.items.length === 1}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {!readonly ? (
                <Button type="button" variant="outline" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { productoId: "", cantidad: 1 }] }))}>
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
  return stock.tallerName ? `${stock.centroName} - ${stock.tallerName}` : stock.mostradorName ? `${stock.centroName} - ${stock.mostradorName}` : stock.centroName;
}
