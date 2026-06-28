"use client";

import { useMemo, useState } from "react";
import { Banknote, Barcode, CreditCard, Minus, Plus, ReceiptText, Search, ShoppingBag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const categories = ["Todos", "Servicios", "Repuestos", "Accesorios", "Combos"];

const products = [
  { id: 1, name: "Cambio de aceite 5W30", category: "Servicios", sku: "SERV-001", price: 180, stock: "Disponible" },
  { id: 2, name: "Filtro de aceite original", category: "Repuestos", sku: "REP-118", price: 48, stock: "24 und." },
  { id: 3, name: "Kit mantenimiento basico", category: "Combos", sku: "COM-010", price: 260, stock: "Disponible" },
  { id: 4, name: "Ambientador premium", category: "Accesorios", sku: "ACC-044", price: 25, stock: "38 und." },
  { id: 5, name: "Escaneo computarizado", category: "Servicios", sku: "SERV-012", price: 95, stock: "Disponible" },
  { id: 6, name: "Limpiaparabrisas set x2", category: "Accesorios", sku: "ACC-071", price: 72, stock: "15 und." },
];

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
}

export default function PointOfSalePage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [cart, setCart] = useState([
    { ...products[0], qty: 1 },
    { ...products[1], qty: 1 },
  ]);

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === "Todos" || product.category === category;
      const matchesQuery = !needle || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
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

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-3">
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por producto, servicio o codigo..."
                  className="h-9 bg-white pl-8 text-sm"
                />
              </div>
              <Button variant="outline" className="h-9 justify-center">
                <Barcode className="size-4" />
                Escanear
              </Button>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`h-8 shrink-0 rounded-md border px-3 text-xs font-bold transition ${category === item ? "border-violet-700 bg-violet-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className="rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md"
                onClick={() => addProduct(product)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold text-slate-900">{product.name}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">{product.sku}</p>
                  </div>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">{product.category}</span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-lg font-black text-emerald-700">{money(product.price)}</p>
                    <p className="text-[11px] font-semibold text-slate-400">{product.stock}</p>
                  </div>
                  <span className="grid size-8 place-items-center rounded-md bg-violet-700 text-white">
                    <Plus className="size-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-violet-700">Venta actual</h2>
              <p className="text-xs font-medium text-slate-400">{cart.length} items agregados</p>
            </div>
            <ShoppingBag className="size-5 text-violet-700" />
          </div>

          <div className="max-h-[46svh] space-y-2 overflow-y-auto p-3 xl:max-h-[calc(100svh-360px)]">
            {cart.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-xs font-bold text-slate-900">{item.name}</p>
                    <p className="text-[11px] font-semibold text-slate-400">{item.sku}</p>
                  </div>
                  <button type="button" className="rounded-md p-1 text-red-500 hover:bg-red-50" onClick={() => removeProduct(item.id)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center rounded-md border">
                    <button type="button" className="grid size-7 place-items-center text-slate-600 hover:bg-slate-50" onClick={() => updateQty(item.id, -1)}>
                      <Minus className="size-3.5" />
                    </button>
                    <span className="grid h-7 min-w-8 place-items-center border-x px-2 text-xs font-bold">{item.qty}</span>
                    <button type="button" className="grid size-7 place-items-center text-slate-600 hover:bg-slate-50" onClick={() => updateQty(item.id, 1)}>
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <p className="text-sm font-black text-slate-900">{money(item.price * item.qty)}</p>
                </div>
              </div>
            ))}
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
            <Button className="mt-2 h-11 w-full bg-violet-700 text-white hover:bg-violet-800">
              <ReceiptText className="size-4" />
              Generar comprobante
            </Button>
          </div>
        </aside>
      </section>
    </main>
  );
}
