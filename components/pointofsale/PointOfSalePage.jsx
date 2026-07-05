"use client";

import { useMemo, useState } from "react";
import { Banknote, Barcode, CreditCard, Loader2, MapPin, Minus, PackageSearch, Plus, ReceiptText, Search, ShoppingBag, Trash2, UserRound } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useClients } from "@/hooks/clients/useClients";
import { usePostInventory } from "@/hooks/postinventory/usePostInventory";

function money(value, symbol = "S/") {
  const number = Number(value || 0);
  return `${symbol} ${number.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function stockLabel(stock) {
  const parts = [stock.anaquelCodigo, stock.nivelCodigo, stock.posicion ? `Pos. ${stock.posicion}` : ""].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Sin ubicacion";
}

function clientName(client) {
  return [client?.nombre, client?.apellido].filter(Boolean).join(" ") || client?.nombreComercial || client?.razonSocial || "Cliente sin nombre";
}

export default function PointOfSalePage() {
  const inventory = usePostInventory();
  const clientsData = useClients();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [brand, setBrand] = useState("Todos");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [locationProduct, setLocationProduct] = useState(null);
  const [cart, setCart] = useState([]);

  const clientOptions = useMemo(() => clientsData.clients.map((client) => ({
    value: client.id,
    label: [clientName(client), client.celular, client.identificacionFiscal || client.numeroDocumento].filter(Boolean).join(" - "),
  })), [clientsData.clients]);

  const selectedClient = useMemo(
    () => clientsData.clients.find((client) => Number(client.id) === Number(selectedClientId)) || null,
    [clientsData.clients, selectedClientId]
  );

  const categories = useMemo(() => {
    const names = new Set(inventory.products.map((product) => product.tipoNombre).filter(Boolean));
    return ["Todos", ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  }, [inventory.products]);

  const brands = useMemo(() => {
    const names = new Set(inventory.products.map((product) => product.marca).filter(Boolean));
    return ["Todos", ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  }, [inventory.products]);

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inventory.products.filter((product) => {
      const available = Number(product.stockDisponible ?? product.stockTotal ?? 0);
      const matchesCategory = category === "Todos" || product.tipoNombre === category;
      const matchesBrand = brand === "Todos" || product.marca === brand;
      const haystack = [
        product.numeroParte,
        product.descripcion,
        product.marca,
        product.tipoNombre,
        product.monedaCodigo,
      ].join(" ").toLowerCase();
      return available > 0 && matchesCategory && matchesBrand && (!needle || haystack.includes(needle));
    });
  }, [brand, category, inventory.products, query]);

  const subtotal = cart.reduce((sum, item) => sum + Number(item.precioVenta || 0) * item.qty, 0);
  const tax = subtotal * 0.18;
  const total = subtotal + tax;

  function addProduct(product) {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found) return current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...current, { ...product, qty: 1 }];
    });
  }

  function updateQty(productId, delta) {
    setCart((current) => current
      .map((item) => item.id === productId ? { ...item, qty: Math.max(1, item.qty + delta) } : item)
      .filter((item) => item.qty > 0));
  }

  function removeProduct(productId) {
    setCart((current) => current.filter((item) => item.id !== productId));
  }

  return (
    <main className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <header className="mb-3 flex flex-col gap-3 border-b border-violet-200 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-base font-bold leading-tight text-violet-700">Punto de Venta</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">Registra ventas rapidas de servicios, repuestos y accesorios</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-semibold sm:flex">
          <div className="rounded-lg border bg-white px-3 py-2 shadow-sm">
            <p className="text-slate-400">Caja</p>
            <p className="text-violet-700">Principal</p>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2 shadow-sm">
            <p className="text-slate-400">Ticket</p>
            <p className="text-violet-700">PV-000128</p>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2 shadow-sm">
            <p className="text-slate-400">Estado</p>
            <p className="text-emerald-600">Abierta</p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_460px] 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="min-w-0 space-y-3">
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-1">
                <p className="text-xs font-bold text-violet-700">Buscar producto</p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por producto, codigo, marca o tipo..."
                    className="h-10 bg-white pl-8 text-sm"
                  />
                </div>
              </div>
              <Button variant="outline" className="h-10 justify-center">
                <Barcode className="size-4" />
                Escanear
              </Button>
            </div>

            <div className="mt-2 grid gap-1.5">
              <FilterChips label="Tipo" value={category} options={categories} onChange={setCategory} />
              <FilterChips label="Marca" value={brand} options={brands} onChange={setBrand} />
            </div>
          </div>

          {inventory.loading ? (
            <div className="grid min-h-60 place-items-center rounded-lg border bg-white text-sm font-semibold text-slate-500">
              <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" />Cargando productos...</span>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="rounded-md border bg-white p-2.5 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs font-bold leading-tight text-slate-900">{product.descripcion || "Producto sin descripcion"}</p>
                      <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{product.numeroParte || "Sin codigo"}</p>
                    </div>
                    <span className="max-w-20 truncate rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">{product.tipoNombre || "Sin tipo"}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-bold text-slate-500">
                    <span className="max-w-24 truncate rounded bg-slate-100 px-1.5 py-0.5">{product.marca || "Sin marca"}</span>
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">Stock {Number(product.stockDisponible ?? product.stockTotal ?? 0)}</span>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-emerald-700">{money(product.precioVenta, product.monedaSimbolo || "S/")}</p>
                      <p className="text-[10px] font-semibold text-slate-400">{product.monedaCodigo || "Sin moneda"}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button type="button" size="icon" variant="outline" className="size-8" title="Ver ubicacion" onClick={() => setLocationProduct(product)}>
                        <MapPin className="size-3.5" />
                      </Button>
                      <Button type="button" size="icon" className="size-8 bg-violet-700 text-white hover:bg-violet-800" title="Agregar" onClick={() => addProduct(product)}>
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {!filteredProducts.length ? (
                <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm font-semibold text-slate-500 sm:col-span-2 xl:col-span-3 2xl:col-span-4">
                  No hay productos disponibles para la busqueda.
                </div>
              ) : null}
            </div>
          )}
        </div>

        <aside className="rounded-lg border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-violet-700">Venta actual</h2>
              <p className="text-xs font-medium text-slate-400">{cart.length} items agregados</p>
            </div>
            <ShoppingBag className="size-5 text-violet-700" />
          </div>
          <div className="border-b bg-white p-3">
            <p className="mb-1 text-xs font-bold text-violet-700">Cliente</p>
            <SearchableSelect
              value={selectedClientId}
              options={clientOptions}
              placeholder={clientsData.loading ? "Cargando clientes..." : "Selecciona cliente..."}
              onChange={setSelectedClientId}
            />
            {selectedClient ? (
              <div className="mt-2 rounded-md border border-violet-100 bg-violet-50/50 p-2 text-xs">
                <div className="flex items-center gap-2">
                  <UserRound className="size-4 shrink-0 text-violet-700" />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">{clientName(selectedClient)}</p>
                    <p className="text-slate-500">{selectedClient.celular || "Sin celular"} - {selectedClient.identificacionFiscal || selectedClient.numeroDocumento || "Sin documento"}</p>
                    <p className="truncate text-slate-500">{selectedClient.email || selectedClient.correo || "Sin correo"}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="max-h-[50svh] space-y-2 overflow-y-auto p-3 xl:max-h-[calc(100svh-330px)]">
            {cart.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold text-slate-900">{item.descripcion}</p>
                    <p className="text-[11px] font-semibold text-slate-400">{item.numeroParte} · {item.marca || "Sin marca"}</p>
                  </div>
                  <button type="button" className="rounded-md p-1 text-red-500 hover:bg-red-50" onClick={() => removeProduct(item.id)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center rounded-md border">
                    <button type="button" className="grid size-8 place-items-center text-slate-600 hover:bg-slate-50" onClick={() => updateQty(item.id, -1)}>
                      <Minus className="size-3.5" />
                    </button>
                    <span className="grid h-8 min-w-10 place-items-center border-x px-2 text-xs font-bold">{item.qty}</span>
                    <button type="button" className="grid size-8 place-items-center text-slate-600 hover:bg-slate-50" onClick={() => updateQty(item.id, 1)}>
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <p className="text-base font-black text-slate-900">{money(Number(item.precioVenta || 0) * item.qty, item.monedaSimbolo || "S/")}</p>
                </div>
              </div>
            ))}
            {!cart.length ? (
              <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-slate-300 text-center text-sm font-semibold text-slate-500">
                <div>
                  <PackageSearch className="mx-auto mb-2 size-6 text-slate-400" />
                  Selecciona productos para iniciar la venta.
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t bg-slate-50 p-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-bold text-slate-800">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>IGV 18%</span>
                <span className="font-bold text-slate-800">{money(tax)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-black text-violet-700">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-10">
                <Banknote className="size-4" />
                Efectivo
              </Button>
              <Button variant="outline" className="h-10">
                <CreditCard className="size-4" />
                Tarjeta
              </Button>
            </div>
            <Button className="mt-2 h-11 w-full bg-violet-700 text-white hover:bg-violet-800" disabled={!cart.length}>
              <ReceiptText className="size-4" />
              Generar comprobante
            </Button>
          </div>
        </aside>
      </section>

      <ProductLocationDialog product={locationProduct} onClose={() => setLocationProduct(null)} />
    </main>
  );
}

function FilterChips({ label, value, options, onChange }) {
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-2">
      <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {options.map((item) => (
          <button
            key={item}
            type="button"
            className={`h-7 max-w-32 shrink-0 truncate rounded-md border px-2 text-[11px] font-bold transition ${value === item ? "border-violet-700 bg-violet-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductLocationDialog({ product, onClose }) {
  if (!product) return null;
  const locations = product.stock || [];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(94vw,720px)] bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700">
            <MapPin className="size-5" />Ubicacion de producto
          </DialogTitle>
          <DialogDescription>{product.numeroParte} - {product.descripcion}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {locations.map((stock) => (
            <div key={stock.id} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-bold text-slate-900">{stockLabel(stock)}</p>
                <p className="text-xs font-medium text-slate-500">
                  {[stock.tallerName, stock.mostradorName, stock.loteLabel || `Lote ${stock.loteId}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="rounded-md bg-violet-100 px-3 py-2 text-center text-violet-700">
                <p className="text-[10px] font-bold uppercase">Stock</p>
                <p className="text-base font-black">{stock.stock}</p>
              </div>
            </div>
          ))}
          {!locations.length ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">
              Este producto no tiene ubicaciones registradas.
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
