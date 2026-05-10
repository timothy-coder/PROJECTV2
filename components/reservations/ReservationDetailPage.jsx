"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Eye, FileText, Plus, Trash2 } from "lucide-react";
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
    buildReservationPdf(pdf, {
      reservation,
      detail,
      accessories: accessories || [],
      gifts: gifts || [],
      salesBossName: salesBossName || "Jefe de Ventas",
      createdByName: reservation.creadoPor || "",
      hasAutography,
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
  const [saveState, setSaveState] = useState("guardado");
  const firstRender = useRef(true);
  const baseTotal = useMemo(() => Number(form.precioUnitario || 0) * Number(form.cantidad || 1), [form.precioUnitario, form.cantidad]);
  const extraDiscountTotal = useMemo(() => (form.descuentos || []).reduce((sum, item) => sum + discountAmount(item, baseTotal), 0), [form.descuentos, baseTotal]);
  const depositsTotal = useMemo(() => (form.depositos || []).reduce((sum, item) => sum + Number(item.monto || 0), 0), [form.depositos]);
  const accessoriesTotal = useMemo(() => accessories.reduce((sum, item) => sum + Number(item.total || 0), 0), [accessories]);
  const giftsTotal = useMemo(() => gifts.reduce((sum, item) => sum + Number(item.total || 0), 0), [gifts]);
  const total = useMemo(() => baseTotal - Number(form.descuentoTienda || 0) - Number(form.bonoRetoma || 0) - Number(form.descuentoNper || 0) - extraDiscountTotal + Number(form.glp || 0) + Number(form.tarjetaPlaca || 0) + Number(form.flete || 0) - Number(form.cuotaInicial || 0) + accessoriesTotal + giftsTotal, [baseTotal, form.descuentoTienda, form.bonoRetoma, form.descuentoNper, form.glp, form.tarjetaPlaca, form.flete, form.cuotaInicial, extraDiscountTotal, accessoriesTotal, giftsTotal]);
  const vinMessage = form.vinExiste ? "" : (form.cuotaInicial ? "Anticipo sin data" : "Reserva total sin data");
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
          <Field label="Tipo de Comprobante"><Input disabled={readOnly} value={form.tipoComprobante} onChange={(e) => setForm((f) => ({ ...f, tipoComprobante: e.target.value }))} /></Field>
          <Field label="Documento de Identidad"><Input value={reservation.documento} disabled /></Field>
          <Field label="Nombre Comercial"><Input value={reservation.nombreComercial} disabled /></Field>
          <Field label="Fecha Nacimiento"><Input value={String(reservation.fechaNacimiento || "").slice(0, 10)} disabled /></Field>
          <Field label="Ocupacion"><Input value={reservation.ocupacion} disabled /></Field>
          <Field label="Domicilio"><Input value={reservation.domicilio} disabled /></Field>
          <Field label="Email"><Input value={reservation.email} disabled /></Field>
          <Field label="Celular"><Input value={reservation.celular} disabled /></Field>
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
      </div>
    </section>
  );
}

function Block({ title, children }) { return <div className="border-t pt-4"><h3 className="mb-4 font-bold">{title}</h3><div className="grid gap-3 md:grid-cols-2">{children}</div></div>; }
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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function buildReservationPdf(pdf, { reservation, detail, accessories, gifts, salesBossName, createdByName, hasAutography }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  let y = 16;
  const signed = reservation.estado === "firmado";
  const accessoriesTotal = accessories.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const giftsTotal = gifts.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const depositsTotal = (detail.depositos || []).reduce((sum, item) => sum + Number(item.monto || 0), 0);

  const ensurePage = (height = 10) => {
    if (y + height <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
  };
  const line = (left, right = "") => {
    ensurePage(6);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${left}:`, margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(right || "-"), 68, y);
    y += 5;
  };
  const section = (title) => {
    ensurePage(12);
    y += 3;
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(94, 23, 235);
    pdf.text(title, margin, y);
    pdf.setTextColor(0, 0, 0);
    y += 2;
    pdf.line(margin, y, pageWidth - margin, y);
    y += 6;
  };
  const itemLines = (title, rows, referenceKey) => {
    section(title);
    if (!rows.length) {
      line("-", "-");
      return;
    }
    rows.forEach((row) => {
      const text = `${row.detalle || "-"} ${row[referenceKey] ? `(${row[referenceKey]})` : ""} | Cant: ${row.cantidad || 0} | P.Unit: ${money(row.precioUnitario)} | Desc.: ${money(row.descuentoMonto)} | Total: ${money(row.total)}`;
      ensurePage(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(pdf.splitTextToSize(text, pageWidth - margin * 2), margin, y);
      y += 8;
    });
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(94, 23, 235);
  pdf.text("Wankamotors SAC", pageWidth / 2, y, { align: "center" });
  y += 7;
  pdf.setFontSize(12);
  pdf.text("NOTA DE PEDIDO", pageWidth / 2, y, { align: "center" });
  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`Fecha: ${new Date().toLocaleDateString("es-PE")}`, pageWidth / 2, y, { align: "center" });
  y += 5;
  pdf.text(`Reserva #${reservation.id}`, pageWidth / 2, y, { align: "center" });

  section("INFORMACION DE LA RESERVA");
  line("Oportunidad", reservation.oportunidadCode);
  line("Codigo Reserva", `RES-${reservation.id}`);
  line("Estado", reservation.estado);
  line("Creado por", reservation.creadoPor);

  section("DATOS DEL CLIENTE");
  line("Nombre", reservation.cliente);
  line("Email", reservation.email);
  line("Telefono", reservation.celular);
  line("DNI/RUC", reservation.documento);
  line("Ocupacion", reservation.ocupacion);
  line("Domicilio", reservation.domicilio);
  line("Ubicacion", [reservation.distrito, reservation.provincia, reservation.departamento].filter(Boolean).join(", "));

  section("DATOS DEL VEHICULO");
  line("Marca", detail.marca);
  line("Modelo", detail.modelo);
  line("Clase", detail.clase);
  line("Version", detail.version);
  line("Anio", detail.anio);
  line("VIN", detail.vin || "-");
  line("Motor #", detail.numeroMotor || "-");
  line("Color Externo", detail.colorExterno || "-");
  line("Color Interno", detail.colorInterno || "-");
  line("Uso del Vehiculo", detail.usoVehiculo || "-");

  section("DESCUENTOS Y MONTOS");
  line("Precio Base", money(detail.precioBase));
  line("Descuento Dealer", money(detail.descuentoTienda));
  line("Bono Flota", money(detail.bonoRetoma));
  line("Descuento Retail", money(detail.descuentoNper));
  const discountBase = Number(detail.precioUnitario || detail.precioBase || 0) * Number(detail.cantidad || 1);
  (detail.descuentos || []).forEach((discount) => {
    const label = `${discount.nombre}${discount.tipo === "PORCENTAJE" ? ` (${Number(discount.valor || 0).toFixed(2)}%)` : ""}`;
    line(label, money(discountAmount(discount, discountBase)));
  });
  line("Flete", money(detail.flete));
  line("Tarjeta Placa", money(detail.tarjetaPlaca));
  line("GLP", money(detail.glp));
  line("T.C. Referencial", detail.tcReferencial || "-");
  line("Total final", money(detail.total));

  section("DEPOSITOS");
  if (detail.depositos?.length) {
    detail.depositos.forEach((deposit) => {
      ensurePage(10);
      pdf.setFont("helvetica", "normal");
      const text = [
        deposit.entidadFinanciera || "Entidad no indicada",
        deposit.numeroOperacion ? `Op: ${deposit.numeroOperacion}` : "",
        `Monto: ${money(deposit.monto)}`,
        deposit.fechaDeposito ? `Fecha: ${new Date(deposit.fechaDeposito).toLocaleString("es-PE")}` : "",
        deposit.observacion ? `Obs: ${deposit.observacion}` : "",
      ].filter(Boolean).join(" | ");
      pdf.text(pdf.splitTextToSize(text, pageWidth - margin * 2), margin, y);
      y += 8;
    });
    line("Total depositado", money(depositsTotal));
  } else {
    line("-", "-");
  }

  itemLines("ACCESORIOS", accessories, "numeroParte");
  itemLines("REGALOS", gifts, "lote");

  section("RESUMEN FINAL");
  line("Total Vehiculo", money(Number(detail.precioUnitario || detail.precioBase || 0) * Number(detail.cantidad || 1)));
  line("Total Accesorios y Regalos", money(accessoriesTotal + giftsTotal));
  line("Cuota Inicial", money(detail.cuotaInicial));
  line("TOTAL GENERAL", money(detail.total));

  ensurePage(42);
  y += 12;
  pdf.setFont("helvetica", "bold");
  pdf.text("FIRMA DEL CLIENTE:", margin, y);
  pdf.text("FIRMA ASESOR:", 78, y);
  pdf.text("FIRMA AUTORIZADO:", 140, y);
  y += 18;
  pdf.line(margin, y, 65, y);
  pdf.line(78, y, 127, y);
  pdf.line(140, y, pageWidth - margin, y);
  if (signed) {
    pdf.setFont(hasAutography ? "Autography" : "helvetica", hasAutography ? "normal" : "italic");
    pdf.setFontSize(17);
    pdf.text(createdByName || reservation.creadoPor || "Asesor", 78, y - 3);
    pdf.text(salesBossName || "Jefe de Ventas", 140, y - 3);
  }
}
