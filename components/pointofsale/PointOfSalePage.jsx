"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Banknote, Barcode, ChevronDown, CreditCard, FileText, Layers3, Loader2, MapPin, Minus, PackageSearch, Plus, ReceiptText, Search, ShoppingBag, SlidersHorizontal, Store, Trash2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { pointOfSaleQuotesApi } from "@/app/api/point-of-sale-quotes.api";
import { useClients } from "@/hooks/clients/useClients";
import { usePointOfSaleConfig } from "@/hooks/usePointOfSaleConfig";
import { usePostInventory } from "@/hooks/postinventory/usePostInventory";
import { logisticsTypeCode } from "@/lib/logisticsClassification";
import { hasPerm } from "@/lib/permissions";

function money(value, symbol = "S/") {
  const number = Number(value || 0);
  return `${symbol} ${number.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function stockLabel(stock) {
  const parts = [stock.anaquelCodigo, stock.nivelCodigo, stock.posicion ? `Pos. ${stock.posicion}` : ""].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Sin ubicacion";
}

function discountAmount(base, type, value) {
  const amount = Number(base || 0);
  const discount = Number(value || 0);
  if (!Number.isFinite(amount) || !Number.isFinite(discount) || amount <= 0 || discount <= 0) return 0;
  if (type === "porcentaje") return Math.min(amount, amount * (discount / 100));
  return Math.min(amount, discount);
}

function costAmount(item) {
  return Number(item?.precioCompra || 0) * Number(item?.qty || 0);
}

function productTypeLabel(item) {
  return logisticsTypeCode(item?.respuestaFinalLogistica || item?.tipoLogistico) || item?.tipoProducto || item?.clasificacion || item?.tipoNombre || "Sin tipo";
}

function clientName(client) {
  return [client?.nombre, client?.apellido].filter(Boolean).join(" ") || client?.nombreComercial || client?.razonSocial || "Cliente sin nombre";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("es-PE");
}

function buildSaleChoices(product) {
  const locations = (product?.stock || []).filter((stock) => Number(stock.stock || 0) > 0);
  const lots = (product?.lotes || []).filter((lot) => Number(lot.stockDisponible || 0) > 0);
  if (lots.length > 1) {
    return lots.map((lot) => {
      const lotLocations = locations.filter((stock) => Number(stock.loteId) === Number(lot.id));
      return {
        key: `lot-${lot.id}`,
        lot,
        stock: lotLocations[0] || null,
        title: lot.numeroFactura || `Lote ${lot.id}`,
        detail: lotLocations.length ? lotLocations.map(stockLabel).join(" / ") : "Sin ubicacion asignada",
        stockValue: lot.stockDisponible,
        purchaseDate: lot.createdAt || product?.fechaIngreso,
        expirationDate: lot.fechaVencimiento,
      };
    });
  }
  return locations.map((stock) => ({
    key: `stock-${stock.id}`,
    lot: lots.find((lot) => Number(lot.id) === Number(stock.loteId)) || null,
    stock,
    title: stock.loteLabel || `Lote ${stock.loteId}`,
    detail: stockLabel(stock),
    stockValue: stock.stock,
    purchaseDate: lots.find((lot) => Number(lot.id) === Number(stock.loteId))?.createdAt || product?.fechaIngreso,
    expirationDate: lots.find((lot) => Number(lot.id) === Number(stock.loteId))?.fechaVencimiento,
  }));
}

function PartsSuiteLoader({ compact = false }) {
  const text = "One Solution Parts Suite";
  return (
    <div className={`grid place-items-center ${compact ? "min-h-60 rounded-lg border bg-white" : "min-h-[60svh] bg-slate-50"} p-4`}>
      <div className="text-center">
        <div className="inline-flex items-end justify-center gap-[2px] text-xl font-black tracking-wide sm:text-3xl">
          {text.split("").map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              className={letter === " " ? "w-2 sm:w-3" : "inline-block animate-[parts-suite-wave_1.6s_ease-in-out_infinite]"}
              style={letter === " " ? undefined : { animationDelay: `${index * 0.06}s` }}
            >
              {letter}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.28em] text-violet-500">Cargando</p>
      </div>
      <style jsx>{`
        span {
          color: #0f172a;
        }
        span:nth-child(n + 13) {
          color: #6d28d9;
        }
        @keyframes parts-suite-wave {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.74;
          }
          45% {
            transform: translateY(9px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default function PointOfSalePage({ userPermissions = {}, initialQuoteId = "", initialMode = "" }) {
  const inventory = usePostInventory();
  const clientsData = useClients();
  const pointOfSale = usePointOfSaleConfig();
  const comboInstanceRef = useRef(0);
  const loadedQuoteRef = useRef("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [brand, setBrand] = useState("Todos");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientText, setClientText] = useState("");
  const [manualClient, setManualClient] = useState({ razonSocial: "", celular: "", correo: "", numeroDocumento: "" });
  const [manualClientOpen, setManualClientOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [totalDiscount, setTotalDiscount] = useState({ type: "monto", value: "" });
  const [locationProduct, setLocationProduct] = useState(null);
  const [locationPickerProduct, setLocationPickerProduct] = useState(null);
  const [priceAlert, setPriceAlert] = useState(null);
  const [cart, setCart] = useState([]);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState("");
  const [savingAction, setSavingAction] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [screenMode, setScreenMode] = useState("cotizacion");
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState(null);
  const [savedQuoteCode, setSavedQuoteCode] = useState("");
  const [movementRequest, setMovementRequest] = useState(null);
  const canScan = hasPerm(userPermissions, ["puntoventa", "scan"]);
  const canSellAnyPrice = hasPerm(userPermissions, ["puntoventa", "sell_any_price"]);

  useEffect(() => {
    const quoteId = String(initialQuoteId || "").trim();
    if (!quoteId || loadedQuoteRef.current === quoteId) return;
    loadedQuoteRef.current = quoteId;
    let cancelled = false;

    async function loadQuoteIntoSale() {
      setSavingAction("cargar-cotizacion");
      setCloseError("");
      try {
        const response = await pointOfSaleQuotesApi.get(quoteId);
        if (cancelled) return;
        const quote = response?.item;
        if (!quote) throw new Error("Cotizacion no encontrada.");

        const loadedCart = (quote.items || []).map((item) => {
          const product = inventory.products.find((productItem) => Number(productItem.id) === Number(item.productoId));
          const stock = product?.stock?.find((stockItem) => Number(stockItem.id) === Number(item.ubicacionId)) || null;
          const lot = product?.lotes?.find((lotItem) => Number(lotItem.id) === Number(item.loteId)) || null;
          const selectedChoice = item.loteId || item.ubicacionId
            ? {
              key: `quote-${item.id}`,
              lot: lot || (item.loteId ? { id: item.loteId } : null),
              stock: stock || (item.ubicacionId ? { id: item.ubicacionId, loteId: item.loteId } : null),
              title: lot?.numeroFactura || stock?.loteLabel || (item.loteId ? `Lote ${item.loteId}` : ""),
              detail: stock ? stockLabel(stock) : (item.ubicacionId ? `Ubicacion ${item.ubicacionId}` : ""),
              stockValue: stock?.stock ?? lot?.stockDisponible ?? item.cantidad,
              purchaseDate: lot?.createdAt || product?.fechaIngreso,
              expirationDate: lot?.fechaVencimiento,
            }
            : null;

          return {
            ...(product || {}),
            id: item.productoId,
            comboId: item.comboId || null,
            cartId: `quote-${quote.id}-${item.id}`,
            selectedChoice,
            loteId: item.loteId || null,
            numeroParte: item.numeroParte || product?.numeroParte || "",
            descripcion: item.descripcion || product?.descripcion || "",
            marca: item.marca || product?.marca || "",
            tipoLogistico: item.tipoLogistico || product?.tipoLogistico || "",
            respuestaFinalLogistica: item.tipoLogistico || product?.respuestaFinalLogistica || "",
            precioVenta: Number(item.precioUnitario || product?.precioVenta || 0),
            precioCompra: Number(item.precioCompra || product?.precioCompra || 0),
            monedaSimbolo: product?.monedaSimbolo || "S/",
            qty: Math.max(1, Number(item.cantidad || 1)),
            discountType: item.descuentoTipo || "monto",
            discountValue: item.descuentoValor ? String(item.descuentoValor) : "",
          };
        });

        setCart(loadedCart);
        setSavedQuoteId(quote.id);
        setSavedQuoteCode(quote.codigo || "");
        setTotalDiscount({
          type: quote.descuentoTotalTipo || "monto",
          value: quote.descuentoTotalValor ? String(quote.descuentoTotalValor) : "",
        });
        setClientText(quote.clienteNombre || quote.clienteRazonSocial || "");
        setManualClient({
          razonSocial: quote.clienteRazonSocial || "",
          celular: quote.clienteCelular || "",
          correo: quote.clienteEmail || "",
          numeroDocumento: quote.clienteDocumento || "",
        });
        setSelectedClientId(quote.clienteId ? String(quote.clienteId) : "");
        setScreenMode(String(initialMode || "").toLowerCase() === "venta" ? "venta" : "cotizacion");
        setSaveMessage(`${quote.codigo} cargada correctamente.`);
      } catch (error) {
        loadedQuoteRef.current = "";
        setCloseError(error?.message || "No se pudo cargar la cotizacion.");
      } finally {
        if (!cancelled) setSavingAction("");
      }
    }

    loadQuoteIntoSale();
    return () => {
      cancelled = true;
    };
  }, [initialMode, initialQuoteId, inventory.products]);

  const clientOptions = useMemo(() => clientsData.clients.map((client) => ({
    value: client.id,
    label: [clientName(client), client.celular, client.identificacionFiscal || client.numeroDocumento].filter(Boolean).join(" - "),
  })), [clientsData.clients]);

  const selectedClient = useMemo(
    () => clientsData.clients.find((client) => Number(client.id) === Number(selectedClientId)) || null,
    [clientsData.clients, selectedClientId]
  );

  function handleClientTextChange(value) {
    setClientText(value);
    const clean = value.trim().toLowerCase();
    const matchedClient = clientsData.clients.find((client) => {
      const fullName = clientName(client);
      const optionLabel = [fullName, client.celular, client.identificacionFiscal || client.numeroDocumento].filter(Boolean).join(" - ");
      return [optionLabel, fullName, client.celular, client.identificacionFiscal, client.numeroDocumento]
        .filter(Boolean)
        .some((item) => String(item).trim().toLowerCase() === clean);
    });
    setSelectedClientId(matchedClient ? String(matchedClient.id) : "");
  }

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

  const filteredCombos = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (inventory.combos || []).filter((combo) => {
      if (!combo.isActive) return false;
      const haystack = [
        combo.codigo,
        combo.nombre,
        combo.descripcion,
        ...(combo.items || []).flatMap((item) => [item.numeroParte, item.descripcion]),
      ].join(" ").toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [inventory.combos, query]);

  const taxRate = 0.18;
  const taxFactor = 1 + taxRate;
  const grossSubtotal = cart.reduce((sum, item) => sum + Number(item.precioVenta || 0) * item.qty, 0);
  const productDiscount = cart.reduce((sum, item) => {
    const lineBase = Number(item.precioVenta || 0) * item.qty;
    return sum + discountAmount(lineBase, item.discountType, item.discountValue);
  }, 0);
  const totalCost = cart.reduce((sum, item) => sum + costAmount(item), 0);
  const subtotalAfterProductDiscount = Math.max(grossSubtotal - productDiscount, 0);
  const totalDiscountAmount = discountAmount(subtotalAfterProductDiscount, totalDiscount.type, totalDiscount.value);
  const total = Math.max(subtotalAfterProductDiscount - totalDiscountAmount, 0);
  const subtotal = total / taxFactor;
  const tax = total - subtotal;
  const hasMarginAlert = cart.length > 0 && totalCost > 0 && subtotal <= totalCost;
  const marginAlertItems = cart
    .map((item) => {
      const lineBase = Number(item.precioVenta || 0) * item.qty;
      const lineDiscount = discountAmount(lineBase, item.discountType, item.discountValue);
      const lineTotal = Math.max(lineBase - lineDiscount, 0);
      const lineSubtotal = lineTotal / taxFactor;
      const lineCost = costAmount(item);
      return {
        id: item.cartId,
        name: item.descripcion || item.numeroParte || "Producto",
        type: productTypeLabel(item),
        affected: lineCost > 0 && lineSubtotal <= lineCost,
      };
    })
    .filter((item) => item.affected);
  const hasOutOfStockItems = cart.some((item) => {
    const stock = item.selectedChoice
      ? Number(item.selectedChoice.stockValue || 0)
      : Number(item.stockDisponible ?? item.stockTotal ?? 0);
    return stock <= 0;
  });
  const canGenerateReceipt = cart.length > 0 && (!hasMarginAlert || canSellAnyPrice);

  function availableLocations(product) {
    return (product.stock || []).filter((stock) => Number(stock.stock || 0) > 0);
  }

  function saleChoices(product) {
    return buildSaleChoices(product);
  }

  function addProduct(product, choice = null) {
    const choices = saleChoices(product);
    if (!choice && choices.length > 1) {
      setLocationPickerProduct(product);
      return;
    }
    const selectedChoice = choice || choices[0] || null;
    if (selectedChoice?.stock && selectedChoice.stock.canAccessLocation === false) {
      setMovementRequest({ product, choice: selectedChoice });
      setLocationPickerProduct(null);
      return;
    }
    const cartId = selectedChoice ? `${product.id}-${selectedChoice.key}` : String(product.id);
    setCart((current) => {
      const found = current.find((item) => item.cartId === cartId);
      if (found) return current.map((item) => item.cartId === cartId ? { ...item, qty: item.qty + 1 } : item);
      return [...current, { ...product, cartId, selectedChoice, qty: 1, discountType: "monto", discountValue: "" }];
    });
    setLocationPickerProduct(null);
  }

  function addCombo(combo) {
    comboInstanceRef.current += 1;
    const comboInstance = `${combo.id}-${comboInstanceRef.current}`;
    const nextItems = (combo.items || [])
      .map((comboItem) => {
        const product = inventory.products.find((item) => Number(item.id) === Number(comboItem.productoId));
        if (!product) return null;
        const choices = saleChoices(product);
        const selectedChoice = choices[0] || null;
        return {
          ...product,
          cartId: `combo-${comboInstance}-${comboItem.id || comboItem.productoId}`,
          selectedChoice,
          comboId: combo.id,
          comboName: combo.nombre,
          comboCode: combo.codigo,
          qty: Math.max(1, Number(comboItem.cantidad || 1)),
          precioVenta: Number(comboItem.precioVenta || 0) || Number(product.precioVenta || 0),
          discountType: "monto",
          discountValue: "",
        };
      })
      .filter(Boolean);
    if (!nextItems.length) return;
    setCart((current) => [...current, ...nextItems]);
  }

  function updateQty(cartId, delta) {
    setCart((current) => current
      .map((item) => item.cartId === cartId ? { ...item, qty: Math.max(1, item.qty + delta) } : item)
      .filter((item) => item.qty > 0));
  }

  function removeProduct(cartId) {
    setCart((current) => current.filter((item) => item.cartId !== cartId));
  }

  function updateItemDiscount(cartId, changes) {
    setCart((current) => current.map((item) => item.cartId === cartId ? { ...item, ...changes } : item));
  }

  async function closePointOfSale() {
    if (!pointOfSale.activePoint) return;
    setClosing(true);
    setCloseError("");
    try {
      await pointOfSale.close({
        id: pointOfSale.activePoint.id,
        montoRecaudado: total,
      });
      setCart([]);
      setTotalDiscount({ type: "monto", value: "" });
    } catch (error) {
      setCloseError(error?.message || "No se pudo cerrar el punto de venta.");
    } finally {
      setClosing(false);
    }
  }

  if (pointOfSale.loading) {
    return <PartsSuiteLoader />;
  }

  function quotePayload(estado) {
    return {
      estado,
      puntoVentaId: pointOfSale.activePoint?.id || null,
      clienteId: selectedClient?.id || null,
      clienteNombre: selectedClient ? clientName(selectedClient) : clientText,
      clienteRazonSocial: selectedClient?.razonSocial || selectedClient?.nombreComercial || manualClient.razonSocial,
      clienteCelular: selectedClient?.celular || manualClient.celular,
      clienteEmail: selectedClient?.email || selectedClient?.correo || manualClient.correo,
      clienteDocumento: selectedClient?.identificacionFiscal || selectedClient?.numeroDocumento || manualClient.numeroDocumento,
      descuentoTotalTipo: totalDiscount.type,
      descuentoTotalValor: totalDiscount.value,
      items: cart.map((item) => ({
        productoId: item.id,
        comboId: item.comboId || null,
        loteId: item.selectedChoice?.lot?.id || item.loteId || null,
        ubicacionId: item.selectedChoice?.stock?.id || null,
        numeroParte: item.numeroParte,
        descripcion: item.descripcion,
        marca: item.marca,
        tipoLogistico: productTypeLabel(item),
        cantidad: item.qty,
        precioUnitario: item.precioVenta,
        precioCompra: item.precioCompra,
        descuentoTipo: item.discountType,
        descuentoValor: item.discountValue,
      })),
    };
  }

  async function saveQuote(estado, extraPayload = {}) {
    if (!cart.length) return null;
    setSavingAction(estado);
    setSaveMessage("");
    setCloseError("");
    try {
      const result = await pointOfSaleQuotesApi.create({ ...quotePayload(estado), ...extraPayload });
      if (estado === "vendida") setScreenMode("venta");
      setSavedQuoteId(result.id || null);
      setSavedQuoteCode(result.codigo || "");
      setSaveMessage(`${result.codigo} guardada correctamente.`);
      return result;
    } catch (error) {
      setCloseError(error?.message || "No se pudo guardar la cotizacion.");
      return null;
    } finally {
      setSavingAction("");
    }
  }

  async function generateQuotePdf() {
    const result = await saveQuote("cotizacion");
    if (!result?.codigo) return;

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36;
    let y = 42;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Cotizacion", margin, y);
    doc.setFontSize(11);
    doc.text(result.codigo, pageWidth - margin, y, { align: "right" });

    y += 28;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Fecha: ${new Date().toLocaleString("es-PE")}`, margin, y);
    y += 18;
    doc.text(`Cliente: ${selectedClient ? clientName(selectedClient) : clientText || "Sin cliente"}`, margin, y);
    y += 14;
    doc.text(`Documento: ${selectedClient?.identificacionFiscal || selectedClient?.numeroDocumento || manualClient.numeroDocumento || "-"}`, margin, y);
    y += 14;
    doc.text(`Celular: ${selectedClient?.celular || manualClient.celular || "-"}`, margin, y);

    y += 26;
    doc.setFont("helvetica", "bold");
    doc.text("Producto", margin, y);
    doc.text("Cant.", 360, y, { align: "right" });
    doc.text("Precio", 440, y, { align: "right" });
    doc.text("Total", pageWidth - margin, y, { align: "right" });
    y += 8;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;

    doc.setFont("helvetica", "normal");
    cart.forEach((item) => {
      const lineBase = Number(item.precioVenta || 0) * item.qty;
      const lineDiscount = discountAmount(lineBase, item.discountType, item.discountValue);
      const lineTotal = Math.max(lineBase - lineDiscount, 0);
      const name = `${item.numeroParte || ""} ${item.descripcion || ""}`.trim();
      const splitName = doc.splitTextToSize(name, 275);

      if (y > 735) {
        doc.addPage();
        y = 42;
      }

      doc.text(splitName, margin, y);
      doc.text(String(item.qty), 360, y, { align: "right" });
      doc.text(money(item.precioVenta, item.monedaSimbolo || "S/"), 440, y, { align: "right" });
      doc.text(money(lineTotal, item.monedaSimbolo || "S/"), pageWidth - margin, y, { align: "right" });
      y += Math.max(18, splitName.length * 12);
    });

    y += 12;
    doc.line(330, y, pageWidth - margin, y);
    y += 16;
    doc.setFont("helvetica", "bold");
    doc.text("Bruto con IGV", 390, y, { align: "right" });
    doc.text(money(grossSubtotal), pageWidth - margin, y, { align: "right" });
    y += 14;
    doc.text("Desc. productos", 390, y, { align: "right" });
    doc.text(`- ${money(productDiscount)}`, pageWidth - margin, y, { align: "right" });
    y += 14;
    doc.text("Desc. total", 390, y, { align: "right" });
    doc.text(`- ${money(totalDiscountAmount)}`, pageWidth - margin, y, { align: "right" });
    y += 14;
    doc.text("Subtotal sin IGV", 390, y, { align: "right" });
    doc.text(money(subtotal), pageWidth - margin, y, { align: "right" });
    y += 14;
    doc.text("IGV incluido 18%", 390, y, { align: "right" });
    doc.text(money(tax), pageWidth - margin, y, { align: "right" });
    y += 18;
    doc.setFontSize(12);
    doc.text("Total", 390, y, { align: "right" });
    doc.text(money(total), pageWidth - margin, y, { align: "right" });

    doc.save(`${result.codigo}.pdf`);
  }

  async function generateReceipt() {
    if (!cart.length) return;
    setSavingAction("comprobante");
    setCloseError("");
    setSaveMessage("");
    try {
      const quoteId = savedQuoteId || null;
      const quoteCode = savedQuoteCode || "";
      const result = await pointOfSaleQuotesApi.createSale({
        ...quotePayload("vendida"),
        cotizacionId: quoteId,
      });
      setSavedQuoteCode(result.codigo || quoteCode);
      setSaveMessage(`${result.codigo} generado correctamente.`);

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 36;
      let y = 42;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Comprobante", margin, y);
      doc.setFontSize(11);
      doc.text(result.codigo || "", pageWidth - margin, y, { align: "right" });

      y += 24;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Cotizacion: ${quoteCode || "-"}`, margin, y);
      y += 14;
      doc.text(`Fecha: ${new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })}`, margin, y);
      y += 14;
      doc.text(`Cliente: ${selectedClient ? clientName(selectedClient) : clientText || "Sin cliente"}`, margin, y);
      y += 20;

      doc.setFont("helvetica", "bold");
      doc.text("Producto", margin, y);
      doc.text("Cant.", 360, y, { align: "right" });
      doc.text("Precio", 440, y, { align: "right" });
      doc.text("Total", pageWidth - margin, y, { align: "right" });
      y += 8;
      doc.line(margin, y, pageWidth - margin, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      cart.forEach((item) => {
        const lineBase = Number(item.precioVenta || 0) * item.qty;
        const lineDiscount = discountAmount(lineBase, item.discountType, item.discountValue);
        const lineTotal = Math.max(lineBase - lineDiscount, 0);
        const splitName = doc.splitTextToSize(`${item.numeroParte || ""} ${item.descripcion || ""}`.trim(), 275);

        if (y > 735) {
          doc.addPage();
          y = 42;
        }

        doc.text(splitName, margin, y);
        doc.text(String(item.qty), 360, y, { align: "right" });
        doc.text(money(item.precioVenta, item.monedaSimbolo || "S/"), 440, y, { align: "right" });
        doc.text(money(lineTotal, item.monedaSimbolo || "S/"), pageWidth - margin, y, { align: "right" });
        y += Math.max(18, splitName.length * 12);
      });

      y += 12;
      doc.line(330, y, pageWidth - margin, y);
      y += 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Total", 390, y, { align: "right" });
      doc.text(money(total), pageWidth - margin, y, { align: "right" });
      doc.save(`${result.codigo}.pdf`);

      setCart([]);
      setTotalDiscount({ type: "monto", value: "" });
      setScreenMode("cotizacion");
      setSavedQuoteId(null);
    } catch (error) {
      setCloseError(error?.message || "No se pudo generar el comprobante.");
    } finally {
      setSavingAction("");
    }
  }

  async function createMovementQuote() {
    if (!movementRequest?.product || !movementRequest?.choice) return;
    setSavingAction("movimiento");
    setCloseError("");
    setSaveMessage("");
    try {
      const result = await pointOfSaleQuotesApi.createMovement({
        ubicacionId: movementRequest.choice.stock?.id,
        cantidad: 1,
        precioUnitario: movementRequest.product.precioVenta,
        destinoTallerId: pointOfSale.activePoint?.tallerId || null,
        destinoMostradorId: pointOfSale.activePoint?.mostradorId || null,
      });
      setSavedQuoteCode(result.codigo || "");
      setSaveMessage(`${result.codigo} generada como cotizacion de movimiento.`);
      setMovementRequest(null);
    } catch (error) {
      setCloseError(error?.message || "No se pudo generar la cotizacion de movimiento.");
    } finally {
      setSavingAction("");
    }
  }

  if (pointOfSale.settings?.habilitarAperturaCaja && !pointOfSale.activePoint) {
    return <OpenPointOfSaleGate pointOfSale={pointOfSale} />;
  }

  return (
    <main className="h-[calc(100svh-1rem)] min-w-0 overflow-hidden bg-slate-50 p-2 text-slate-950 sm:p-3">
      <section className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_460px] 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
          <header className="grid gap-2 border-b border-violet-200 pb-2 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
            <div>
              <h1 className="text-base font-bold leading-tight text-violet-700">{screenMode === "venta" ? "Venta" : "Cotizacion"}</h1>
              <p className="mt-0.5 text-xs font-medium text-violet-400">Prepara productos, combos y anticipos antes de pasar a ventas</p>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-semibold">
              <div className="rounded-md border bg-white px-2 py-1.5">
                <p className="text-slate-400">Caja</p>
                <p className="truncate text-violet-700">{pointOfSale.activePoint?.codigo || "Libre"}</p>
              </div>
              <div className="rounded-md border bg-white px-2 py-1.5">
                <p className="text-slate-400">Apertura</p>
                <p className="truncate text-violet-700">{pointOfSale.activePoint?.horaApertura || "-"}</p>
              </div>
              <div className="rounded-md border bg-white px-2 py-1.5">
                <p className="text-slate-400">Estado</p>
                <p className={`truncate ${pointOfSale.activePoint ? "text-emerald-600" : "text-slate-500"}`}>{pointOfSale.activePoint ? "Abierta" : "Sin apertura"}</p>
              </div>
            </div>
          </header>
          {closeError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{closeError}</div>
          ) : null}
          {saveMessage ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{saveMessage}</div>
          ) : null}
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
              {canScan ? (
                <Button variant="outline" className="h-10 justify-center">
                  <Barcode className="size-4" />
                  Escanear
                </Button>
              ) : null}
            </div>

            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="flex items-center gap-2 text-xs font-black text-violet-700">
                  <SlidersHorizontal className="size-4" />
                  Filtros
                </span>
                <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-slate-500">
                  <span className="hidden min-w-0 truncate sm:inline">
                    {category !== "Todos" || brand !== "Todos" ? `${category} / ${brand}` : "Todos"}
                  </span>
                  <ChevronDown className={`size-4 shrink-0 transition ${filtersOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
              {filtersOpen ? (
                <div className="grid gap-1.5 border-t border-slate-200 bg-white p-2">
                  <FilterChips label="Tipo" value={category} options={categories} onChange={setCategory} />
                  <FilterChips label="Marca" value={brand} options={brands} onChange={setBrand} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {inventory.loading ? (
              <PartsSuiteLoader compact />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredCombos.map((combo) => {
                  const comboTotal = (combo.items || []).reduce((sum, item) => sum + Number(item.precioVenta || 0) * Number(item.cantidad || 1), 0);
                  return (
                    <div
                      key={`combo-${combo.id}`}
                      className="rounded-md border bg-white p-2.5 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-xs font-bold leading-tight text-slate-900">{combo.nombre}</p>
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{combo.codigo || "Sin codigo"}</p>
                        </div>
                        <span className="max-w-20 truncate rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">Combo</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-bold text-slate-500">
                        {(combo.items || []).slice(0, 2).map((item) => (
                          <span key={`${combo.id}-${item.id}`} className="max-w-24 truncate rounded bg-slate-100 px-1.5 py-0.5">
                            {item.numeroParte} x{item.cantidad}
                          </span>
                        ))}
                        {(combo.items || []).length > 2 ? <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">+{combo.items.length - 2}</span> : null}
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-emerald-700">{money(comboTotal)}</p>
                          <p className="text-[10px] font-semibold text-slate-400">{combo.itemCount || 0} productos</p>
                        </div>
                        <Button type="button" size="icon" className="size-8 bg-violet-700 text-white hover:bg-violet-800" title="Agregar combo" onClick={() => addCombo(combo)}>
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
                {!filteredProducts.length && !filteredCombos.length ? (
                  <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm font-semibold text-slate-500 sm:col-span-2 xl:col-span-3 2xl:col-span-4">
                    No hay productos disponibles para la busqueda.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <aside className="flex h-full min-h-0 flex-col rounded-lg border bg-white shadow-sm">
          <div className="shrink-0 border-b bg-slate-50/70 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="text-sm font-bold text-violet-700">Venta actual</h2>
                  {savedQuoteCode ? (
                    <span className="truncate rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black text-violet-700">
                      Codigo: {savedQuoteCode}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] font-medium text-slate-400">{cart.length} items agregados</p>
              </div>
              <ShoppingBag className="size-5 text-violet-700" />
            </div>
            {pointOfSale.settings?.habilitarAperturaCaja ? (
              <Button type="button" variant="outline" className="mt-1.5 h-8 w-full bg-white text-xs text-red-600 hover:bg-red-50" onClick={closePointOfSale} disabled={closing}>
                {closing ? <Loader2 className="size-3.5 animate-spin" /> : <Store className="size-3.5" />}
                Cerrar caja
              </Button>
            ) : null}
          </div>
          <div className="shrink-0 border-b bg-white p-3">
            <p className="mb-1 text-xs font-bold text-violet-700">Cliente</p>
            <Input
              value={clientText}
              list="point-of-sale-client-options"
              placeholder={clientsData.loading ? "Cargando clientes..." : "Busca cliente o escribe referencia..."}
              onChange={(event) => handleClientTextChange(event.target.value)}
              className="h-10 bg-white"
            />
            <datalist id="point-of-sale-client-options">
              {clientOptions.map((option) => (
                <option key={option.value} value={option.label} />
              ))}
            </datalist>
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
            ) : clientText.trim() ? (
              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                <button
                  type="button"
                  onClick={() => setManualClientOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="flex min-w-0 items-center gap-2 font-bold text-slate-700">
                    <UserRound className="size-4 shrink-0 text-slate-500" />
                    <span className="truncate">Cliente ingresado manualmente</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-slate-400">
                    <span className="max-w-36 truncate">{manualClient.razonSocial || clientText}</span>
                    <ChevronDown className={`size-4 shrink-0 transition ${manualClientOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {manualClientOpen ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Field label="Nombre / referencia">
                      <Input
                        value={clientText}
                        onChange={(event) => setClientText(event.target.value)}
                        className="h-8 bg-white text-xs"
                      />
                    </Field>
                    <Field label="Razon social">
                      <Input
                        value={manualClient.razonSocial}
                        onChange={(event) => setManualClient((current) => ({ ...current, razonSocial: event.target.value }))}
                        className="h-8 bg-white text-xs"
                      />
                    </Field>
                    <Field label="Celular">
                      <Input
                        value={manualClient.celular}
                        onChange={(event) => setManualClient((current) => ({ ...current, celular: event.target.value }))}
                        className="h-8 bg-white text-xs"
                      />
                    </Field>
                    <Field label="Correo">
                      <Input
                        type="email"
                        value={manualClient.correo}
                        onChange={(event) => setManualClient((current) => ({ ...current, correo: event.target.value }))}
                        className="h-8 bg-white text-xs"
                      />
                    </Field>
                    <Field label="Numero de doc.">
                      <Input
                        value={manualClient.numeroDocumento}
                        onChange={(event) => setManualClient((current) => ({ ...current, numeroDocumento: event.target.value }))}
                        className="h-8 bg-white text-xs"
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {cart.map((item) => (
              <div key={item.cartId} className="rounded-lg border border-slate-200 p-3">
                {(() => {
                  const lineBase = Number(item.precioVenta || 0) * item.qty;
                  const lineDiscount = discountAmount(lineBase, item.discountType, item.discountValue);
                  const lineTotal = Math.max(lineBase - lineDiscount, 0);
                  const lineSubtotal = lineTotal / taxFactor;
                  const lineCost = costAmount(item);
                  const lineMarginAlert = lineCost > 0 && lineSubtotal <= lineCost;
                  return (
                    <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold text-slate-900">{item.descripcion}</p>
                    {item.comboName ? (
                      <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black text-violet-700">
                        <Layers3 className="size-3" />
                        Combo: <span className="truncate">{item.comboName}</span>
                      </p>
                    ) : null}
                    {item.selectedChoice ? (
                      <p className="mt-1 text-[11px] font-semibold text-violet-600">
                        {[item.selectedChoice.title, item.selectedChoice.detail].filter(Boolean).join(" - ")}
                      </p>
                    ) : null}
                    <p className="text-[11px] font-semibold text-slate-400">{item.numeroParte} · {item.marca || "Sin marca"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {lineMarginAlert ? (
                      <button
                        type="button"
                        className="rounded-md p-1 text-amber-600 hover:bg-amber-50"
                        title="Ver alerta de precio"
                        onClick={() => setPriceAlert({
                          product: item.descripcion || item.numeroParte || "Producto",
                          partNumber: item.numeroParte || "",
                          type: productTypeLabel(item),
                          sale: lineTotal,
                          subtotal: lineSubtotal,
                          cost: lineCost,
                          symbol: item.monedaSimbolo || "S/",
                        })}
                      >
                        <AlertTriangle className="size-4" />
                      </button>
                    ) : null}
                    <button type="button" className="rounded-md p-1 text-red-500 hover:bg-red-50" onClick={() => removeProduct(item.cartId)}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center rounded-md border">
                    <button type="button" className="grid size-8 place-items-center text-slate-600 hover:bg-slate-50" onClick={() => updateQty(item.cartId, -1)}>
                      <Minus className="size-3.5" />
                    </button>
                    <span className="grid h-8 min-w-10 place-items-center border-x px-2 text-xs font-bold">{item.qty}</span>
                    <button type="button" className="grid size-8 place-items-center text-slate-600 hover:bg-slate-50" onClick={() => updateQty(item.cartId, 1)}>
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <p className="text-base font-black text-slate-900">{money(lineTotal, item.monedaSimbolo || "S/")}</p>
                </div>
                <div className="mt-2 grid grid-cols-[112px_minmax(0,1fr)] gap-2 rounded-md bg-slate-50 p-2">
                  <div className="flex h-8 items-center justify-between rounded-md border border-slate-200 bg-white px-2">
                    <span className="text-[11px] font-black text-slate-700">{(item.discountType || "monto") === "monto" ? "S/" : "%"}</span>
                    <Switch
                      checked={(item.discountType || "monto") === "monto"}
                      onCheckedChange={(checked) => updateItemDiscount(item.cartId, { discountType: checked ? "monto" : "porcentaje" })}
                    />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.discountValue || ""}
                    onChange={(event) => updateItemDiscount(item.cartId, { discountValue: event.target.value })}
                    placeholder={(item.discountType || "monto") === "monto" ? "Descuento S/" : "Descuento %"}
                    className="h-8 bg-white text-xs"
                  />
                  {lineDiscount > 0 ? (
                    <p className="col-span-2 text-[11px] font-bold text-emerald-700">
                      Descuento aplicado: {money(lineDiscount, item.monedaSimbolo || "S/")}
                    </p>
                  ) : null}
                </div>
                    </>
                  );
                })()}
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

          <div className="shrink-0 border-t bg-slate-50 p-4">
            <div className="mb-3 rounded-lg border border-slate-200 bg-white p-2">
              <p className="mb-2 text-xs font-black text-violet-700">Descuento total</p>
              <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                <div className="flex h-9 items-center justify-between rounded-md border border-slate-200 bg-white px-2">
                  <span className="text-xs font-black text-slate-700">{totalDiscount.type === "monto" ? "S/" : "%"}</span>
                  <Switch
                    checked={totalDiscount.type === "monto"}
                    onCheckedChange={(checked) => setTotalDiscount((current) => ({ ...current, type: checked ? "monto" : "porcentaje" }))}
                  />
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalDiscount.value}
                  onChange={(event) => setTotalDiscount((current) => ({ ...current, value: event.target.value }))}
                  placeholder={totalDiscount.type === "monto" ? "Descuento S/" : "Descuento %"}
                  className="h-9 bg-white text-xs"
                />
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Bruto con IGV</span>
                <span className="font-bold text-slate-800">{money(grossSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Desc. productos</span>
                <span className="font-bold text-red-500">- {money(productDiscount)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Desc. total</span>
                <span className="font-bold text-red-500">- {money(totalDiscountAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Subtotal sin IGV</span>
                <span className="font-bold text-slate-800">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>IGV incluido 18%</span>
                <span className="font-bold text-slate-800">{money(tax)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-black text-violet-700">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>
            {hasMarginAlert ? (
              <div className={`mt-3 rounded-md border px-3 py-2 text-xs font-bold ${canSellAnyPrice ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                <p>
                  {canSellAnyPrice
                    ? "Alerta: el precio de venta con IGV con descuento es menor o igual al precio de compra. Tienes permiso para continuar."
                    : "No puedes generar el comprobante porque el precio de venta con IGV con descuento es menor o igual al precio de compra."}
                </p>
                <p className="mt-1 text-[11px]">
                  Tipo de producto: {(marginAlertItems.length ? marginAlertItems : cart).map((item) => `${item.name || item.descripcion || "Producto"} (${item.type || productTypeLabel(item)})`).join(", ")}.
                </p>
              </div>
            ) : null}
            {hasOutOfStockItems ? (
              <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                Hay productos sin stock disponible. Puedes registrar un anticipo de un monto antes de pasar a venta final.
              </div>
            ) : null}
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
            <div className="mt-2 grid gap-2">
              {screenMode === "venta" ? (
                <Button
                  className="h-10 w-full bg-violet-700 text-white hover:bg-violet-800"
                  disabled={!cart.length || Boolean(savingAction)}
                  onClick={generateReceipt}
                >
                  {savingAction === "comprobante" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                  Generar comprobante
                </Button>
              ) : (
                <>
                  <Button
                    className="h-10 w-full bg-violet-700 text-white hover:bg-violet-800"
                    disabled={!canGenerateReceipt || Boolean(savingAction)}
                    onClick={() => saveQuote("vendida")}
                  >
                    {savingAction === "vendida" ? <Loader2 className="size-4 animate-spin" /> : <ReceiptText className="size-4" />}
                    Pasar a ventas
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-10 bg-white"
                      disabled={!cart.length || Boolean(savingAction)}
                      onClick={() => setAdvanceDialogOpen(true)}
                    >
                      {savingAction === "anticipo" ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                      Generar anticipo
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 bg-white"
                      disabled={!cart.length || Boolean(savingAction)}
                      onClick={generateQuotePdf}
                    >
                      {savingAction === "cotizacion" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                      Generar PDF
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </section>

      <ProductLocationDialog product={locationProduct} onClose={() => setLocationProduct(null)} />
      <ProductLocationPickerDialog
        product={locationPickerProduct}
        onClose={() => setLocationPickerProduct(null)}
        onSelect={(stock) => addProduct(locationPickerProduct, stock)}
      />
      <PriceAlertDialog alert={priceAlert} onClose={() => setPriceAlert(null)} />
      <AdvanceDialog
        open={advanceDialogOpen}
        maxAmount={total}
        loading={savingAction === "anticipo"}
        onClose={() => setAdvanceDialogOpen(false)}
        onSave={async (amount, observation) => {
          await saveQuote("anticipo", { anticipoMonto: amount, anticipoObservacion: observation });
          setAdvanceDialogOpen(false);
        }}
      />
      <MovementQuoteDialog
        request={movementRequest}
        loading={savingAction === "movimiento"}
        onClose={() => setMovementRequest(null)}
        onConfirm={createMovementQuote}
      />
    </main>
  );
}

function MovementQuoteDialog({ request, loading, onClose, onConfirm }) {
  const product = request?.product;
  const choice = request?.choice;
  const stock = choice?.stock;

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(94vw,520px)] max-w-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-violet-700">
            <MapPin className="size-5" />
            Producto en otro almacen
          </DialogTitle>
          <DialogDescription>
            Este producto esta ubicado en un almacen o mostrador al que no estas asignado.
          </DialogDescription>
        </DialogHeader>
        {request ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="font-black text-slate-900">{product?.descripcion}</p>
              <p className="text-xs font-semibold text-slate-500">{product?.numeroParte}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <AlertInfo label="Ubicacion" value={choice?.detail || "-"} />
              <AlertInfo label="Almacen / Mostrador" value={[stock?.tallerName, stock?.mostradorName].filter(Boolean).join(" / ") || "-"} />
              <AlertInfo label="Lote" value={choice?.title || "-"} />
              <AlertInfo label="Stock disponible" value={choice?.stockValue || "0"} />
            </div>
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              Si aceptas, se generara una cotizacion de movimiento para que el personal asignado a ese almacen/mostrador la pase a venta.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="button" className="bg-violet-700 text-white hover:bg-violet-800" onClick={onConfirm} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                Generar cotizacion
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AdvanceDialog({ open, maxAmount, loading, onClose, onSave }) {
  const [amount, setAmount] = useState("");
  const [observation, setObservation] = useState("");
  const numericAmount = Number(amount || 0);
  const invalid = numericAmount <= 0 || numericAmount > Number(maxAmount || 0);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="w-[min(94vw,460px)] max-w-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-violet-700">
            <Banknote className="size-5" />
            Registrar anticipo
          </DialogTitle>
          <DialogDescription>
            Ingresa el monto que el cliente deja como anticipo de esta cotizacion.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
            <span className="font-semibold text-slate-500">Total cotizacion: </span>
            <span className="font-black text-violet-700">{money(maxAmount)}</span>
          </div>
          <div className="space-y-1">
            <Label>Monto de anticipo</Label>
            <Input
              type="number"
              min="0.01"
              max={maxAmount}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Ej: 50.00"
              className="h-10 bg-white"
            />
            {invalid && amount ? (
              <p className="text-xs font-semibold text-red-600">El anticipo debe ser mayor a cero y menor o igual al total.</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label>Observacion</Label>
            <Input
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Opcional"
              className="h-10 bg-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button
              type="button"
              className="bg-violet-700 text-white hover:bg-violet-800"
              disabled={invalid || loading}
              onClick={() => onSave(numericAmount, observation)}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
              Guardar anticipo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PriceAlertDialog({ alert, onClose }) {
  return (
    <Dialog open={Boolean(alert)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(94vw,520px)] max-w-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="size-5" />
            Alerta de precio
          </DialogTitle>
          <DialogDescription>
            El precio de venta con IGV con descuento es menor o igual al precio de compra.
          </DialogDescription>
        </DialogHeader>
        {alert ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="font-black text-slate-900">{alert.product}</p>
              <p className="text-xs font-semibold text-slate-500">{alert.partNumber || "Sin numero de parte"}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <AlertInfo label="Tipo de producto" value={alert.type} />
              <AlertInfo label="Precio compra" value={money(alert.cost, alert.symbol)} />
              <AlertInfo label="Venta con descuento" value={money(alert.sale, alert.symbol)} />
              <AlertInfo label="Subtotal sin IGV" value={money(alert.subtotal, alert.symbol)} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AlertInfo({ label, value }) {
  return (
    <div className="rounded-md border bg-white px-3 py-2">
      <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-900">{value || "-"}</p>
    </div>
  );
}

function OpenPointOfSaleGate({ pointOfSale }) {
  const [form, setForm] = useState({
    codigo: "PV-001",
    tallerId: "",
    mostradorId: "",
    montoInicial: "0",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await pointOfSale.create(form);
    } catch (nextError) {
      setError(nextError?.message || "No se pudo abrir el punto de venta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100svh-120px)] place-items-center bg-slate-50 p-4 text-slate-950">
      <form onSubmit={submit} className="w-full max-w-xl rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start gap-3 border-b border-violet-100 pb-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-violet-100 text-violet-700">
            <Store className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-violet-700">Abrir punto de venta</h1>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              La apertura de caja esta activa. Abre una caja para ingresar a ventas.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="pos-code">Codigo</Label>
            <Input
              id="pos-code"
              value={form.codigo}
              onChange={(event) => updateField("codigo", event.target.value)}
              placeholder="PV-001"
              className="h-10 bg-white uppercase"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pos-workshop">Taller</Label>
            <select
              id="pos-workshop"
              value={form.tallerId}
              onChange={(event) => updateField("tallerId", event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-white px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <option value="">Sin taller</option>
              {pointOfSale.options.workshops.map((item) => (
                <option key={item.id} value={item.id}>{item.nombre}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pos-counter">Mostrador</Label>
            <select
              id="pos-counter"
              value={form.mostradorId}
              onChange={(event) => updateField("mostradorId", event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-white px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <option value="">Sin mostrador</option>
              {pointOfSale.options.counters.map((item) => (
                <option key={item.id} value={item.id}>{item.nombre}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="pos-initial">Monto inicial</Label>
            <Input
              id="pos-initial"
              type="number"
              min="0"
              step="0.01"
              value={form.montoInicial}
              onChange={(event) => updateField("montoInicial", event.target.value)}
              className="h-10 bg-white"
            />
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>
        ) : null}

        <Button type="submit" className="mt-4 h-11 w-full bg-violet-700 text-white hover:bg-violet-800" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Store className="size-4" />}
          Abrir caja
        </Button>
      </form>
    </main>
  );
}

function FilterChips({ label, value, options, onChange }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[52px_minmax(0,1fr)] sm:items-start">
      <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-black transition ${
              value === item
                ? "border-violet-700 bg-violet-700 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-black uppercase text-slate-500">{label}</span>
      {children}
    </label>
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

function ProductLocationPickerDialog({ product, onClose, onSelect }) {
  if (!product) return null;
  const choices = buildSaleChoices(product);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(94vw,760px)] bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-violet-700">
            <MapPin className="size-5" />Seleccionar lote
          </DialogTitle>
          <DialogDescription>{product.numeroParte} - {product.descripcion}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {choices.map((choice) => (
            <button
              key={choice.key}
              type="button"
              onClick={() => onSelect(choice)}
              className="grid w-full gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left text-sm transition hover:border-violet-300 hover:bg-violet-50 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <p className="font-bold text-slate-900">{choice.title}</p>
                <p className="text-xs font-medium text-slate-500">{choice.detail}</p>
                {choice.stock ? (
                  <p className="text-xs font-medium text-slate-500">
                    {[choice.stock.tallerName, choice.stock.mostradorName].filter(Boolean).join(" - ") || "Sin almacen/mostrador"}
                  </p>
                ) : null}
                {choice.stock?.canAccessLocation === false ? (
                  <p className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700">
                    Requiere movimiento entre almacenes
                  </p>
                ) : null}
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-md bg-slate-50 px-2 py-1">
                    <p className="font-bold uppercase text-slate-400">Fecha de compra</p>
                    <p className="font-black text-slate-800">{formatDate(choice.purchaseDate)}</p>
                  </div>
                  <div className="rounded-md bg-slate-50 px-2 py-1">
                    <p className="font-bold uppercase text-slate-400">Fecha de vencimiento</p>
                    <p className="font-black text-slate-800">{formatDate(choice.expirationDate)}</p>
                  </div>
                  <div className="rounded-md bg-violet-50 px-2 py-1">
                    <p className="font-bold uppercase text-violet-400">Stock</p>
                    <p className="font-black text-violet-700">{choice.stockValue}</p>
                  </div>
                </div>
              </div>
            </button>
          ))}
          {!choices.length ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">
              Este producto no tiene ubicaciones disponibles.
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
