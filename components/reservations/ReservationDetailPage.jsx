"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Eye, FileText, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useReservationDetail } from "@/hooks/reservations/useReservations";

const money = (value, currency = "$") =>
  `${currency} ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function discountAmount(discount, base) {
  if (String(discount?.tipo || "").toUpperCase() === "PORCENTAJE") {
    return Number(base || 0) * Number(discount?.valor || 0) / 100;
  }
  return Number(discount?.valor || 0);
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ReservationDetailPage({ id }) {
  const { data, loading, update } = useReservationDetail(id);
  const [carDataOpen, setCarDataOpen] = useState(false);
  if (loading || !data) return <div className="p-4">Cargando reserva...</div>;
  const { reservation, detail, currentUser, vins, accessories, gifts, options, salesBossName, vinReleaseRequest } = data;
  const isSigned = reservation.estado === "firmado";
  const downloadReservationPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF("p", "mm", "a4");
    const hasAutography = await loadAutographyFont(pdf);
    const template = await loadReservationTemplate();
    await buildReservationPdf(pdf, {
      reservation: { ...reservation, tipoPersona: detail.tipoPersona, origenFondos: detail.origenFondos, codigo: detail.codigo, copropietarios: detail.copropietarios || [] },
      detail,
      accessories: accessories || [],
      gifts: gifts || [],
      salesBossName: salesBossName || "Jefe de Ventas",
      createdByName: reservation.creadoPor || "",
      hasAutography,
      template,
    });
    pdf.save(`reserva-${reservation.id}.pdf`);
  };
  const resolveVinRelease = async (vinReleaseAction, extra = {}) => {
    try {
      await update({ vinReleaseAction, ...extra });
      toast.success("Solicitud actualizada");
    } catch (error) {
      toast.error(error?.message || "No se pudo actualizar la solicitud");
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 text-slate-950">
      <style jsx global>{`
        @font-face { font-family: Autography; src: url('/fonts/Autography.ttf') format('truetype'); }
      `}</style>
      <div>
        <header className="mb-5 border-b pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link className="inline-flex size-8 items-center justify-center rounded-md border bg-white hover:bg-slate-50" href="/reservas"><ArrowLeft className="size-4" /></Link>
            <div><h1 className="text-3xl font-bold">Reserva #{reservation.id} <StatusBadge estado={reservation.estado} /></h1><p className="text-sm text-slate-600">Oportunidad #{reservation.oportunidadCode} - Cliente: <b>{reservation.cliente}</b></p></div>
          </div>
        </header>
        {reservation.observaciones ? <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4"><p className="text-xs font-bold text-yellow-800">Observaciones</p><p>{reservation.observaciones}</p></div> : null}
        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <InfoCard title="Cliente" lines={[reservation.cliente, reservation.email, reservation.celular]} />
          <InfoCard title="Vehiculo" lines={[`${detail.marca} ${detail.modelo}`, `Año: ${detail.anio || "-"}`, `VIN: ${detail.vin || "-"}`]} />
          <InfoCard title="Ubicacion" lines={[reservation.distrito || "-", reservation.provincia || "-", reservation.departamento || "-"]} />
          <InfoCard title="Total" lines={[money(detail.total), `TC: ${detail.tcReferencial || "-"}`]} />
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {reservation.oportunidadId ? <Link className="inline-flex h-7 items-center gap-1 rounded-md border bg-white px-2 text-xs font-medium hover:bg-slate-50" href={`/oportunidades/${reservation.oportunidadId}`}><Eye className="size-4" />Ver Oportunidad</Link> : null}
          <Button variant="outline" onClick={downloadReservationPdf}><Download className="size-4" />Descargar PDF</Button>
          {isSigned && detail?.vin ? (
            <VinReleaseControls
              currentUser={currentUser}
              request={vinReleaseRequest}
              vin={detail.vin}
              onAction={resolveVinRelease}
            />
          ) : null}
          {isSigned && detail?.vin && currentUser.canCarData ? (
            <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => setCarDataOpen(true)}>
              Datos del carro
            </Button>
          ) : null}
          <ReservationStatusButtons reservation={reservation} currentUser={currentUser} update={update} />
        </div>
        <ReservationForm reservation={reservation} detail={detail} vins={vins} accessories={accessories || []} gifts={gifts || []} options={options || { accessories: [], gifts: [] }} update={update} readOnly={isSigned} />
        {carDataOpen ? (
          <CarDataDialog
            open={carDataOpen}
            onOpenChange={setCarDataOpen}
            detail={detail}
            update={update}
          />
        ) : null}
      </div>
    </div>
  );
}

function ReservationStatusButtons({ reservation, currentUser, update }) {
  const status = reservation.estado || "borrador";
  const actions = currentUser.reservationStatusActions || {};
  const changeStatus = async (nextStatus, observaciones) => {
    try {
      await update({ status: nextStatus, observaciones });
      toast.success("Estado actualizado");
    } catch (error) {
      toast.error(error?.message || "No se pudo actualizar el estado");
    }
  };
  if (status === "firmado") return null;
  if (status === "borrador") {
    return actions.sendSignature ? (
      <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => changeStatus("enviado_firma")}>
        Enviar a firma
      </Button>
    ) : null;
  }
  if (status === "enviado_firma") {
    return (
      <>
        {actions.observe ? <Button variant="outline" onClick={() => changeStatus("observado", reservation.observaciones || "Observado")}>Observar</Button> : null}
        {actions.sign ? <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => changeStatus("firmado")}>Firmar</Button> : null}
      </>
    );
  }
  if (status === "observado") {
    return (
      <>
        {actions.subsanate ? <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => changeStatus("subsanado")}>Subsanar</Button> : null}
        {actions.sign ? <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => changeStatus("firmado")}>Firmar</Button> : null}
      </>
    );
  }
  if (status === "subsanado") {
    return (
      <>
        {actions.observe ? <Button variant="outline" onClick={() => changeStatus("observado", reservation.observaciones || "Observado")}>Observar</Button> : null}
        {actions.sign ? <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => changeStatus("firmado")}>Firmar</Button> : null}
      </>
    );
  }
  return null;
}

function CarDataDialog({ open, onOpenChange, detail, update }) {
  const [form, setForm] = useState(() => ({
    numeroFactura: detail?.carEvent?.numeroFactura || "",
    fechaFacturacion: toDateTimeLocal(detail?.carEvent?.fechaFacturacion),
    fechaEntregaCliente: toDateTimeLocal(detail?.carEvent?.fechaEntregaCliente),
    fechaEntregaPlaca: toDateTimeLocal(detail?.carEvent?.fechaEntregaPlaca),
    placa: detail?.carEvent?.placa || detail?.placa || "",
    kilometraje: detail?.carEvent?.kilometraje || "",
    observacion: detail?.carEvent?.observacion || "",
  }));

  async function submit() {
    try {
      await update({ action: "car-data", carEvent: form });
      toast.success("Datos del carro guardados");
      onOpenChange(false);
    } catch (error) {
      toast.error(error?.message || "No se pudo guardar datos del carro");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] w-[min(96vw,720px)] max-w-none overflow-y-auto p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-xl font-bold">Datos del carro</DialogTitle>
          <p className="text-sm text-slate-500">VIN: <b>{detail?.vin || "-"}</b></p>
        </DialogHeader>
        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          <Field label="Numero de factura">
            <Input value={form.numeroFactura} onChange={(event) => setForm((old) => ({ ...old, numeroFactura: event.target.value }))} />
          </Field>
          <Field label="Fecha facturacion">
            <Input type="datetime-local" value={form.fechaFacturacion} onChange={(event) => setForm((old) => ({ ...old, fechaFacturacion: event.target.value }))} />
          </Field>
          <Field label="Fecha entrega cliente">
            <Input type="datetime-local" value={form.fechaEntregaCliente} onChange={(event) => setForm((old) => ({ ...old, fechaEntregaCliente: event.target.value }))} />
          </Field>
          <Field label="Fecha entrega placa">
            <Input type="datetime-local" value={form.fechaEntregaPlaca} onChange={(event) => setForm((old) => ({ ...old, fechaEntregaPlaca: event.target.value }))} />
          </Field>
          <Field label="Placa">
            <Input value={form.placa} onChange={(event) => setForm((old) => ({ ...old, placa: event.target.value.toUpperCase() }))} />
          </Field>
          <Field label="Kilometraje">
            <Input type="number" min="0" value={form.kilometraje} onChange={(event) => setForm((old) => ({ ...old, kilometraje: event.target.value }))} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Observacion">
              <Textarea value={form.observacion} onChange={(event) => setForm((old) => ({ ...old, observacion: event.target.value }))} />
            </Field>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 md:col-span-2">
            Cuando completes fecha de entrega al cliente y kilometraje, se creara o actualizara automaticamente el vehiculo del cliente con marca, modelo, anio, VIN, color externo, placa y fecha de ultima visita.
          </div>
        </div>
        <DialogFooter className="border-t px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={submit}>Guardar datos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VinReleaseControls({ currentUser, request, vin, onAction }) {
  if (request) {
    if (currentUser.canViewAll) {
      return (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs">
          <span className="font-semibold text-orange-800">Liberacion VIN pendiente: {vin}</span>
          <Button size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onAction("approve", { requestId: request.id })}>Aprobar</Button>
          <Button size="sm" variant="destructive" className="h-8" onClick={() => onAction("reject", { requestId: request.id })}>Rechazar</Button>
        </div>
      );
    }
    if (Number(request.solicitadoPor) === Number(currentUser.id)) {
      return (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs">
          <span className="font-semibold text-orange-800">Solicitud pendiente para liberar VIN {vin}</span>
          <Button size="sm" variant="outline" className="h-8" onClick={() => onAction("cancel", { requestId: request.id })}>Cancelar solicitud</Button>
        </div>
      );
    }
    return <span className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800">VIN {vin} con solicitud pendiente</span>;
  }

  return (
    <Button variant="outline" onClick={() => onAction("request")}>
      Solicitar liberar VIN
    </Button>
  );
}

function ReservationForm({ reservation, detail, vins, accessories, gifts, options, update, readOnly }) {
  const [form, setForm] = useState({ ...detail });
  const [itemDialog, setItemDialog] = useState(null);
  const [coownerDialog, setCoownerDialog] = useState(null);
  const [saveState, setSaveState] = useState("guardado");
  const firstRender = useRef(true);
  const baseTotal = useMemo(() => Number(form.precioUnitario || 0) * Number(form.cantidad || 1), [form.precioUnitario, form.cantidad]);
  const extraDiscountTotal = useMemo(() => (form.descuentos || []).reduce((sum, item) => sum + discountAmount(item, baseTotal), 0), [form.descuentos, baseTotal]);
  const depositsTotal = useMemo(() => (form.depositos || []).reduce((sum, item) => sum + Number(item.monto || 0), 0), [form.depositos]);
  const accessoriesTotal = useMemo(() => accessories.reduce((sum, item) => sum + Number(item.total || 0), 0), [accessories]);
  const giftsTotal = useMemo(() => gifts.reduce((sum, item) => sum + Number(item.total || 0), 0), [gifts]);
  const total = useMemo(() => baseTotal - Number(form.descuentoTienda || 0) - Number(form.bonoRetoma || 0) - Number(form.descuentoNper || 0) - extraDiscountTotal + Number(form.glp || 0) + Number(form.tarjetaPlaca || 0) + Number(form.flete || 0) - Number(form.cuotaInicial || 0) + accessoriesTotal + giftsTotal, [baseTotal, form.descuentoTienda, form.bonoRetoma, form.descuentoNper, form.glp, form.tarjetaPlaca, form.flete, form.cuotaInicial, extraDiscountTotal, accessoriesTotal, giftsTotal]);
  const vinMessage = form.vinExiste ? "" : (form.cuotaInicial ? "Anticipo sin data" : "Reserva total sin data");
  const isFactura = String(form.tipoComprobante || "").toUpperCase().includes("FACTURA");
  const isBoleta = String(form.tipoComprobante || "").toUpperCase().includes("BOLETA");
  const updateTipoComprobante = (value) => {
    setForm((current) => ({
      ...current,
      tipoComprobante: value,
      tipoPersona: String(value || "").toUpperCase().includes("BOLETA")
        ? "NATURAL"
        : String(value || "").toUpperCase().includes("FACTURA") && ["NATURAL_RUC", "JURIDICA"].includes(current.tipoPersona)
          ? current.tipoPersona
          : "NATURAL_RUC",
    }));
  };
  const applySelectedVin = (value) => {
    const selectedVin = vins.find((item) => String(item.value) === String(value));
    setForm((current) => ({
      ...current,
      vin: value,
      colorExterno: selectedVin?.colorExterno || current.colorExterno,
      colorInterno: selectedVin?.colorInterno || current.colorInterno,
      numeroMotor: selectedVin?.numeroMotor || "",
    }));
  };
  const addDiscount = () => {
    setForm((current) => ({
      ...current,
      descuentos: [
        ...(current.descuentos || []),
        { nombre: "Nuevo descuento", tipo: "MONTO", valor: 0, orden: current.descuentos?.length || 0, nota: "" },
      ],
    }));
  };
  const updateDiscount = (index, changes) => {
    setForm((current) => ({
      ...current,
      descuentos: (current.descuentos || []).map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item),
    }));
  };
  const removeDiscount = (index) => {
    setForm((current) => ({
      ...current,
      descuentos: (current.descuentos || []).filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, orden: itemIndex })),
    }));
  };
  const addDeposit = () => {
    setForm((current) => ({
      ...current,
      depositos: [
        ...(current.depositos || []),
        { entidadFinanciera: "", numeroOperacion: "", monto: 0, fechaDeposito: "", observacion: "" },
      ],
    }));
  };
  const updateDeposit = (index, changes) => {
    setForm((current) => ({
      ...current,
      depositos: (current.depositos || []).map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item),
    }));
  };
  const removeDeposit = (index) => {
    setForm((current) => ({
      ...current,
      depositos: (current.depositos || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };
  const saveCoowner = (payload) => {
    setForm((current) => {
      const copropietarios = current.copropietarios || [];
      if (payload.index !== undefined && payload.index !== null) {
        return {
          ...current,
          copropietarios: copropietarios.map((item, index) => index === payload.index ? payload.coowner : item),
        };
      }
      return { ...current, copropietarios: [...copropietarios, payload.coowner] };
    });
    setCoownerDialog(null);
  };
  const removeCoowner = (index) => {
    setForm((current) => ({
      ...current,
      copropietarios: (current.copropietarios || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };
  const saveQuoteItem = async (payload) => {
    try {
      await update({ quoteItem: payload });
      setItemDialog(null);
      toast.success("Item actualizado");
    } catch (error) {
      toast.error(error?.message || "No se pudo actualizar el item");
    }
  };
  const removeQuoteItem = async (type, item) => {
    if (!window.confirm("Eliminar este registro?")) return;
    await saveQuoteItem({ type, mode: "delete", itemId: item.id });
  };
  useEffect(() => {
    if (readOnly) return undefined;
    if (firstRender.current) {
      firstRender.current = false;
      return undefined;
    }
    setSaveState("guardando");
    const timer = setTimeout(async () => {
      try {
        await update({ detail: { ...form, total } }, { reload: false });
        setSaveState("guardado");
      } catch {
        setSaveState("error");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [form, readOnly, total, update]);
  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="flex items-center justify-between bg-slate-50 px-4 py-3 font-bold">
        <span><FileText className="mr-2 inline size-4" />NOTA DE PEDIDO</span>
        <span className={`text-xs ${saveState === "error" ? "text-red-600" : saveState === "guardando" ? "text-orange-600" : "text-emerald-700"}`}>{saveState === "guardando" ? "Autoguardando..." : saveState === "error" ? "Error al guardar" : "Autoguardado"}</span>
      </div>
      <div className="space-y-6 p-4">
        <Block title="DATOS DEL CLIENTE">
          <Field label="Tipo de Comprobante">
            <SearchableSelect
              disabled={readOnly}
              value={form.tipoComprobante || ""}
              options={[
                { value: "Boleta", label: "Boleta" },
                { value: "Factura", label: "Factura" },
              ]}
              placeholder="Seleccionar"
              onChange={updateTipoComprobante}
            />
          </Field>
          <Field label="Tipo de persona">
            {isFactura ? (
              <SearchableSelect
                disabled={readOnly}
                value={form.tipoPersona || "NATURAL_RUC"}
                options={[
                  { value: "NATURAL_RUC", label: "Persona natural con RUC" },
                  { value: "JURIDICA", label: "Persona juridica" },
                ]}
                placeholder="Seleccionar"
                onChange={(value) => setForm((current) => ({ ...current, tipoPersona: value }))}
              />
            ) : (
              <Input disabled value={isBoleta ? "Persona natural" : "Persona natural"} />
            )}
          </Field>
          <Field label="Documento de Identidad"><Input value={reservation.documento} disabled /></Field>
          <Field label="Nombre Comercial"><Input value={reservation.nombreComercial} disabled /></Field>
          <Field label="Fecha Nacimiento"><Input value={String(reservation.fechaNacimiento || "").slice(0, 10)} disabled /></Field>
          <Field label="Ocupacion"><Input value={reservation.ocupacion} disabled /></Field>
          <Field label="Domicilio"><Input value={reservation.domicilio} disabled /></Field>
          <Field label="Email"><Input value={reservation.email} disabled /></Field>
          <Field label="Celular"><Input value={reservation.celular} disabled /></Field>
          <div className="md:col-span-2">
            <CoownersBlock
              rows={form.copropietarios || []}
              readOnly={readOnly}
              onAdd={() => setCoownerDialog({ index: null, item: null })}
              onEdit={(item, index) => setCoownerDialog({ index, item })}
              onDelete={removeCoowner}
            />
          </div>
        </Block>
        <Block title="DATOS DEL VEHICULO">
          <Field label="Marca"><Input value={form.marca} disabled /></Field>
          <Field label="Modelo"><Input value={form.modelo} disabled /></Field>
          <Field label="Clase"><Input value={form.clase} disabled /></Field>
          <Field label="Version"><Input value={form.version} disabled /></Field>
          <Field label="Año"><Input value={form.anio} disabled /></Field>
          <div className="md:col-span-2"><label className="flex items-center gap-2 text-sm font-bold"><Switch disabled={readOnly} checked={form.vinExiste} onCheckedChange={(checked) => setForm((f) => ({ ...f, vinExiste: checked, vin: checked ? f.vin : "", numeroMotor: checked ? f.numeroMotor : "" }))} /> VIN existe</label></div>
          {form.vinExiste ? <Field label={`VIN (${vins.length} disponibles)`}><SearchableSelect disabled={readOnly} value={form.vin} options={vins} placeholder="Seleccionar VIN" onChange={applySelectedVin} /></Field> : <p className="text-xs font-bold text-red-600 md:col-span-2">{vinMessage}</p>}
          <Field label="Uso del Vehiculo"><Input disabled={readOnly} value={form.usoVehiculo} onChange={(e) => setForm((f) => ({ ...f, usoVehiculo: e.target.value }))} /></Field>
          <Field label="Color Externo"><Input value={form.colorExterno} disabled /></Field>
          <Field label="Color Interno"><Input value={form.colorInterno} disabled /></Field>
          <Field label="Numero de Motor"><Input disabled={readOnly} value={form.numeroMotor} onChange={(e) => setForm((f) => ({ ...f, numeroMotor: e.target.value }))} /></Field>
        </Block>
        <Block title="DESCUENTOS Y MONTOS">
          <Field label="Descuento Dealer ($)"><Input disabled={readOnly} type="number" value={form.descuentoTienda} onChange={(e) => setForm((f) => ({ ...f, descuentoTienda: e.target.value }))} /></Field>
          <Field label="Descuento Dealer (%)"><Input disabled={readOnly} type="number" value={form.descuentoTiendaPorcentaje} onChange={(e) => setForm((f) => ({ ...f, descuentoTiendaPorcentaje: e.target.value }))} /></Field>
          <Field label="Bono Flota"><Input disabled={readOnly} type="number" value={form.bonoRetoma} onChange={(e) => setForm((f) => ({ ...f, bonoRetoma: e.target.value }))} /></Field>
          <Field label="Descuento Retail"><Input disabled={readOnly} type="number" value={form.descuentoNper} onChange={(e) => setForm((f) => ({ ...f, descuentoNper: e.target.value }))} /></Field>
          <Field label="Cantidad"><Input disabled={readOnly} type="number" value={form.cantidad} onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))} /></Field>
          <Field label="Precio Unitario"><Input disabled={readOnly} type="number" value={form.precioUnitario} onChange={(e) => setForm((f) => ({ ...f, precioUnitario: e.target.value }))} /></Field>
          <Field label="Flete"><Input disabled={readOnly} type="number" value={form.flete} onChange={(e) => setForm((f) => ({ ...f, flete: e.target.value }))} /></Field>
          <Field label="Tarjeta Placa"><Input disabled={readOnly} type="number" value={form.tarjetaPlaca} onChange={(e) => setForm((f) => ({ ...f, tarjetaPlaca: e.target.value }))} /></Field>
          <Field label="GLP"><Input disabled={readOnly} type="number" value={form.glp} onChange={(e) => setForm((f) => ({ ...f, glp: e.target.value }))} /></Field>
          <Field label="Cuota Inicial"><Input disabled={readOnly} type="number" value={form.cuotaInicial} onChange={(e) => setForm((f) => ({ ...f, cuotaInicial: e.target.value }))} /></Field>
          <Field label="Origen fondos"><Input disabled={readOnly} value={form.origenFondos || ""} onChange={(e) => setForm((f) => ({ ...f, origenFondos: e.target.value }))} /></Field>
          <Field label="Codigo"><Input disabled={readOnly} value={form.codigo || ""} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} /></Field>
          <div className="md:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-950">Descuentos adicionales</p>
                <p className="text-xs font-medium text-slate-500">Total aplicado: {money(extraDiscountTotal)}</p>
              </div>
              {!readOnly ? <Button type="button" size="sm" onClick={addDiscount}><Plus className="size-4" />Agregar descuento</Button> : null}
            </div>
            <div className="space-y-2">
              {(form.descuentos || []).map((discount, index) => (
                <div key={`${discount.id || "new"}-${index}`} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_160px_150px_1fr_auto]">
                  <Field label="Nombre">
                    <Input disabled={readOnly} value={discount.nombre || ""} onChange={(event) => updateDiscount(index, { nombre: event.target.value })} />
                  </Field>
                  <Field label="Tipo">
                    <SearchableSelect
                      disabled={readOnly}
                      value={discount.tipo || "MONTO"}
                      options={[
                        { value: "MONTO", label: "Monto" },
                        { value: "PORCENTAJE", label: "Porcentaje" },
                      ]}
                      placeholder="Tipo"
                      onChange={(value) => updateDiscount(index, { tipo: value })}
                    />
                  </Field>
                  <Field label="Valor">
                    <Input disabled={readOnly} type="number" step="0.01" value={discount.valor || ""} onChange={(event) => updateDiscount(index, { valor: event.target.value })} />
                  </Field>
                  <Field label="Nota">
                    <Input disabled={readOnly} value={discount.nota || ""} onChange={(event) => updateDiscount(index, { nota: event.target.value })} />
                  </Field>
                  {!readOnly ? (
                    <div className="flex items-end">
                      <Button type="button" variant="destructive" size="icon" onClick={() => removeDiscount(index)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                  <p className="text-xs font-bold text-red-600 md:col-span-5">Aplica: -{money(discountAmount(discount, baseTotal))}</p>
                </div>
              ))}
              {!(form.descuentos || []).length ? <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">No hay descuentos adicionales.</p> : null}
            </div>
          </div>
        </Block>
        <div className="border-t pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold">DEPOSITOS</h3>
              <p className="text-xs font-medium text-slate-500">Total depositado: {money(depositsTotal)}</p>
            </div>
            {!readOnly ? <Button type="button" size="sm" onClick={addDeposit}><Plus className="size-4" />Agregar deposito</Button> : null}
          </div>
          <div className="space-y-2">
            {(form.depositos || []).map((deposit, index) => (
              <div key={`${deposit.id || "new"}-${index}`} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_160px_140px_190px_1fr_auto]">
                <Field label="Entidad financiera">
                  <Input disabled={readOnly} value={deposit.entidadFinanciera || ""} onChange={(event) => updateDeposit(index, { entidadFinanciera: event.target.value })} />
                </Field>
                <Field label="Operacion">
                  <Input disabled={readOnly} value={deposit.numeroOperacion || ""} onChange={(event) => updateDeposit(index, { numeroOperacion: event.target.value })} />
                </Field>
                <Field label="Monto">
                  <Input disabled={readOnly} type="number" step="0.01" value={deposit.monto || ""} onChange={(event) => updateDeposit(index, { monto: event.target.value })} />
                </Field>
                <Field label="Fecha deposito">
                  <Input disabled={readOnly} type="datetime-local" value={toDateTimeLocal(deposit.fechaDeposito)} onChange={(event) => updateDeposit(index, { fechaDeposito: event.target.value })} />
                </Field>
                <Field label="Observacion">
                  <Input disabled={readOnly} value={deposit.observacion || ""} onChange={(event) => updateDeposit(index, { observacion: event.target.value })} />
                </Field>
                {!readOnly ? (
                  <div className="flex items-end">
                    <Button type="button" variant="destructive" size="icon" onClick={() => removeDeposit(index)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {!(form.depositos || []).length ? <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">No hay depositos registrados.</p> : null}
          </div>
        </div>
        <ItemsBlock
          title="ACCESORIOS"
          rows={accessories}
          referenceKey="numeroParte"
          readOnly={readOnly}
          onAdd={() => setItemDialog({ type: "accessory", item: null })}
          onEdit={(item) => setItemDialog({ type: "accessory", item })}
          onDelete={(item) => removeQuoteItem("accessory", item)}
        />
        <ItemsBlock
          title="REGALOS"
          rows={gifts}
          referenceKey="lote"
          readOnly={readOnly}
          onAdd={() => setItemDialog({ type: "gift", item: null })}
          onEdit={(item) => setItemDialog({ type: "gift", item })}
          onDelete={(item) => removeQuoteItem("gift", item)}
        />
        <Field label="Observaciones / Descripcion"><Textarea disabled={readOnly} value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></Field>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="grid gap-2 text-sm md:grid-cols-4">
            <p><b>Vehiculo:</b> {money(baseTotal)}</p>
            <p><b>Accesorios:</b> {money(accessoriesTotal)}</p>
            <p><b>Regalos:</b> {money(giftsTotal)}</p>
            <p><b>Cuota inicial:</b> -{money(form.cuotaInicial)}</p>
          </div>
          <div className="mt-3 text-right text-2xl font-bold text-blue-700">TOTAL FINAL: {money(total)}</div>
        </div>
        {itemDialog ? (
          <ReservationItemDialog
            dialog={itemDialog}
            options={itemDialog.type === "gift" ? options.gifts : options.accessories}
            onClose={() => setItemDialog(null)}
            onSubmit={saveQuoteItem}
          />
        ) : null}
        {coownerDialog ? (
          <CoownerDialog
            state={coownerDialog}
            onClose={() => setCoownerDialog(null)}
            onSubmit={saveCoowner}
          />
        ) : null}
      </div>
    </section>
  );
}

function Block({ title, children }) { return <div className="border-t pt-4"><h3 className="mb-4 font-bold">{title}</h3><div className="grid gap-3 md:grid-cols-2">{children}</div></div>; }
function CoownersBlock({ rows, readOnly, onAdd, onEdit, onDelete }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="font-bold">Copropietarios</h4>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-bold">{rows.length} registros</span>
        </div>
        {!readOnly ? <Button type="button" size="sm" onClick={onAdd}><UserPlus className="size-4" />Agregar copropietario</Button> : null}
      </div>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={`${row.id || "new"}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border bg-white p-3">
            <div>
              <p className="font-semibold">{[row.nombre, row.apellido].filter(Boolean).join(" ") || row.nombreComercial || "-"}</p>
              <p className="text-xs text-slate-500">{row.tipoIdentificacion || "-"} {row.numeroDocumento || ""}{row.nombreComercial ? ` - ${row.nombreComercial}` : ""}</p>
              <p className="text-xs text-slate-500">{row.email || "-"} {row.celular ? `- ${row.celular}` : ""}</p>
            </div>
            {!readOnly ? (
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => onEdit(row, index)}><FileText className="size-4" /></Button>
                <Button type="button" size="icon" variant="ghost" className="text-red-600" onClick={() => onDelete(index)}><Trash2 className="size-4" /></Button>
              </div>
            ) : null}
          </div>
        ))}
        {!rows.length ? <p className="rounded-lg border border-dashed bg-white p-4 text-center text-sm text-slate-500">Sin copropietarios registrados.</p> : null}
      </div>
    </div>
  );
}
function ItemsBlock({ title, rows, referenceKey, readOnly, onAdd, onEdit, onDelete }) { const total = rows.reduce((sum, item) => sum + Number(item.total || 0), 0); return <div className="border-t pt-4"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><h3 className="font-bold">{title}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{rows.length} registros</span></div>{!readOnly ? <Button size="sm" className="bg-slate-950 text-white hover:bg-slate-800" onClick={onAdd}><Plus className="size-4" />Agregar</Button> : null}</div><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[860px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="px-3 py-3">Detalle</th><th>Referencia</th><th>Cant.</th><th>Unitario</th><th>Desc.</th><th>Total</th><th>Acciones</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id}><td className="px-3 py-3 font-medium"><p>{row.detalle}</p>{row.notas ? <p className="text-xs text-slate-500">{row.notas}</p> : null}</td><td>{row[referenceKey] || "-"}</td><td>{row.cantidad}</td><td>{money(row.precioUnitario)}</td><td className="text-red-600">{discountLabel(row)}</td><td className="font-bold text-blue-700">{money(row.total)}</td><td>{!readOnly ? <div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => onEdit(row)}><FileText className="size-4" /></Button><Button size="icon" variant="ghost" className="text-red-600" onClick={() => onDelete(row)}><Trash2 className="size-4" /></Button></div> : "-"}</td></tr>)}{!rows.length ? <tr><td className="py-8 text-center text-slate-500" colSpan={7}>Sin registros</td></tr> : null}</tbody></table></div><div className="mt-3 rounded-lg border bg-slate-50 p-3 text-right font-bold">Total {title}: {money(total)}</div></div>; }
function Field({ label, children }) { return <div className="space-y-1"><Label className="text-xs font-bold text-slate-600">{label}</Label>{children}</div>; }
function InfoCard({ title, lines }) { return <div className="rounded-lg border bg-white p-5 shadow-sm"><p className="mb-6 font-semibold">{title}</p>{lines.map((line, index) => <p key={index} className={index === 0 ? "font-bold" : "text-sm text-slate-600"}>{line || "-"}</p>)}</div>; }
function StatusBadge({ estado }) { return <span className="ml-2 rounded-full bg-blue-100 px-2 py-1 align-middle text-xs font-bold text-blue-700">{estado}</span>; }

function ReservationItemDialog({ dialog, options, onClose, onSubmit }) {
  const item = dialog.item;
  const isGift = dialog.type === "gift";
  const initialCatalog = item ? (isGift ? item.regaloId : item.accesorioId) : "";
  const initialDiscountType = Number(item?.descuentoMonto || 0) > 0 ? "amount" : "percentage";
  const [form, setForm] = useState({
    catalogId: initialCatalog ? String(initialCatalog) : "",
    cantidad: item?.cantidad || 1,
    discountType: initialDiscountType,
    discountValue: initialDiscountType === "amount" ? Number(item?.descuentoMonto || 0) : Number(item?.descuentoPorcentaje || 0),
    notas: item?.notas || "",
  });
  const selected = useMemo(() => options.find((option) => String(option.value) === String(form.catalogId)), [options, form.catalogId]);
  const unit = Number(selected?.price || item?.precioUnitario || 0);
  const subtotal = unit * Number(form.cantidad || 1);
  const discount = form.discountType === "amount" ? Number(form.discountValue || 0) : subtotal * Number(form.discountValue || 0) / 100;
  const total = Math.max(subtotal - discount, 0);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] w-[min(96vw,720px)] max-w-none overflow-y-auto bg-white p-0 text-slate-950">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{item ? "Editar" : "Agregar"} {isGift ? "regalo" : "accesorio"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          <Field label={isGift ? "Regalo" : "Accesorio"}>
            <SearchableSelect value={form.catalogId} options={options} placeholder={`Seleccionar ${isGift ? "regalo" : "accesorio"}`} onChange={(value) => setForm((prev) => ({ ...prev, catalogId: value }))} />
          </Field>
          <Field label="Cantidad">
            <Input type="number" min="1" value={form.cantidad} onChange={(event) => setForm((prev) => ({ ...prev, cantidad: event.target.value }))} />
          </Field>
          <Field label="Tipo de descuento">
            <SearchableSelect
              value={form.discountType}
              options={[{ value: "percentage", label: "Por porcentaje (%)" }, { value: "amount", label: "Por monto" }]}
              onChange={(value) => setForm((prev) => ({ ...prev, discountType: value, discountValue: 0 }))}
            />
          </Field>
          <Field label={form.discountType === "amount" ? "Monto" : "Porcentaje (%)"}>
            <Input type="number" min="0" step="0.01" value={form.discountValue} onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Notas">
              <Textarea value={form.notas} placeholder="Agregue notas..." onChange={(event) => setForm((prev) => ({ ...prev, notas: event.target.value }))} />
            </Field>
          </div>
          <div className="rounded-lg border bg-slate-50 p-4 md:col-span-2">
            <div className="grid gap-3 text-sm md:grid-cols-4">
              <Info label="Subtotal" value={money(subtotal)} />
              <Info label="Descuento" value={`-${money(discount)}`} />
              <Info label="Unitario" value={money(unit)} />
              <Info label="Total" value={money(total)} />
            </div>
          </div>
        </div>
        <DialogFooter className="border-t px-5 py-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-slate-950 text-white hover:bg-slate-800" disabled={!form.catalogId} onClick={() => onSubmit({ type: dialog.type, mode: item ? "update" : "create", itemId: item?.id, ...form })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="font-bold">{value}</p></div>;
}

function CoownerDialog({ state, onClose, onSubmit }) {
  const item = state.item || {};
  const [form, setForm] = useState({
    nombre: item.nombre || "",
    apellido: item.apellido || "",
    email: item.email || "",
    celular: item.celular || "",
    tipoIdentificacion: item.tipoIdentificacion || "",
    numeroDocumento: item.numeroDocumento || "",
    nombreComercial: item.nombreComercial || "",
  });
  const isRuc = form.tipoIdentificacion === "RUC";
  const isNumericDocument = form.tipoIdentificacion === "DNI" || form.tipoIdentificacion === "RUC";
  const documentMaxLength = form.tipoIdentificacion === "DNI" ? 8 : form.tipoIdentificacion === "RUC" ? 11 : undefined;
  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateDocument = (value) => {
    const nextValue = isNumericDocument ? value.replace(/\D/g, "").slice(0, documentMaxLength) : value;
    updateField("numeroDocumento", nextValue);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] w-[min(96vw,720px)] max-w-none overflow-y-auto bg-white p-0 text-slate-950">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{state.item ? "Editar" : "Agregar"} copropietario</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          <Field label="Tipo identificacion">
            <SearchableSelect
              value={form.tipoIdentificacion}
              options={[
                { value: "DNI", label: "DNI" },
                { value: "RUC", label: "RUC" },
                { value: "PASAPORTE", label: "PASAPORTE" },
              ]}
              placeholder="Seleccionar"
              onChange={(value) => setForm((current) => {
                const numeric = value === "DNI" || value === "RUC";
                const maxLength = value === "DNI" ? 8 : value === "RUC" ? 11 : undefined;
                return {
                  ...current,
                  tipoIdentificacion: value,
                  numeroDocumento: numeric ? current.numeroDocumento.replace(/\D/g, "").slice(0, maxLength) : current.numeroDocumento,
                  nombreComercial: value === "RUC" ? current.nombreComercial : "",
                };
              })}
            />
          </Field>
          <Field label="Numero documento">
            <Input
              value={form.numeroDocumento}
              inputMode={isNumericDocument ? "numeric" : undefined}
              maxLength={documentMaxLength}
              onChange={(event) => updateDocument(event.target.value)}
            />
          </Field>
          <Field label="Nombre">
            <Input value={form.nombre} onChange={(event) => updateField("nombre", event.target.value)} />
          </Field>
          <Field label="Apellido">
            <Input value={form.apellido} onChange={(event) => updateField("apellido", event.target.value)} />
          </Field>
          {isRuc ? (
            <div className="md:col-span-2">
              <Field label="Nombre comercial">
                <Input value={form.nombreComercial} onChange={(event) => updateField("nombreComercial", event.target.value)} />
              </Field>
            </div>
          ) : null}
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
          </Field>
          <Field label="Celular">
            <Input value={form.celular} onChange={(event) => updateField("celular", event.target.value)} />
          </Field>
        </div>
        <DialogFooter className="border-t px-5 py-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => onSubmit({ index: state.index, coowner: form })}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function discountLabel(row) {
  const amount = Number(row.descuentoMonto || 0);
  const percentage = Number(row.descuentoPorcentaje || 0);
  if (percentage) return `-${percentage.toFixed(2)}%`;
  if (amount) return `-${money(amount)}`;
  return "-";
}

async function loadAutographyFont(pdf) {
  try {
    const response = await fetch("/fonts/Autography.ttf");
    if (!response.ok) return false;
    const buffer = await response.arrayBuffer();
    pdf.addFileToVFS("Autography.ttf", arrayBufferToBase64(buffer));
    pdf.addFont("Autography.ttf", "Autography", "normal");
    return true;
  } catch {
    return false;
  }
}

async function loadReservationTemplate() {
  try {
    const response = await fetch("/api/sales-document-templates?tipoDocumento=RESERVA&active=1", { credentials: "include" });
    if (!response.ok) return null;
    const data = await response.json();
    return (data.templates || []).find((template) => template.tipoDocumento === "RESERVA" && template.isActive) || null;
  } catch {
    return null;
  }
}

async function imageToDataUrl(path) {
  if (!path) return "";
  try {
    const response = await fetch(path);
    if (!response.ok) return "";
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

async function buildReservationPdf(pdf, { reservation, detail, accessories, gifts, salesBossName, createdByName, hasAutography, template }) {
  // Debe quedar 1 hoja: no se llamará addPage (pero se mantiene la estructura)
  const ALLOW_MULTIPAGE = false;

  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();  // 297

  const margin = 8;
  const left = margin;
  const top = 10;
  const right = pageW - margin;
  const bottom = pageH - margin;

  const lineColor = [35, 35, 35];
  const headerFill = [235, 235, 235];
  const labelFill = [245, 245, 245];

  const money = (value, currency = "$") =>
    `${currency} ${Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (v) => {
    if (!v) return "-";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const clip = (value, max = 40) => {
    const s = String(value ?? "");
    if (!s) return "-";
    return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
  };

  const setFont = (weight = "normal", size = 8) => {
    pdf.setFont("helvetica", weight);
    pdf.setFontSize(size);
  };

  const rect = (x, y, w, h, fill = null) => {
    if (fill) {
      pdf.setFillColor(...fill);
      pdf.rect(x, y, w, h, "F");
    }
    pdf.setDrawColor(...lineColor);
    pdf.rect(x, y, w, h);
  };

  const text = (t, x, y, opts = {}) => pdf.text(String(t ?? "-"), x, y, opts);
  const getTemplateSection = (type) => (template?.secciones || [])
    .filter((section) => section.tipo === type && section.isActive)
    .flatMap((section) => section.elementos || [])
    .filter((element) => element.isActive);
  const drawTemplateElements = async (elements, x, y, w, h) => {
    if (!elements.length) return false;
    const groups = [...elements].sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0) || Number(a.id || 0) - Number(b.id || 0))
      .reduce((acc, element) => {
        const key = Number(element.orden || 0);
        const group = acc.get(key) || [];
        group.push(element);
        acc.set(key, group);
        return acc;
      }, new Map());
    const rows = [...groups.values()];
    const rowH = Math.max(h / Math.max(rows.length, 1), 4);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const colW = w / Math.max(row.length, 1);
      for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
        const element = row[colIndex];
        const cellX = x + colIndex * colW;
        const cellY = y + rowIndex * rowH;
        const align = element.align === "RIGHT" ? "right" : element.align === "CENTER" ? "center" : "left";
        const textX = align === "right" ? cellX + colW - 1 : align === "center" ? cellX + colW / 2 : cellX + 1;
        if (element.tipo === "IMAGEN" && element.imagenPath) {
          const dataUrl = await imageToDataUrl(element.imagenPath);
          if (dataUrl) {
            const imgW = Math.min(Number(element.widthPx || 0) / 4 || colW - 2, colW - 2);
            const imgH = Math.min(Number(element.heightPx || 0) / 4 || rowH - 1, rowH - 1);
            const imgX = align === "right" ? cellX + colW - imgW - 1 : align === "center" ? cellX + (colW - imgW) / 2 : cellX + 1;
            pdf.addImage(dataUrl, undefined, imgX, cellY + 0.5, imgW, imgH);
          }
        } else {
          setFont(element.tipo === "LINK" ? "bold" : "normal", 7);
          pdf.setTextColor(element.tipo === "LINK" ? 30 : 35, element.tipo === "LINK" ? 80 : 35, element.tipo === "LINK" ? 180 : 35);
          text(clip(element.texto || element.url || "", 45), textX, cellY + Math.min(rowH - 1, 4), { align });
          pdf.setTextColor(0, 0, 0);
        }
      }
    }
    return true;
  };
  const drawTemplateWatermark = async () => {
    if (!template?.marcaAgua?.imagenPath) return;
    const dataUrl = await imageToDataUrl(template.marcaAgua.imagenPath);
    if (!dataUrl) return;
    const previousGState = pdf.GState && pdf.setGState
      ? new pdf.GState({ opacity: Number(template.marcaAgua.opacity || 0.15) })
      : null;
    if (previousGState) pdf.setGState(previousGState);
    const scale = Number(template.marcaAgua.scale || 1);
    const size = Math.min(pageW, pageH) * 0.42 * scale;
    pdf.addImage(dataUrl, undefined, (pageW - size) / 2, (pageH - size) / 2, size, size, undefined, "FAST", Number(template.marcaAgua.rotateDeg || 0));
    if (previousGState) pdf.setGState(new pdf.GState({ opacity: 1 }));
  };

  // Mantener helper tipo "ensurePage" (como tu estilo original)
  // pero sin addPage para que siempre sea 1 hoja.
  let currentY = top;

  // Reservamos el bloque de firmas + observaciones al final
  const obsH = 28;     // alto observaciones (para que entre el texto legal)
  const signH = 26;    // alto firmas
  const footerGap = 2;
  const contentBottom = bottom - (obsH + signH + footerGap);

  const ensurePage = (heightNeeded = 0) => {
    if (currentY + heightNeeded <= contentBottom) return;
    if (ALLOW_MULTIPAGE) {
      pdf.addPage();
      currentY = top;
      return;
    }
    // Clamp
    currentY = Math.max(top, contentBottom - heightNeeded);
  };

  // =========================================================
  // ✅ Datos preferentemente desde reservation (como pediste),
  // con fallback a detail solo si no existe.
  // =========================================================
  const r = reservation || {};
  const d = detail || {};

  const cliente = r.cliente || [r.nombre, r.apellido].filter(Boolean).join(" ") || "-";
  const copropietarios = Array.isArray(r.copropietarios) ? r.copropietarios : [];
  const copropietariosTexto = copropietarios
    .map((item) => [item.nombre, item.apellido].filter(Boolean).join(" ") || item.nombreComercial || "")
    .filter(Boolean)
    .join(", ");
  const conyugue = copropietariosTexto || r.conyugue || r.nombreconyugue || "-";
  const documento = r.documento || r.identificacion_fiscal || "-";
  const documentoConyugue = r.dniConyugue || r.dniconyugue || "-";

  const email = r.email || "-";
  const celular = r.celular || "-";
  const fechaNacimiento = formatDate(r.fechaNacimiento || r.fecha_nacimiento);
  const ocupacion = r.ocupacion || "-";
  const domicilio = r.domicilio || "-";

  const distrito = r.distrito || "-";
  const provincia = r.provincia || "-";
  const region = r.departamento || r.region || "-";

  const asesor = createdByName || r.creadoPor || r.creado_por || "-";
  const fechaDoc = formatDate(r.createdAt || r.created_at || r.fecha || new Date());
  const origenVenta = r.origenVenta || r.origen_venta || "-";
  const campania = r.campania || "-";
  const idTexto = r.idLead || r.id_lead || r.leadId || r.codigo || r.id || "-";

  const tipoComprobante = r.tipoComprobante || r.tipo_comprobante || d.tipoComprobante || "-";
  const tipoPersona = r.tipoPersona || r.tipo_persona || d.tipoPersona || "NATURAL";
  const personTitle = tipoPersona === "JURIDICA"
    ? "NOTA DE PEDIDO - PERSONA JURIDICA"
    : tipoPersona === "NATURAL_RUC"
      ? "NOTA DE PEDIDO - PERSONA NATURAL CON RUC"
      : "NOTA DE PEDIDO - PERSONA NATURAL";

  // Vehículo (reservation con fallback a detail/form)
  const marca = r.marca || d.marca || "-";
  const modelo = r.modelo || d.modelo || "-";
  const clase = r.clase || d.clase || "-";
  const version = r.version || d.version || "-";
  const anio = r.anio || d.anio || "-";
  const vin = r.vin || d.vin || "-";
  const color = r.color || r.colorExterno || d.colorExterno || "-";
  const motor = r.numeroMotor || r.motor || d.numeroMotor || "-";
  const codigoUnidad = r.codigoUnidad || r.codigo_unidad || r.codigo || "-";

  // Montos (reservation con fallback a detail)
  const precioLista =
    r.precioLista ??
    r.precio_lista ??
    r.precioBase ??
    r.precio_base ??
    d.precioBase ??
    d.precioUnitario ??
    0;

  const totalFinal =
    r.total ??
    r.total_final ??
    r.totalFinal ??
    d.total ??
    0;

  // Depósitos (reservation.depositos con fallback a detail.depositos)
  const depositos = Array.isArray(r.depositos) ? r.depositos : (Array.isArray(d.depositos) ? d.depositos : []);

  const signed = r.estado === "firmado";

  // =========================================================
  // Layout tipo hoja (1 sola hoja)
  // =========================================================
  await drawTemplateWatermark();
  rect(left, top, right - left, bottom - top);

  // Header
  const headerH = 20;
  rect(left, currentY, right - left, headerH);
  rect(left, currentY, 90, headerH);

  const headerTemplateApplied = await drawTemplateElements(getTemplateSection("ENCABEZADO"), left + 2, currentY + 2, 86, headerH - 4);
  if (!headerTemplateApplied) {
    setFont("bold", 24);
    text("Wankamotors", left + 4, currentY + 14);
  }

  rect(left + 90, currentY, (right - left) - 90, headerH);

  setFont("bold", 10);
  text(clip(asesor, 30), left + 94, currentY + 6);

  setFont("bold", 8);
  text("FECHA", left + 94, currentY + 14);
  setFont("normal", 8);
  text(fechaDoc, left + 110, currentY + 14);

  setFont("bold", 8);
  text("ORIGEN:", left + 150, currentY + 14);
  setFont("normal", 8);
  text(clip(origenVenta, 14), left + 165, currentY + 14);

  currentY += headerH;

  // ID / Campaña
  const idH2 = 9;
  rect(left, currentY, right - left, idH2);
  rect(left, currentY, 18, idH2, headerFill);

  setFont("bold", 8);
  text("ID:", left + 2, currentY + 6.2);
  setFont("normal", 8);
  text(clip(idTexto, 28), left + 21, currentY + 6.2);

  setFont("bold", 8);
  text("CAMPAÑA:", left + 120, currentY + 6.2);
  setFont("normal", 8);
  text(clip(campania, 24), left + 145, currentY + 6.2);

  currentY += idH2;

  // Título
  const titleH = 7;
  rect(left, currentY, right - left, titleH, headerFill);
  setFont("bold", 9.5);
  text(personTitle, (left + right) / 2, currentY + 5.2, { align: "center" });
  currentY += titleH;

  // Helper filas
  const rowH = 5.8;
  const labelW = 56;
  const col1W = 82;
  const col2W = (right - left) - labelW - col1W;

  const row = (label, v1, v2 = "") => {
    ensurePage(rowH);
    rect(left, currentY, right - left, rowH);
    rect(left, currentY, labelW, rowH, labelFill);

    setFont("bold", 7.0);
    text(label, left + 2, currentY + 4.2);

    setFont("normal", 7.8);
    if (v2 === "" || v2 === null || typeof v2 === "undefined") {
      rect(left + labelW, currentY, (right - left) - labelW, rowH);
      text(clip(v1, 74), left + labelW + 2, currentY + 4.2);
    } else {
      rect(left + labelW, currentY, col1W, rowH);
      rect(left + labelW + col1W, currentY, col2W, rowH);
      text(clip(v1, 44), left + labelW + 2, currentY + 4.2);
      text(clip(v2, 34), left + labelW + col1W + 2, currentY + 4.2);
    }

    currentY += rowH;
  };

  // ===== Datos Cliente =====
  row("COMPROBANTE", tipoComprobante);
  row("NOMBRES Y APELLIDOS", cliente);
  row("CONYUGUE/CO-PROP.", conyugue);
  row("DNI / DNI CONY.", documento, documentoConyugue);
  row("DIRECCION", domicilio);

  // Distrito/Provincia/Región en una fila
  ensurePage(rowH);
  rect(left, currentY, right - left, rowH);
  rect(left, currentY, labelW, rowH, labelFill);

  setFont("bold", 7.0);
  text("DISTRITO", left + 2, currentY + 4.2);

  const aW = 42;
  const bLblW = 18;
  const bW = 36;
  const cLblW = 16;
  const cW = (right - left) - labelW - aW - bLblW - bW - cLblW;

  rect(left + labelW, currentY, aW, rowH);
  setFont("normal", 7.8);
  text(clip(distrito, 14), left + labelW + 2, currentY + 4.2);

  rect(left + labelW + aW, currentY, bLblW, rowH, labelFill);
  setFont("bold", 7.0);
  text("PROV.", left + labelW + aW + 2, currentY + 4.2);

  rect(left + labelW + aW + bLblW, currentY, bW, rowH);
  setFont("normal", 7.8);
  text(clip(provincia, 12), left + labelW + aW + bLblW + 2, currentY + 4.2);

  rect(left + labelW + aW + bLblW + bW, currentY, cLblW, rowH, labelFill);
  setFont("bold", 7.0);
  text("REG.", left + labelW + aW + bLblW + bW + 2, currentY + 4.2);

  rect(left + labelW + aW + bLblW + bW + cLblW, currentY, cW, rowH);
  setFont("normal", 7.8);
  text(clip(region, 10), left + labelW + aW + bLblW + bW + cLblW + 2, currentY + 4.2);

  currentY += rowH;

  row("TELEFONO", celular);
  row("F. NACIMIENTO", fechaNacimiento);
  row("CORREO", email);
  row("OCUPACION", ocupacion);
  row("ORIGEN FONDOS", r.origenFondos || r.origen_fondos || "-");

  // ===== Vehículo =====
  ensurePage(7);
  rect(left, currentY, right - left, 6.8, headerFill);
  setFont("bold", 8.8);
  text("DATOS DEL VEHICULO", left + 2, currentY + 4.9);
  currentY += 6.8;

  row("MARCA", marca);
  row("MODELO", modelo, "VERSION");
  row("CLASE", clase, version);
  row("COLOR", color);
  row("AÑO", anio);
  row("CHASIS/VIN", vin);
  row("MOTOR", motor);
  row("CODIGO", codigoUnidad);

  // ===== Precios =====
  ensurePage(7);
  rect(left, currentY, right - left, 6.8, headerFill);
  setFont("bold", 8.8);
  text("PRECIOS", left + 2, currentY + 4.9);
  currentY += 6.8;

  row("PRECIO LISTA", money(precioLista));
  row("PRECIO FINAL", money(totalFinal));

  // ===== Depósitos =====
  ensurePage(7);
  rect(left, currentY, right - left, 6.8, headerFill);
  setFont("bold", 8.8);
  text("DEPOSITOS (MONTO / FECHA / BANCO / OP)", left + 2, currentY + 4.9);
  currentY += 6.8;

  const depRows = 5;
  const depLabelW = 56;
  const montoW = 34;
  const fechaW = 30;
  const bancoW = 44;
  const opW = (right - left) - depLabelW - montoW - fechaW - bancoW;

  for (let i = 0; i < depRows; i++) {
    const dep = depositos[i];
    ensurePage(rowH);

    rect(left, currentY, right - left, rowH);
    rect(left, currentY, depLabelW, rowH, labelFill);
    setFont("bold", 6.8);
    text("MONTO DEPOSITO", left + 2, currentY + 4.2);

    rect(left + depLabelW, currentY, montoW, rowH);
    rect(left + depLabelW + montoW, currentY, fechaW, rowH);
    rect(left + depLabelW + montoW + fechaW, currentY, bancoW, rowH);
    rect(left + depLabelW + montoW + fechaW + bancoW, currentY, opW, rowH);

    setFont("normal", 7.8);
    text(dep ? money(dep.monto) : "-", left + depLabelW + 2, currentY + 4.2);
    text(dep ? formatDate(dep.fechaDeposito) : "-", left + depLabelW + montoW + 2, currentY + 4.2);
    text(dep ? clip(dep.entidadFinanciera, 16) : "-", left + depLabelW + montoW + fechaW + 2, currentY + 4.2);
    text(dep ? clip(dep.numeroOperacion, 20) : "-", left + depLabelW + montoW + fechaW + bancoW + 2, currentY + 4.2);

    currentY += rowH;
  }

  // =========================================================
  // ✅ Bloque de firmas EXACTO como tu original (Autography)
  // =========================================================
  const signAreaTop = bottom - (obsH + signH); // inicia bloque firmas+obs
  const labelsY = signAreaTop;
  const lineY = signAreaTop + 18;

  // Labels
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("FIRMA DEL CLIENTE:", left + 0, labelsY);
  pdf.text("FIRMA ASESOR:", left + 70, labelsY);
  pdf.text("FIRMA AUTORIZADO:", left + 132, labelsY);

  // líneas
  pdf.setDrawColor(...lineColor);
  pdf.line(left + 0, lineY, left + 60, lineY);
  pdf.line(left + 70, lineY, left + 120, lineY);
  pdf.line(left + 132, lineY, right, lineY);

  if (signed) {
    pdf.setFont(hasAutography ? "Autography" : "helvetica", hasAutography ? "normal" : "italic");
    pdf.setFontSize(17);

    // asesor (columna medio)
    pdf.text(asesor || "Asesor", left + 70, lineY - 3);

    // jefe ventas / autorizado (columna derecha)
    pdf.text(salesBossName || "Jefe de Ventas", left + 132, lineY - 3);
  }

  // =========================================================
  // ✅ Observaciones: texto fijo + (opcional) extra obs
  // =========================================================
  const obsY = signAreaTop + signH;
  rect(left, obsY, right - left, obsH);
  rect(left, obsY, 40, obsH, labelFill);

  const LEGAL_TEXT =
    "Se deja constancia que si desiste de la compra y desea la devolución, estará afecta a un % de retención por concepto de gastos " +
    "administrativos y que el monto en materia de devolución está afecta a 20 días hábiles, cualquier cambio adicional que no conste en la " +
    "presente no será responsabilidad de la empresa. LA ENTREGA ESTÁ SUJETA A STOCK, LOS PLAZOS DE ENTREGA PUEDEN SUFRIR " +
    "VARIACIÓN POR POSIBLES DEMORAS EN LA ENTREGA DEL VEHÍCULO POR PARTE DE LA MARCA, POR TAL CASO NO SERÁ " +
    "IMPUTABLE AL VENDEDOR O A WANKAMOTORS, CABE RESALTAR QUE EL PRECIO PUEDE SUFRIR VARIACIÓN POR FACTORES " +
    "EXTERNOS AJENOS A WANKAMOTORS Y ESTIPULADOS POR LA MARCA. UNA VEZ EMITIDO EL MISMO NO SE ACEPTARÁ SU CAMBIO " +
    "NI CANJE. Por tal motivo agradecemos verificar la información registrada, en señal de conformidad el cliente deja como constancia su firma.";

  const extraObs = String(r.observaciones || "").trim();
  const obsText = extraObs ? `${LEGAL_TEXT}\n\nOBS: ${extraObs}` : LEGAL_TEXT;

  setFont("bold", 8);
  text("OBSERVACIONES", left + 2, obsY + 6);

  // título centrado
  
  
  // texto legal
  setFont("bold", 6.8);
  const wrapped = pdf.splitTextToSize(obsText.toUpperCase(), (right - left) - 40 - 4);
  pdf.text(wrapped.slice(0, 7), left + 42, obsY + 12); // 7 líneas aprox entran en obsH=28
  await drawTemplateElements(getTemplateSection("PIE"), left + 2, bottom - 7, right - left - 4, 5);
}
