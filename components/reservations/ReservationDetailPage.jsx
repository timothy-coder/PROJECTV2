"use client";

import Image from "next/image";
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

function shortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const pad = (part) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

const isYes = (value) => String(value || "").toUpperCase() === "SI";
const isPresentValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";
const firstPresentValue = (...values) => values.find((value) => isPresentValue(value)) || "";
const RESERVATION_BRAND_LOGO_DEFAULT = "/uploads/ventas-plantillas/1778903910517-dbde795c-2743-4130-b988-fb087a3aa1ad.png";
const RESERVATION_BRAND_LOGO_FORD = "/uploads/ventas-plantillas/1778903789437-5f2f7cf4-dd3b-400f-a932-668a17fd3ad1.jpg";
const RESERVATION_OBSERVATION_TEXT =
  "Se deja constancia que si desiste de la compra y desea la devolucion, estara afecta a un % de retencion por concepto de gastos administrativos y que el motivo en materia de devolucion esta afecta a 20 dias habiles, cualquier cambio adicional que no conste en la presente no sera responsabilidad de la empresa. La entrega esta sujeta a stock, los plazos de entrega pueden sufrir variacion por posibles demoras en la entrega del vehiculo por parte de la marca, por tal caso no sera imputable al vendedor o a Wankamotors, cabe resaltar que el precio puede sufrir variacion por factores externos ajenos a Wankamotors y estipulados por la marca. Una vez emitido el mismo no se aceptara su cambio ni canje. Por tal motivo agradecemos verificar la informacion registrada, en senal de conformidad el cliente deja como constancia su firma.";

function normalizeBrandName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function reservationBrandLogoPath(marca) {
  return normalizeBrandName(marca).includes("FORD") ? RESERVATION_BRAND_LOGO_FORD : RESERVATION_BRAND_LOGO_DEFAULT;
}

export default function ReservationDetailPage({ id }) {
  const { data, loading, update } = useReservationDetail(id);
  const [carDataOpen, setCarDataOpen] = useState(false);
  const [headerObservaciones, setHeaderObservaciones] = useState(null);
  if (loading || !data) return <div className="p-4">Cargando reserva...</div>;
  const { reservation, detail, currentUser, vins, accessories, gifts, options, salesBossName, vinReleaseRequest } = data;
  const isSigned = reservation.estado === "firmado";
  const telefono2 = firstPresentValue(detail?.telefono2, detail?.telefono_2, detail?.telefono, detail?.telefonoReserva, detail?.telefono_reserva, reservation.telefono2, reservation.telefono_2);
  const displayedHeaderObservaciones = headerObservaciones ?? reservation.observaciones ?? RESERVATION_OBSERVATION_TEXT;
  const saveHeaderObservaciones = async () => {
    try {
      await update({ reservationObservaciones: displayedHeaderObservaciones });
      toast.success("Observaciones guardadas");
    } catch (error) {
      toast.error(error?.message || "No se pudo guardar observaciones");
    }
  };
  const downloadReservationPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF("p", "pt", "letter");
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
    <div className="flex min-h-screen flex-col overflow-y-auto bg-slate-50 p-4 text-slate-950 lg:h-screen lg:overflow-hidden">
      <style jsx global>{`
        @font-face { font-family: Autography; src: url('/fonts/Autography.ttf') format('truetype'); }
      `}</style>
      <div className="flex flex-1 flex-col lg:min-h-0">
        <header className="shrink-0 border-b pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link className="inline-flex size-8 items-center justify-center rounded-md border bg-white hover:bg-slate-50" href="/reservas"><ArrowLeft className="size-4" /></Link>
            <div>
              <h1 className="text-xl font-bold">Reserva #{reservation.id} <StatusBadge estado={reservation.estado} /></h1>
              <p className="text-sm text-slate-600">Oportunidad #{reservation.oportunidadCode} - Cliente: <b>{reservation.cliente}</b> - Vehiculo: <b>{detail.marca} {detail.modelo} {detail.anio}</b></p>
            </div>
          </div>
        </header>
        <div className="mt-3 grid shrink-0 gap-2 lg:grid-cols-3">
          {currentUser.reservationStatusActions?.observe ? (
            <ActionCard title="Observaciones">
              <Textarea
                disabled={isSigned}
                value={displayedHeaderObservaciones}
                onChange={(event) => setHeaderObservaciones(event.target.value)}
                className="min-h-16 resize-none rounded-md border-slate-300 bg-white p-2 text-justify text-xs leading-tight shadow-none"
              />
              {!isSigned ? (
                <div className="mt-1 flex justify-end">
                  <Button type="button" variant="outline" className="h-7 px-2 text-xs" onClick={saveHeaderObservaciones}>Guardar</Button>
                </div>
              ) : null}
            </ActionCard>
          ) : null}
          <ActionCard title="Acciones" className="lg:col-span-1">
            <div className="flex flex-col gap-1.5">
              {reservation.oportunidadId ? <Link className="inline-flex h-7 items-center gap-1 rounded-md border bg-white px-2 text-xs font-medium hover:bg-slate-50" href={`/oportunidades/${reservation.oportunidadId}`}><Eye className="size-3.5" />Ver Oportunidad</Link> : null}
              <Button variant="outline" className="h-7 px-2 text-xs" onClick={downloadReservationPdf}><Download className="size-3.5" />PDF</Button>
              {isSigned && detail?.vin ? (
                <VinReleaseControls
                  currentUser={currentUser}
                  request={vinReleaseRequest}
                  vin={detail.vin}
                  onAction={resolveVinRelease}
                />
              ) : null}
              {isSigned && detail?.vin && currentUser.canCarData ? (
                <Button className="h-7 bg-slate-950 px-2 text-xs text-white hover:bg-slate-800" onClick={() => setCarDataOpen(true)}>
                  Datos del carro
                </Button>
              ) : null}
              <ReservationStatusButtons reservation={reservation} currentUser={currentUser} update={update} />
            </div>
          </ActionCard>
        </div>
        <div className="flex-1 pr-1 lg:min-h-0 lg:overflow-y-auto">
          <div className="hidden"><ReservationPdfPreview reservation={reservation} detail={detail} accessories={accessories || []} gifts={gifts || []} telefono2={telefono2} /></div>
          <ReservationForm reservation={reservation} detail={detail} vins={vins} accessories={accessories || []} gifts={gifts || []} options={options || { accessories: [], gifts: [] }} update={update} readOnly={isSigned} />
        </div>
        {carDataOpen ? (
          <CarDataDialog
            open={carDataOpen}
            onOpenChange={setCarDataOpen}
            detail={detail}
            update={update}
          />
        ) : null}
        {false ? <Dialog open={false} onOpenChange={() => { }}>
          <DialogContent className="max-w-sm bg-white text-slate-950">
            <DialogHeader>
              <DialogTitle>Descargar PDF de reserva</DialogTitle>
              <p className="text-sm text-slate-500">¿Mostrar precio lista en el formato?</p>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">No</Button>
              <Button className="bg-slate-950 text-white hover:bg-slate-800">Si</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog> : null}
      </div>
    </div>
  );
}

function ReservationPdfPreview({ reservation, detail, accessories, gifts, telefono2 }) {
  const field = (label, value, labelClass = "") => (
    <>
      <div className={`bg-slate-100 px-1 font-bold ${labelClass}`}>{label}</div>
      <div className="px-1">{firstPresentValue(value)}</div>
    </>
  );
  const amount = (value) => (Number(value || 0) ? money(value) : "");
  const depositos = detail.depositos || [];
  const discounts = [
    ["DESCUENTO DEALER", Number(detail.descuentoTienda || 0)],
    ["BONO FLOTA", Number(detail.bonoRetoma || 0)],
    ["DESCUENTO RETAIL", Number(detail.descuentoNper || 0)],
    ...((detail.descuentos || []).map((item) => [item.nombre || "DESCUENTO ADICIONAL", discountAmount(item, Number(detail.precioUnitario || 0) * Number(detail.cantidad || 1))])),
  ];
  const precioLista = Number(detail.precioUnitario || detail.precioBase || 0);
  const usoPlaca = [detail.usoVehiculo, detail.placa].filter(isPresentValue).join(" / ");
  const conyugue = [reservation.nombreConyugue, ...(detail.copropietarios || []).map((item) => [item.nombre, item.apellido].filter(isPresentValue).join(" "))].filter(isPresentValue).join(" / ");
  const dniConyugue = [reservation.dniConyugue, ...(detail.copropietarios || []).map((item) => item.numeroDocumento)].filter(isPresentValue).join(" / ");

  return (
    <section className="mb-5 overflow-x-auto rounded-lg border bg-white p-3 shadow-sm">
      <div className="mx-auto w-[980px] border border-black bg-white px-7 py-5 font-sans text-[11px] leading-tight text-black">
        <div className="grid grid-cols-4 items-start gap-y-1">
          <Image src="/uploads/ventas-plantillas/1778903861360-27945a90-a2e4-4c59-8e71-dbb8da209848.jpg" alt="Wankamotors" width={144} height={44} className="h-11 w-36 object-contain object-left" />
          <div />
          <div />
          <Image src={reservationBrandLogoPath(detail.marca || reservation.marca)} alt="Marca" width={80} height={56} className="ml-auto h-14 w-20 object-contain object-right" />
          <div className="font-bold">Asesor</div><div className="font-bold">{reservation.creadoPor || ""}</div>
          <div className="font-bold">Fecha</div><div>{shortDate(reservation.createdAt)}</div>
          <div className="font-bold">Origen de Venta</div><div>{reservation.origenVenta || ""}</div>
          <div className="font-bold">Campaña</div><div>{reservation.campania || ""}</div>
        </div>

        <div className="mt-2 border border-black bg-slate-100 py-1 text-center font-bold">NOTA DE PEDIDO - PERSONA {detail.tipoPersona === "JURIDICA" ? "JURIDICA" : "NATURAL"}</div>

        <div className="border-x border-b border-black">
          <div className="border-b border-black bg-slate-100 px-1 font-bold">DATOS DEL CLIENTE</div>
          <div className="grid grid-cols-[165px_1fr_115px_150px]">
            {field("Tipo de comprobante", detail.tipoComprobante)}
            <div /><div />
            {field("Razón social", detail.tipoPersona === "JURIDICA" ? reservation.nombreComercial : firstPresentValue(reservation.nombreComercial, reservation.cliente))}
            <div /><div />
            {field("Cliente /Repr legal", reservation.cliente)}
            <div /><div />
            {field("DNI / RUC", reservation.documento)}
            {field("F. de nacimiento", shortDate(reservation.fechaNacimiento))}
            {field("Correo", reservation.email)}
            {field("Teléfono 1", reservation.celular)}
            {field("Ocupación", reservation.ocupacion)}
            {field("Teléfono 2", telefono2)}
            {field("Domicilio", reservation.domicilio)}
            <div /><div />
            {field("Distrito", reservation.distrito)}
            {field("Provincia", reservation.provincia)}
            {field("Departamento", reservation.departamento)}
            <div className="col-span-4 h-1" />
            {field("Cónyuge/Copropiedad", conyugue)}
            <div /><div />
            {field("DNI Cónyuge", dniConyugue)}
            <div /><div />
          </div>
        </div>

        <div className="border-x border-b border-black">
          <div className="border-b border-black bg-slate-100 px-1 font-bold">DATOS DEL VEHICULO</div>
          <div className="grid grid-cols-[120px_1fr_120px_1fr]">
            {field("Modelo", detail.modelo)}
            {field("Versión", detail.version)}
            {field("Chasis / VIN", detail.vin)}
            {field("Color", firstPresentValue(detail.colorExterno, detail.colorInterno))}
            {field("Motor", detail.numeroMotor)}
            {field("Año Modelo", detail.anio)}
            {field("Uso del vehículo / Placa", usoPlaca, "whitespace-nowrap")}
            {field("Código", detail.codigo)}
          </div>
        </div>

        <div className="border-x border-b border-black">
          <div className="border-b border-black bg-slate-100 px-1 font-bold">TRANSACCION</div>
          <div className="grid grid-cols-6">
            <div className="col-span-2 bg-slate-100 px-1 font-bold">Precio de Lista (Valor incluye IGV)</div><div className="col-span-4 text-center font-bold">{amount(precioLista)}</div>
            {discounts.slice(0, 6).map(([label, value], index) => (
              <div key={`${label}-${index}`} className="contents">
                <div className="bg-slate-100 px-1 font-bold">{label}</div><div className="text-center">{amount(value)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 pt-1">
            {field("T.C. Referencial", detail.tcReferencial ? `S/. ${detail.tcReferencial}` : "")}
            <div /><div />
            {field("Forma de Pago", detail.formaPago)}
            {field("Tipo de crédito", detail.tipoCredito)}
            {field("Banco", detail.banco)}
            {field("Origen de Fondos", detail.origenFondos)}
          </div>
          <div className="bg-slate-100 px-1 font-bold">Depósitos (Monto / Fecha / Banco / N° OP)</div>
          <div className="grid grid-cols-5">
            {[0, 1, 2, 3, 4, 5, 6].map((index) => {
              const dep = depositos[index] || {};
              return (
                <div key={index} className="contents">
                  <div className="bg-slate-100 px-1 font-bold">Monto de depósito</div>
                  <div className="text-center">{amount(dep.monto)}</div>
                  <div className="text-center">{shortDate(dep.fechaDeposito)}</div>
                  <div className="text-center">{dep.entidadFinanciera || ""}</div>
                  <div className="text-center">{dep.numeroOperacion || ""}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-x border-b border-black">
          <div className="border-b border-black bg-slate-100 px-1 font-bold">OTROS</div>
          <div className="grid grid-cols-8">
            {field("Considera GLP", detail.glpSn || "NO")}
            {field("Precio", isYes(detail.glpSn) ? amount(detail.glp) : "")}
            {field("Flete", detail.fleteSn || "NO")}
            {field("Precio", isYes(detail.fleteSn) ? amount(detail.flete) : "")}
            {field("Tarjeta y Placa", detail.tarjetaSn || "NO")}
            {field("Precio", isYes(detail.tarjetaSn) ? amount(detail.tarjetaPlaca) : "")}
            <div /><div />
          </div>
          <PdfItems title="Accesorios" rows={accessories} />
          <PdfItems title="Obsequios" rows={gifts} />
        </div>

        <div className="mt-10 grid grid-cols-3 gap-16 text-center">
          <div><div className="border-t border-black pt-1">Cliente</div></div>
          <div><div className="border-t border-black pt-1">Asesor de Ventas</div></div>
          <div><div className="border-t border-black pt-1">Jefe de Ventas</div></div>
        </div>
        <div className="mt-3 border border-black px-4 pb-3 pt-2 text-center">
          <div className="font-bold">OBSERVACIONES</div>
          <p className="mt-1 text-justify text-[10px] leading-snug">
            Se deja constancia que si desiste de la compra y desea la devolución, estará afecta a un % de retención por concepto de gastos administrativos y que el motivo en materia de devolución está afecta a 20 días hábiles, cualquier cambio adicional que no conste en la presente no será responsabilidad de la empresa. La entrega está sujeta a stock, los plazos de entrega pueden sufrir variación por posibles demoras en la entrega del vehículo por parte de la marca, por tal caso no será imputable al vendedor o a Wankamotors, cabe resaltar que el precio puede sufrir variación por factores externos ajenos a Wankamotors y estipulados por la marca. Una vez emitido el mismo no se aceptará su cambio ni canje. Por tal motivo agradecemos verificar la información registrada, en señal de conformidad el cliente deja como constancia su firma.
          </p>
        </div>
      </div>
    </section>
  );
}

function PdfItems({ title, rows }) {
  const visibleRows = [...(rows || []).slice(0, 4)];
  while (visibleRows.length < 4) visibleRows.push(null);
  return (
    <div className="mt-1">
      <div className="bg-slate-100 px-1 font-bold">{title}</div>
      <div className="grid grid-cols-[120px_1fr_120px] bg-slate-100 text-center font-bold">
        <div>Cantidad</div><div>Descripción</div><div>Precio</div>
      </div>
      <div className="grid grid-cols-[120px_1fr_120px]">
        {visibleRows.map((row, index) => (
          <div key={row?.id || index} className="contents">
            <div className="text-center">{row?.cantidad || ""}</div>
            <div className="text-center">{row?.detalle || ""}</div>
            <div className="text-center">{row ? money(row.total || row.precioUnitario || 0) : ""}</div>
          </div>
        ))}
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
      <Button className="h-7 bg-blue-600 px-2 text-xs text-white hover:bg-blue-700" onClick={() => changeStatus("enviado_firma")}>
        Enviar a firma
      </Button>
    ) : null;
  }
  if (status === "enviado_firma") {
    return (
      <>
        {actions.observe ? <Button variant="outline" className="h-7 px-2 text-xs" onClick={() => changeStatus("observado", reservation.observaciones || "Observado")}>Observar</Button> : null}
        {actions.sign ? <Button className="h-7 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700" onClick={() => changeStatus("firmado")}>Firmar</Button> : null}
      </>
    );
  }
  if (status === "observado") {
    return (
      <>
        {actions.subsanate ? <Button className="h-7 bg-blue-600 px-2 text-xs text-white hover:bg-blue-700" onClick={() => changeStatus("subsanado")}>Subsanar</Button> : null}
        {actions.sign ? <Button className="h-7 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700" onClick={() => changeStatus("firmado")}>Firmar</Button> : null}
      </>
    );
  }
  if (status === "subsanado") {
    return (
      <>
        {actions.observe ? <Button variant="outline" className="h-7 px-2 text-xs" onClick={() => changeStatus("observado", reservation.observaciones || "Observado")}>Observar</Button> : null}
        {actions.sign ? <Button className="h-7 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700" onClick={() => changeStatus("firmado")}>Firmar</Button> : null}
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
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs">
          <span className="font-semibold text-orange-800">Liberacion VIN pendiente: {vin}</span>
          <Button size="sm" className="h-7 px-2 text-xs bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onAction("approve", { requestId: request.id })}>Aprobar</Button>
          <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => onAction("reject", { requestId: request.id })}>Rechazar</Button>
        </div>
      );
    }
    if (Number(request.solicitadoPor) === Number(currentUser.id)) {
      return (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs">
          <span className="font-semibold text-orange-800">Solicitud pendiente para liberar VIN {vin}</span>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onAction("cancel", { requestId: request.id })}>Cancelar solicitud</Button>
        </div>
      );
    }
    return <span className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800">VIN {vin} con solicitud pendiente</span>;
  }

  return (
    <Button variant="outline" className="h-7 px-2 text-xs" onClick={() => onAction("request")}>
      Solicitar liberar VIN
    </Button>
  );
}

function ReservationForm({ reservation, detail, vins, accessories, gifts, options, update, readOnly }) {
  const [form, setForm] = useState({
    ...detail,
    clienteDocumento: reservation.documento || "",
    clienteRazonSocial: firstPresentValue(reservation.nombreComercial, reservation.cliente),
    clienteEmail: reservation.email || "",
    clienteOcupacion: reservation.ocupacion || "",
    clienteFechaNacimiento: reservation.fechaNacimiento ? String(reservation.fechaNacimiento).slice(0, 10) : "",
    clienteTelefono1: reservation.celular || "",
    clienteDomicilio: reservation.domicilio || "",
    clienteDistrito: reservation.distrito || "",
    clienteProvincia: reservation.provincia || "",
    clienteDepartamento: reservation.departamento || "",
    clienteConyugue: reservation.nombreConyugue || "",
    clienteDniConyugue: reservation.dniConyugue || "",
    anioModelo: detail.anio || "",
  });
  const [itemDialog, setItemDialog] = useState(null);
  const [coownerDialog, setCoownerDialog] = useState(null);
  const [saveState, setSaveState] = useState("guardado");
  const firstRender = useRef(true);
  const baseTotal = useMemo(() => Number(form.precioUnitario || 0) * Number(form.cantidad || 1), [form.precioUnitario, form.cantidad]);
  const extraDiscountTotal = useMemo(() => (form.descuentos || []).reduce((sum, item) => sum + discountAmount(item, baseTotal), 0), [form.descuentos, baseTotal]);
  const depositsTotal = useMemo(() => (form.depositos || []).reduce((sum, item) => sum + Number(item.monto || 0), 0), [form.depositos]);
  const accessoriesTotal = useMemo(() => accessories.reduce((sum, item) => sum + Number(item.total || 0), 0), [accessories]);
  const giftsTotal = useMemo(() => gifts.reduce((sum, item) => sum + Number(item.total || 0), 0), [gifts]);
  const total = useMemo(() => baseTotal - Number(form.descuentoTienda || 0) - Number(form.bonoRetoma || 0) - Number(form.descuentoNper || 0) - extraDiscountTotal + (isYes(form.glpSn) ? Number(form.glp || 0) : 0) + (isYes(form.tarjetaSn) ? Number(form.tarjetaPlaca || 0) : 0) + (isYes(form.fleteSn) ? Number(form.flete || 0) : 0) - Number(form.cuotaInicial || 0) + accessoriesTotal + giftsTotal, [baseTotal, form.descuentoTienda, form.bonoRetoma, form.descuentoNper, form.glp, form.glpSn, form.tarjetaPlaca, form.tarjetaSn, form.flete, form.fleteSn, form.cuotaInicial, extraDiscountTotal, accessoriesTotal, giftsTotal]);
  const telefono2 = firstPresentValue(form.telefono2, form.telefono_2, form.telefono, form.telefonoReserva, form.telefono_reserva, reservation.telefono2, reservation.telefono_2);
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
      <div className="m-2 flex items-center justify-between rounded-md border bg-white px-3 py-2 font-bold shadow-sm lg:sticky lg:top-0 lg:z-20">
        <span><FileText className="mr-2 inline size-4" />NOTA DE PEDIDO</span>
        <span className={`rounded-md border px-2 py-1 text-xs ${saveState === "error" ? "border-red-200 bg-red-50 text-red-600" : saveState === "guardando" ? "border-orange-200 bg-orange-50 text-orange-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{saveState === "guardando" ? "Autoguardando..." : saveState === "error" ? "Error al guardar" : "Autoguardado"}</span>
      </div>
      <EditableReservationFormat
        reservation={reservation}
        form={form}
        setForm={setForm}
        readOnly={readOnly}
        vins={vins}
        accessories={accessories}
        gifts={gifts}
        telefono2={telefono2}
        total={total}
        baseTotal={baseTotal}
        extraDiscountTotal={extraDiscountTotal}
        depositsTotal={depositsTotal}
        accessoriesTotal={accessoriesTotal}
        giftsTotal={giftsTotal}
        vinMessage={vinMessage}
        isFactura={isFactura}
        isBoleta={isBoleta}
        updateTipoComprobante={updateTipoComprobante}
        applySelectedVin={applySelectedVin}
        addDiscount={addDiscount}
        updateDiscount={updateDiscount}
        removeDiscount={removeDiscount}
        addDeposit={addDeposit}
        updateDeposit={updateDeposit}
        removeDeposit={removeDeposit}
        onAddCoowner={() => setCoownerDialog({ index: null, item: null })}
        onEditCoowner={(item, index) => setCoownerDialog({ index, item })}
        onDeleteCoowner={removeCoowner}
        onAddAccessory={() => setItemDialog({ type: "accessory", item: null })}
        onEditAccessory={(item) => setItemDialog({ type: "accessory", item })}
        onDeleteAccessory={(item) => removeQuoteItem("accessory", item)}
        onAddGift={() => setItemDialog({ type: "gift", item: null })}
        onEditGift={(item) => setItemDialog({ type: "gift", item })}
        onDeleteGift={(item) => removeQuoteItem("gift", item)}
      />
      <div className="hidden">
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
          <Field label="Telefono 2"><Input value={telefono2} disabled /></Field>
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
          <Field label="Color Externo"><Input disabled={readOnly} value={form.colorExterno || ""} onChange={(e) => setForm((f) => ({ ...f, colorExterno: e.target.value }))} /></Field>
          <Field label="Color Interno"><Input disabled={readOnly} value={form.colorInterno || ""} onChange={(e) => setForm((f) => ({ ...f, colorInterno: e.target.value }))} /></Field>
          <Field label="Numero de Motor"><Input disabled={readOnly} value={form.numeroMotor} onChange={(e) => setForm((f) => ({ ...f, numeroMotor: e.target.value }))} /></Field>
        </Block>
        <Block title="DESCUENTOS Y MONTOS">
          <Field label="Descuento Dealer ($)"><Input disabled={readOnly} type="number" value={form.descuentoTienda} onChange={(e) => setForm((f) => ({ ...f, descuentoTienda: e.target.value }))} /></Field>
          <Field label="Descuento Dealer (%)"><Input disabled={readOnly} type="number" value={form.descuentoTiendaPorcentaje} onChange={(e) => setForm((f) => ({ ...f, descuentoTiendaPorcentaje: e.target.value }))} /></Field>
          <Field label="Bono Flota"><Input disabled={readOnly} type="number" value={form.bonoRetoma} onChange={(e) => setForm((f) => ({ ...f, bonoRetoma: e.target.value }))} /></Field>
          <Field label="Descuento Retail"><Input disabled={readOnly} type="number" value={form.descuentoNper} onChange={(e) => setForm((f) => ({ ...f, descuentoNper: e.target.value }))} /></Field>
          <Field label="Cantidad"><Input disabled={readOnly} type="number" value={form.cantidad} onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))} /></Field>
          <Field label="Precio Unitario"><Input disabled={readOnly} type="number" value={form.precioUnitario} onChange={(e) => setForm((f) => ({ ...f, precioUnitario: e.target.value }))} /></Field>
          <Field label="TC Referencial"><Input disabled={readOnly} type="number" step="0.0001" value={form.tcReferencial || ""} onChange={(e) => setForm((f) => ({ ...f, tcReferencial: e.target.value }))} /></Field>
          <Field label="Forma de pago"><Input disabled={readOnly} value={form.formaPago || ""} onChange={(e) => setForm((f) => ({ ...f, formaPago: e.target.value }))} /></Field>
          <Field label="Banco"><Input disabled={readOnly} value={form.banco || ""} onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value }))} /></Field>
          <Field label="Tipo de credito"><Input disabled={readOnly} value={form.tipoCredito || ""} onChange={(e) => setForm((f) => ({ ...f, tipoCredito: e.target.value }))} /></Field>
          <Field label="GLP"><div className="grid grid-cols-[96px_1fr] gap-2"><SearchableSelect disabled={readOnly} value={form.glpSn || "NO"} options={[{ value: "NO", label: "NO" }, { value: "SI", label: "SI" }]} onChange={(value) => setForm((f) => ({ ...f, glpSn: value }))} /><Input disabled={readOnly || !isYes(form.glpSn)} type="number" value={isYes(form.glpSn) ? form.glp : ""} onChange={(e) => setForm((f) => ({ ...f, glp: e.target.value }))} /></div></Field>
          <Field label="Flete"><div className="grid grid-cols-[96px_1fr] gap-2"><SearchableSelect disabled={readOnly} value={form.fleteSn || "NO"} options={[{ value: "NO", label: "NO" }, { value: "SI", label: "SI" }]} onChange={(value) => setForm((f) => ({ ...f, fleteSn: value }))} /><Input disabled={readOnly || !isYes(form.fleteSn)} type="number" value={isYes(form.fleteSn) ? form.flete : ""} onChange={(e) => setForm((f) => ({ ...f, flete: e.target.value }))} /></div></Field>
          <Field label="Tarjeta Placa"><div className="grid grid-cols-[96px_1fr] gap-2"><SearchableSelect disabled={readOnly} value={form.tarjetaSn || "NO"} options={[{ value: "NO", label: "NO" }, { value: "SI", label: "SI" }]} onChange={(value) => setForm((f) => ({ ...f, tarjetaSn: value }))} /><Input disabled={readOnly || !isYes(form.tarjetaSn)} type="number" value={isYes(form.tarjetaSn) ? form.tarjetaPlaca : ""} onChange={(e) => setForm((f) => ({ ...f, tarjetaPlaca: e.target.value }))} /></div></Field>
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
    </section>
  );
}

function EditableReservationFormat({
  reservation,
  form,
  setForm,
  readOnly,
  vins,
  accessories,
  gifts,
  telefono2,
  total,
  baseTotal,
  extraDiscountTotal,
  depositsTotal,
  accessoriesTotal,
  giftsTotal,
  vinMessage,
  isFactura,
  isBoleta,
  updateTipoComprobante,
  applySelectedVin,
  addDiscount,
  updateDiscount,
  removeDiscount,
  addDeposit,
  updateDeposit,
  removeDeposit,
  onAddCoowner,
  onEditCoowner,
  onDeleteCoowner,
  onAddAccessory,
  onEditAccessory,
  onDeleteAccessory,
  onAddGift,
  onEditGift,
  onDeleteGift,
}) {
  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const editableInputClass = "h-5 rounded-[2px] border border-dashed border-slate-300 bg-white/80 px-1 py-0 text-[11px] shadow-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-200 disabled:border-transparent disabled:bg-transparent";
  const editableCenteredInputClass = `${editableInputClass} text-center`;
  const field = (label, child, labelClass = "") => (
    <>
      <div className={`bg-slate-100 px-1 font-bold ${labelClass}`}>{label}</div>
      <div className="min-w-0 px-1">{child}</div>
    </>
  );
  const input = (key, value, props = {}) => (
    <Input
      disabled={readOnly || props.disabled}
      type={props.type || "text"}
      step={props.step}
      value={value ?? ""}
      onChange={(event) => updateField(key, event.target.value)}
      className={editableInputClass}
    />
  );
  const textValue = (value) => <span>{firstPresentValue(value)}</span>;
  const select = (value, options, onChange) => (
    <SearchableSelect
      disabled={readOnly}
      value={value || ""}
      options={options}
      placeholder=""
      onChange={onChange}
      className={editableInputClass}
    />
  );
  const precioLista = Number(form.precioUnitario || form.precioBase || 0);
  const usoPlaca = [form.usoVehiculo, form.placa].filter(isPresentValue).join(" / ");
  const conyugue = [form.clienteConyugue, ...(form.copropietarios || []).map((item) => [item.nombre, item.apellido].filter(isPresentValue).join(" "))].filter(isPresentValue).join(" / ");
  const dniConyugue = [form.clienteDniConyugue, ...(form.copropietarios || []).map((item) => item.numeroDocumento)].filter(isPresentValue).join(" / ");
  const discounts = [
    { label: "DESCUENTO DEALER", key: "descuentoTienda", value: form.descuentoTienda },
    { label: "BONO FLOTA", key: "bonoRetoma", value: form.bonoRetoma },
    { label: "DESCUENTO RETAIL", key: "descuentoNper", value: form.descuentoNper },
  ];
  const visibleDeposits = [...(form.depositos || [])];
  while (visibleDeposits.length < 7) visibleDeposits.push(null);

  return (
    <div className="overflow-x-auto px-2 pb-4 pt-1">
      <div className="w-full min-w-[980px] border border-black bg-white px-7 py-5 font-sans text-[11px] leading-tight text-black">
        <div className="grid grid-cols-4 items-start gap-y-1">
          <Image src="/uploads/ventas-plantillas/1778903861360-27945a90-a2e4-4c59-8e71-dbb8da209848.jpg" alt="Wankamotors" width={144} height={44} className="h-11 w-36 object-contain object-left" />
          <div />
          <div />
          <Image src={reservationBrandLogoPath(form.marca || detail.marca || reservation.marca)} alt="Marca" width={80} height={56} className="ml-auto h-14 w-20 object-contain object-right" />
          <div className="font-bold">Asesor</div><div className="font-bold">{reservation.creadoPor || ""}</div>
          <div className="font-bold">Fecha</div><div>{shortDate(reservation.createdAt)}</div>
          <div className="font-bold">Origen de Venta</div><div>{reservation.origenVenta || ""}</div>
          <div className="font-bold">Campaña</div><div>{reservation.campania || ""}</div>
        </div>

        <div className="mt-2 border border-black bg-slate-100 py-1 text-center font-bold">NOTA DE PEDIDO - PERSONA {form.tipoPersona === "JURIDICA" ? "JURIDICA" : "NATURAL"}</div>

        <div className="border-x border-b border-black">
          <div className="border-b border-black bg-slate-100 px-1 font-bold">DATOS DEL CLIENTE</div>
          <div className="grid grid-cols-[150px_1fr_130px_150px]">
            {field("Tipo de comprobante", select(form.tipoComprobante, [{ value: "Boleta", label: "Boleta" }, { value: "Factura", label: "Factura" }], updateTipoComprobante))}
            {field("Tipo de persona", isFactura ? select(form.tipoPersona || "NATURAL_RUC", [{ value: "NATURAL_RUC", label: "Persona natural con RUC" }, { value: "JURIDICA", label: "Persona juridica" }], (value) => updateField("tipoPersona", value)) : textValue(isBoleta ? "Persona natural" : "Persona natural"))}
            {field("Razón social", input("clienteRazonSocial", form.clienteRazonSocial))}
            <div /><div />
            {field("Cliente /Repr legal", textValue(reservation.cliente))}
            <div /><div />
            {field("DNI / RUC", input("clienteDocumento", form.clienteDocumento))}
            {field("F. de nacimiento", input("clienteFechaNacimiento", form.clienteFechaNacimiento, { type: "date" }))}
            {field("Correo", input("clienteEmail", form.clienteEmail))}
            {field("Teléfono 1", input("clienteTelefono1", form.clienteTelefono1))}
            {field("Ocupación", input("clienteOcupacion", form.clienteOcupacion))}
            {field("Teléfono 2", textValue(telefono2))}
            {field("Domicilio", input("clienteDomicilio", form.clienteDomicilio))}
            <div /><div />
            {field("Distrito", input("clienteDistrito", form.clienteDistrito))}
            {field("Provincia", input("clienteProvincia", form.clienteProvincia))}
            {field("Departamento", input("clienteDepartamento", form.clienteDepartamento))}
            <div className="col-span-4 flex items-center justify-between bg-white py-1">
              <span />
              {!readOnly ? <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={onAddCoowner}><UserPlus className="size-3" />Agregar copropietario</Button> : null}
            </div>
            {field("Cónyuge/Copropiedad", input("clienteConyugue", conyugue))}
            <div className="px-1 text-right">{(form.copropietarios || []).map((item, index) => <button key={item.id || index} type="button" className="ml-2 text-[10px] text-blue-700" onClick={() => onEditCoowner(item, index)}>Editar</button>)}</div><div />
            {field("DNI Cónyuge", input("clienteDniConyugue", dniConyugue))}
            <div className="px-1 text-right">{(form.copropietarios || []).map((item, index) => <button key={item.id || index} type="button" className="ml-2 text-[10px] text-red-600" onClick={() => onDeleteCoowner(index)}>Quitar</button>)}</div><div />
          </div>
        </div>

        <div className="border-x border-b border-black">
          <div className="border-b border-black bg-slate-100 px-1 font-bold">DATOS DEL VEHICULO</div>
          <div className="grid grid-cols-[120px_1fr_120px_1fr]">
            {field("Modelo", textValue(form.modelo))}
            {field("Versión", textValue(form.version))}
            {field("Chasis / VIN", form.vinExiste ? select(form.vin, vins, applySelectedVin) : <span className="text-red-600">{vinMessage}</span>)}
            {field("Color", input("colorExterno", form.colorExterno))}
            {field("Motor", input("numeroMotor", form.numeroMotor))}
            {field("Año Modelo", input("anioModelo", form.anioModelo))}
            {field("Uso del vehículo / Placa", input("usoVehiculo", usoPlaca), "whitespace-nowrap")}
            {field("Código", input("codigo", form.codigo))}
            <div className="col-span-4 px-1 py-1">
              <label className="inline-flex items-center gap-2 font-bold"><Switch disabled={readOnly} checked={form.vinExiste} onCheckedChange={(checked) => setForm((old) => ({ ...old, vinExiste: checked, vin: checked ? old.vin : "", numeroMotor: checked ? old.numeroMotor : "" }))} /> VIN existe</label>
            </div>
          </div>
        </div>

        <div className="border-x border-b border-black">
          <div className="border-b border-black bg-slate-100 px-1 font-bold">TRANSACCION</div>
          <div className="grid grid-cols-6">
            <div className="col-span-2 bg-slate-100 px-1 font-bold">Precio de Lista (Valor incluye IGV)</div><div className="col-span-4 text-center font-bold">{input("precioUnitario", precioLista, { type: "number" })}</div>
            {discounts.map((discount) => (
              <div key={discount.key} className="contents">
                <div className="bg-slate-100 px-1 font-bold">{discount.label}</div><div className="text-center">{input(discount.key, discount.value, { type: "number" })}</div>
              </div>
            ))}
            {(form.descuentos || []).slice(0, 3).map((discount, index) => (
              <div key={discount.id || index} className="contents">
                <div className="bg-slate-100 px-1 font-bold">
                  <Input
                    disabled={readOnly}
                    value={discount.nombre || ""}
                    onChange={(event) => updateDiscount(index, { nombre: event.target.value })}
                    className={editableInputClass}
                  />
                </div>
                <div className="grid grid-cols-[1fr_42px_22px] items-center gap-1">
                  <Input disabled={readOnly} type="number" value={discount.valor || ""} onChange={(event) => updateDiscount(index, { valor: event.target.value })} className={editableCenteredInputClass} />
                  <button type="button" className="text-[10px] text-blue-700" onClick={() => updateDiscount(index, { tipo: String(discount.tipo || "MONTO").toUpperCase() === "MONTO" ? "PORCENTAJE" : "MONTO" })}>{String(discount.tipo || "MONTO").toUpperCase() === "MONTO" ? "$" : "%"}</button>
                  {!readOnly ? <button type="button" className="text-[10px] text-red-600" onClick={() => removeDiscount(index)}>x</button> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-black/20 py-1">
            {!readOnly ? <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={addDiscount}><Plus className="size-3" />Agregar descuento</Button> : null}
          </div>
          <div className="grid grid-cols-4 pt-1">
            {field("T.C. Referencial", input("tcReferencial", form.tcReferencial, { type: "number", step: "0.0001" }))}
            <div /><div />
            {field("Forma de Pago", input("formaPago", form.formaPago))}
            {field("Tipo de crédito", input("tipoCredito", form.tipoCredito))}
            {field("Banco", input("banco", form.banco))}
            {field("Origen de Fondos", input("origenFondos", form.origenFondos))}
          </div>
          <div className="flex items-center justify-between bg-slate-100 px-1 font-bold">
            <span>Depósitos (Monto / Fecha / Banco / N° OP)</span>
            {!readOnly ? <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px]" onClick={addDeposit}><Plus className="size-3" />Agregar</Button> : null}
          </div>
          <div className="grid grid-cols-5">
            {visibleDeposits.slice(0, 7).map((dep, index) => (
              <div key={dep?.id || index} className="contents">
                <div className="bg-slate-100 px-1 font-bold">Monto de depósito</div>
                <Input disabled={readOnly || !dep} type="number" value={dep?.monto || ""} onChange={(event) => updateDeposit(index, { monto: event.target.value })} className={editableCenteredInputClass} />
                <Input disabled={readOnly || !dep} type="date" value={dep?.fechaDeposito ? String(dep.fechaDeposito).slice(0, 10) : ""} onChange={(event) => updateDeposit(index, { fechaDeposito: event.target.value })} className={editableCenteredInputClass} />
                <Input disabled={readOnly || !dep} value={dep?.entidadFinanciera || ""} onChange={(event) => updateDeposit(index, { entidadFinanciera: event.target.value })} className={editableCenteredInputClass} />
                <div className="grid grid-cols-[1fr_18px]">
                  <Input disabled={readOnly || !dep} value={dep?.numeroOperacion || ""} onChange={(event) => updateDeposit(index, { numeroOperacion: event.target.value })} className={editableCenteredInputClass} />
                  {dep && !readOnly ? <button type="button" className="text-[10px] text-red-600" onClick={() => removeDeposit(index)}>x</button> : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-x border-b border-black">
          <div className="border-b border-black bg-slate-100 px-1 font-bold">OTROS</div>
          <div className="grid grid-cols-8">
            {field("Considera GLP", select(form.glpSn || "NO", [{ value: "NO", label: "NO" }, { value: "SI", label: "SI" }], (value) => updateField("glpSn", value)))}
            {field("Precio", input("glp", isYes(form.glpSn) ? form.glp : "", { type: "number", disabled: !isYes(form.glpSn) }))}
            {field("Flete", select(form.fleteSn || "NO", [{ value: "NO", label: "NO" }, { value: "SI", label: "SI" }], (value) => updateField("fleteSn", value)))}
            {field("Precio", input("flete", isYes(form.fleteSn) ? form.flete : "", { type: "number", disabled: !isYes(form.fleteSn) }))}
            {field("Tarjeta y Placa", select(form.tarjetaSn || "NO", [{ value: "NO", label: "NO" }, { value: "SI", label: "SI" }], (value) => updateField("tarjetaSn", value)))}
            {field("Precio", input("tarjetaPlaca", isYes(form.tarjetaSn) ? form.tarjetaPlaca : "", { type: "number", disabled: !isYes(form.tarjetaSn) }))}
            <div /><div />
          </div>
          <EditablePdfItems title="Accesorios" rows={accessories} onAdd={onAddAccessory} onEdit={onEditAccessory} onDelete={onDeleteAccessory} readOnly={readOnly} />
          <EditablePdfItems title="Obsequios" rows={gifts} onAdd={onAddGift} onEdit={onEditGift} onDelete={onDeleteGift} readOnly={readOnly} />
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2 rounded border border-blue-200 bg-blue-50 p-2 text-[11px]">
          <p><b>Vehículo:</b> {money(baseTotal)}</p>
          <p><b>Accesorios:</b> {money(accessoriesTotal)}</p>
          <p><b>Regalos:</b> {money(giftsTotal)}</p>
          <p><b>Depósitos:</b> {money(depositsTotal)}</p>
          <p><b>Descuentos adicionales:</b> -{money(extraDiscountTotal)}</p>
          <p className="col-span-3 text-right font-bold text-blue-700">TOTAL FINAL: {money(total)}</p>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-16 text-center">
          <div><div className="border-t border-black pt-1">Cliente</div></div>
          <div><div className="border-t border-black pt-1">Asesor de Ventas</div></div>
          <div><div className="border-t border-black pt-1">Jefe de Ventas</div></div>
        </div>
        <div className="mt-3 border border-black px-4 pb-3 pt-2 text-center">
          <div className="font-bold">OBSERVACIONES</div>
          <p className="mt-1 pb-1 text-justify text-[10px] leading-snug">{RESERVATION_OBSERVATION_TEXT}</p>
        </div>
      </div>
    </div>
  );
}

function EditablePdfItems({ title, rows, onAdd, onEdit, onDelete, readOnly }) {
  const visibleRows = [...(rows || []).slice(0, 4)];
  while (visibleRows.length < 4) visibleRows.push(null);
  return (
    <div className="mt-1">
      <div className="flex items-center justify-between bg-slate-100 px-1 font-bold">
        <span>{title}</span>
        {!readOnly ? <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px]" onClick={onAdd}><Plus className="size-3" />Agregar</Button> : null}
      </div>
      <div className="grid grid-cols-[120px_1fr_120px_70px] bg-slate-100 text-center font-bold">
        <div>Cantidad</div><div>Descripción</div><div>Precio</div><div />
      </div>
      <div className="grid grid-cols-[120px_1fr_120px_70px]">
        {visibleRows.map((row, index) => (
          <div key={row?.id || index} className="contents">
            <div className="text-center">{row?.cantidad || ""}</div>
            <div className="text-center">{row?.detalle || ""}</div>
            <div className="text-center">{row ? money(row.total || row.precioUnitario || 0) : ""}</div>
            <div className="text-center">
              {row && !readOnly ? (
                <>
                  <button type="button" className="mr-2 text-[10px] text-blue-700" onClick={() => onEdit(row)}>Editar</button>
                  <button type="button" className="text-[10px] text-red-600" onClick={() => onDelete(row)}>Quitar</button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
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
function InfoCard({ title, lines }) {
  return (
    <div className="rounded-md border bg-white p-3 text-xs leading-tight tracking-normal shadow-sm">
      <p className="mb-2 font-semibold text-slate-700">{title}</p>
      {lines.map((line, index) => (
        <p key={index} className={index === 0 ? "truncate font-bold" : "truncate text-[11px] text-slate-600"}>{line || "-"}</p>
      ))}
    </div>
  );
}
function ActionCard({ title, children, className = "lg:col-span-2" }) {
  return (
    <div className={`rounded-md border bg-white p-3 text-xs leading-tight tracking-normal shadow-sm ${className}`}>
      <p className="mb-2 font-semibold text-slate-700">{title}</p>
      {children}
    </div>
  );
}
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

async function buildReservationPdf(pdf, { reservation, detail, accessories, gifts, salesBossName, createdByName, hasAutography, template, showPriceList = true }) {
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
    pdf.setFontSize(size * 0.92);
  };

  const rect = (x, y, w, h, fill = null) => {
    if (fill) {
      pdf.setFillColor(...fill);
      pdf.rect(x, y, w, h, "F");
    }
    pdf.setDrawColor(...lineColor);
    pdf.rect(x, y, w, h);
  };

  const text = (t, x, y, opts = {}) => pdf.text(String(t ?? ""), x, y, opts);
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
  const obsH = 22;     // alto observaciones (para que entre el texto legal)
  const signH = 24;    // alto firmas
  const serviceRowH = 4.1;
  const serviceH = serviceRowH * 10;
  const extrasH = 0;
  const footerGap = 2;
  const contentBottom = bottom - (obsH + signH + serviceH + extrasH + footerGap);

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

  const cliente = r.cliente || [r.nombre, r.apellido].filter(Boolean).join(" ") || "";
  const copropietarios = Array.isArray(r.copropietarios) ? r.copropietarios : [];
  const isPresent = (value) => {
    const textValue = String(value ?? "").trim();
    return textValue && textValue !== "-";
  };
  const nombreConyugue = r.nombreConyugue || r.nombreconyugue || r.conyugue || "";
  const dniConyugue = r.dniConyugue || r.dniconyugue || "";
  const copropietariosNombres = copropietarios
    .map((item) => [item.nombre, item.apellido].filter(Boolean).join(" ") || item.nombreComercial || "")
    .filter(isPresent);
  const copropietariosDocumentos = copropietarios
    .map((item) => item.numeroDocumento || item.documento || item.identificacionFiscal || "")
    .filter(isPresent);
  const conyugue = [nombreConyugue, ...copropietariosNombres].filter(isPresent).join(" / ") || "";
  const documento = r.documento || r.identificacion_fiscal || "";
  const documentoConyugue = [dniConyugue, ...copropietariosDocumentos].filter(isPresent).join(" / ") || "";

  const email = r.email || "";
  const celular = r.celular || "";
  const fechaNacimiento = formatDate(r.fechaNacimiento || r.fecha_nacimiento);
  const ocupacion = r.ocupacion || "";
  const domicilio = r.domicilio || "";

  const distrito = r.distrito || "";
  const provincia = r.provincia || "";
  const region = r.departamento || r.region || "";

  const asesor = createdByName || r.creadoPor || r.creado_por || "";
  const fechaDoc = formatDate(r.createdAt || r.created_at || r.fecha || new Date());
  const origenVenta = r.origenVenta || r.origen_venta || "";
  const campania = r.campania || "";
  const idTexto = r.idLead || r.id_lead || r.leadId || "";

  const tipoComprobante = r.tipoComprobante || r.tipo_comprobante || d.tipoComprobante || "";
  const tipoPersona = r.tipoPersona || r.tipo_persona || d.tipoPersona || "NATURAL";
  const nombreComercial = r.nombreComercial || r.nombre_comercial || d.nombreComercial || d.nombre_comercial || "";
  const personTitle = tipoPersona === "JURIDICA"
    ? "NOTA DE PEDIDO - PERSONA JURIDICA"
    : tipoPersona === "NATURAL_RUC"
      ? "NOTA DE PEDIDO - PERSONA NATURAL CON RUC"
      : "NOTA DE PEDIDO - PERSONA NATURAL";

  // Vehículo (reservation con fallback a detail/form)
  const marca = r.marca || d.marca || "";
  const modelo = r.modelo || d.modelo || "";
  const clase = r.clase || d.clase || "";
  const version = r.version || d.version || "";
  const anio = r.anio || d.anio || "";
  const vin = r.vin || d.vin || "";
  const color = r.color || r.colorExterno || d.colorExterno || "";
  const motor = r.numeroMotor || r.motor || d.numeroMotor || "";
  const codigoUnidad = r.codigoUnidad || r.codigo_unidad || r.codigo || d.codigo || "";

  // Montos (reservation con fallback a detail)
  const precioLista =
    d.precioUnitario ??
    d.precio_unitario ??
    r.precioLista ??
    r.precio_lista ??
    r.precioBase ??
    r.precio_base ??
    d.precioBase ??
    0;

  const totalFinal =
    r.total ??
    r.total_final ??
    r.totalFinal ??
    d.total ??
    0;
  const tcReferencial = r.tcReferencial || r.tc_referencial || d.tcReferencial || d.tc_referencial || "";
  // Depósitos (reservation.depositos con fallback a detail.depositos)
  const depositos = Array.isArray(r.depositos) ? r.depositos : (Array.isArray(d.depositos) ? d.depositos : []);
  const discountBase = Number(d.precioUnitario || d.precio_unitario || precioLista || 0) * Number(d.cantidad || 1);
  const dealerPercent = Number(d.descuentoTiendaPorcentaje || d.dsctotiendaporcentaje || 0);
  const dealerAmount = dealerPercent > 0
    ? (discountBase * dealerPercent) / 100
    : Number(d.descuentoTienda || d.dsctotienda || 0);
  const discountRows = [
    { label: "DESCUENTO DEALER", value: dealerAmount },
    { label: "BONO FLOTA", value: d.bonoRetoma || d.dsctobonoretoma },
    { label: "DESCUENTO RETAIL", value: d.descuentoNper || d.dsctonper },
    ...(Array.isArray(d.descuentos) ? d.descuentos.map((item) => ({
      label: item.nombre || "DESCUENTO ADICIONAL",
      value: discountAmount(item, discountBase),
    })) : []),
  ];

  const signed = r.estado === "firmado";

  {
    await drawTemplateWatermark();

    const x = 42;
    const w = 528;
    const gray = [238, 238, 238];
    const firstValue = (...values) => values.find((value) => isPresent(value)) || "";
    const amountText = (value) => (Number(value || 0) ? money(value) : "");
    const razonSocial = tipoPersona === "JURIDICA"
      ? nombreComercial
      : firstValue(r.razonSocial, r.razon_social, nombreComercial);
    const usoPlaca = [firstValue(d.usoVehiculo, d.usovehiculo, r.usoVehiculo, r.usovehiculo), firstValue(d.placa, r.placa)]
      .filter(isPresent)
      .join(" / ") || "";
    const origenFondos = firstValue(r.origenFondos, r.origen_fondos, d.origenFondos, d.origen_fondos);
    const banco = firstValue(d.banco, r.banco, depositos[0]?.entidadFinanciera, depositos[0]?.banco);
    const telefono2 = firstValue(d.telefono2, d.telefono_2, d.telefono, d.telefonoReserva, d.telefono_reserva, r.telefono2, r.telefono_2);
    const showGlp = isYes(d.glpSn || d.glp_sn);
    const showFlete = isYes(d.fleteSn || d.flete_sn);
    const showTarjeta = isYes(d.tarjetaSn || d.tarjeta_sn);

    const put = (value, tx, ty, opts = {}) => {
      setFont(opts.bold ? "bold" : "normal", opts.size || 7);
      text(clip(value, opts.max || 50), tx, ty, opts.align ? { align: opts.align } : {});
    };
    const label = (value, tx, ty, tw = 74) => {
      pdf.setFillColor(...gray);
      pdf.rect(tx - 1, ty - 7.2, tw, 9, "F");
      put(value, tx, ty, { bold: true, size: 7, max: Math.max(12, Math.floor(tw / 3.2)) });
    };
    const box = (ty, th) => rect(x, ty, w, th);
    const outlineBox = (ty, th) => {
      pdf.setDrawColor(...lineColor);
      pdf.rect(x, ty, w, th);
    };
    const hLine = (ty) => pdf.line(x, ty, x + w, ty);
    const section = (value, ty) => {
      pdf.setFillColor(...gray);
      pdf.rect(x, ty, w, 10, "F");
      pdf.setDrawColor(...lineColor);
      pdf.rect(x, ty, w, 10);
      put(value, x + 2, ty + 7.6, { bold: true, size: 7, max: 45 });
    };

    pdf.setDrawColor(...lineColor);
    pdf.setLineWidth(0.55);
    const drawDirectLogo = async (path, lx, ly, lw, lh) => {
      const dataUrl = await imageToDataUrl(path);
      if (dataUrl) pdf.addImage(dataUrl, undefined, lx, ly, lw, lh);
    };
    await drawDirectLogo(
      "/uploads/ventas-plantillas/1778903861360-27945a90-a2e4-4c59-8e71-dbb8da209848.jpg",
      x + 1,
      28,
      122,
      35,
    );
    await drawDirectLogo(
      reservationBrandLogoPath(marca),
      x + w - 72,
      20,
      69,
      52,
    );

    const headerCol = w / 4;
    put("Asesor", x + 2, 76, { bold: true, size: 7, max: 10 });
    put(asesor, x + headerCol, 76, { bold: true, size: 7, max: 34 });
    put("Fecha", x + (headerCol * 2), 76, { bold: true, size: 7, max: 10 });
    put(fechaDoc, x + (headerCol * 3), 76, { size: 7, max: 14 });
    put("Origen de Venta", x + 2, 86, { bold: true, size: 7, max: 24 });
    put(origenVenta, x + headerCol, 86, { size: 7, max: 24 });
    put("ID", x + (headerCol * 1.5), 86, { bold: true, size: 7, max: 6 });
    put(idTexto, x + (headerCol * 1.7), 86, { size: 7, max: 16 });
    put("Campaña", x + (headerCol * 2), 86, { bold: true, size: 7, max: 16 });
    put(campania, x + (headerCol * 3), 86, { size: 7, max: 24 });

    pdf.setFillColor(...gray);
    pdf.rect(x, 89, w, 10, "F");
    pdf.setDrawColor(...lineColor);
    pdf.rect(x, 89, w, 10);
    put(personTitle, x + w / 2, 96.5, { bold: true, size: 7.2, align: "center", max: 80 });

    box(101, 103);
    section("DATOS DEL CLIENTE", 101);
    let y = 119;
    label("Tipo de comprobante", x + 2, y, 104); put(tipoComprobante, x + 111, y, { size: 7, max: 35 });
    y += 9;
    label("Razón social", x + 2, y, 104); put(razonSocial, x + 111, y, { size: 7, max: 58 });
    y += 9;
    label("Cliente /Repr legal", x + 2, y, 104); put(cliente, x + 111, y, { size: 7, max: 58 });
    y += 9;
    label("DNI / RUC", x + 2, y, 104); put(documento, x + 111, y, { size: 7, max: 22 });
    label("F. de nacimiento", x + 338, y, 96); put(fechaNacimiento, x + 438, y, { size: 7, max: 14 });
    y += 9;
    label("Correo", x + 2, y, 104); put(email, x + 111, y, { size: 7, max: 58 });
    label("Teléfono 1", x + 338, y, 96); put(celular, x + 438, y, { size: 7, max: 14 });
    y += 9;
    label("Ocupación", x + 2, y, 104); put(ocupacion, x + 111, y, { size: 7, max: 35 });
    label("Teléfono 2", x + 338, y, 96); put(telefono2, x + 438, y, { size: 7, max: 14 });
    y += 9;
    label("Domicilio", x + 2, y, 104); put(domicilio, x + 111, y, { size: 7, max: 70 });
    y += 9;
    label("Distrito", x + 2, y, 104); put(distrito, x + 111, y, { size: 7, max: 24 });
    label("Provincia", x + 224, y, 72); put(provincia, x + 300, y, { size: 7, max: 24 });
    label("Departamento", x + 373, y, 86); put(region, x + 463, y, { size: 7, max: 16 });
    y += 10;
    label("Cónyuge/Copropiedad", x + 2, y, 104); put(conyugue, x + 111, y, { size: 7, max: 42 });
    y += 9;
    label("DNI Cónyuge", x + 2, y, 104); put(documentoConyugue, x + 111, y, { size: 7, max: 24 });

    outlineBox(101, 103);

    box(205, 46.5);
    section("DATOS DEL VEHICULO", 205);
    y = 222.7;
    label("Modelo", x + 2, y, 74); put(modelo, x + 78, y, { size: 7, max: 28 });
    label("Versión", x + 196, y, 78); put(version, x + 282, y, { size: 7, max: 36 });
    y += 9;
    label("Chasis / VIN", x + 2, y, 74); put(vin, x + 78, y, { size: 7, max: 28 });
    label("Color", x + 196, y, 78); put(color, x + 282, y, { size: 7, max: 22 });
    y += 9;
    label("Motor", x + 2, y, 74); put(motor, x + 78, y, { size: 7, max: 28 });
    label("Año Modelo", x + 196, y, 78); put(anio, x + 282, y, { size: 7, max: 12 });
    y += 9;
    label("Uso del vehículo / Placa", x + 2, y, 104); put(usoPlaca, x + 111, y, { size: 7, max: 28 });
    label("Código", x + 196, y, 78); put(codigoUnidad, x + 282, y, { size: 7, max: 22 });

    outlineBox(205, 46.5);

    box(253, 151);
    section("TRANSACCION", 253);
    const col6 = w / 6;
    const col5 = w / 5;
    const col4 = w / 4;
    const col8 = w / 8;
    const putCentered = (value, tx, ty, tw, opts = {}) => {
      put(value, tx + (tw / 2), ty, { ...opts, align: "center" });
    };
    const discountLabel = (index) => discountRows[index]?.label || "";
    y = 270.7;
    label("Precio de Lista (Valor incluye IGV)", x + 2, y, 214); put(money(d.precioUnitario || d.precio_unitario || precioLista), x + 373, y, { bold: true, size: 7.2, max: 18 });
    y += 9;
    label(discountLabel(0), x + 2, y, col6 - 2); putCentered(amountText(discountRows[0]?.value), x + col6, y, col6, { size: 7, max: 14 });
    label(discountLabel(2), x + (col6 * 2) + 1, y, col6 - 2); putCentered(amountText(discountRows[2]?.value), x + (col6 * 3), y, col6, { size: 7, max: 14 });
    label(discountLabel(4), x + (col6 * 4) + 1, y, col6 - 2); putCentered(amountText(discountRows[4]?.value), x + (col6 * 5), y, col6, { size: 7, max: 14 });
    y += 9;
    label(discountLabel(1), x + 2, y, col6 - 2); putCentered(amountText(discountRows[1]?.value), x + col6, y, col6, { size: 7, max: 14 });
    label(discountLabel(3), x + (col6 * 2) + 1, y, col6 - 2); putCentered(amountText(discountRows[3]?.value), x + (col6 * 3), y, col6, { size: 7, max: 14 });
    label(discountLabel(5), x + (col6 * 4) + 1, y, col6 - 2); putCentered(amountText(discountRows[5]?.value), x + (col6 * 5), y, col6, { size: 7, max: 14 });
    y += 9;
    label("Precio Final (Valor incluye IGV)", x + 2, y, 196); put(money(totalFinal), x + 373, y, { bold: true, size: 7.2, max: 18 });
    y += 9;
    label("T.C. Referencial", x + 2, y, 86); put(tcReferencial ? `S/. ${tcReferencial}` : "", x + 111, y, { size: 7, max: 14 });
    y += 12;
    label("Forma de Pago", x + 2, y, col4 - 2); putCentered(d.formaPago || d.forma_pago || r.formaPago || "", x + col4, y, col4, { size: 7, max: 24 });
    label("Tipo de crédito", x + (col4 * 2) + 1, y, col4 - 2); putCentered(d.tipoCredito || d.tipo_credito || r.tipoCredito || "", x + (col4 * 3), y, col4, { size: 7, max: 24 });
    y += 9;
    label("Banco", x + 2, y, col4 - 2); putCentered(banco, x + col4, y, col4, { size: 7, max: 24 });
    label("Origen de Fondos", x + (col4 * 2) + 1, y, col4 - 2); putCentered(origenFondos || "", x + (col4 * 3), y, col4, { size: 7, max: 24 });
    y += 12;
    label("Depósitos (Monto / Fecha / Banco / N° OP)", x + 2, y, 218);
    y += 9;
    [0, 1, 2, 3, 4, 5, 6].forEach((index) => {
      const dep = depositos[index];
      label("Monto de depósito", x + 2, y, col5 - 2);
      putCentered(dep ? money(dep.monto || dep.importe || 0) : "", x + col5, y, col5, { size: 7, max: 16 });
      putCentered(dep ? formatDate(dep.fechaOperacion || dep.fecha || dep.createdAt) : "", x + (col5 * 2), y, col5, { size: 7, max: 14 });
      putCentered(firstValue(dep?.entidadFinanciera, dep?.banco), x + (col5 * 3), y, col5, { size: 7, max: 22 });
      putCentered(firstValue(dep?.numeroOperacion, dep?.operacion, dep?.op), x + (col5 * 4), y, col5, { size: 7, max: 18 });
      y += 9;
    });

    outlineBox(253, 151);

    box(405, 184);
    section("OTROS", 405);
    y = 426;
    label("Considera GLP", x + 2, y, col8 - 2); putCentered(showGlp ? "SI" : "NO", x + col8, y, col8, { size: 7, max: 4 });
    label("Precio", x + (col8 * 2) + 1, y, col8 - 2); putCentered(showGlp ? amountText(d.glp) : "", x + (col8 * 3), y, col8, { size: 7, max: 14 });
    label("Flete", x + (col8 * 4) + 1, y, col8 - 2); putCentered(showFlete ? "SI" : "NO", x + (col8 * 5), y, col8, { size: 7, max: 4 });
    label("Precio", x + (col8 * 6) + 1, y, col8 - 2); putCentered(showFlete ? amountText(d.flete) : "", x + (col8 * 7), y, col8, { size: 7, max: 14 });
    y += 9;
    label("Tarjeta y Placa", x + 2, y, col8 - 2); putCentered(showTarjeta ? "SI" : "NO", x + col8, y, col8, { size: 7, max: 4 });
    label("Precio", x + (col8 * 2) + 1, y, col8 - 2); putCentered(showTarjeta ? amountText(d.tarjetaPlaca || d.tarjetaplaca) : "", x + (col8 * 3), y, col8, { size: 7, max: 14 });

    y = 443;
    label("Accesorios", x + 2, y, 74);
    pdf.setFillColor(...gray);
    pdf.rect(x, y + 4, w, 12, "F");
    put("Cantidad", x + 26, y + 13, { bold: true, size: 6.6, max: 16 });
    put("Descripción", x + 260, y + 13, { bold: true, size: 6.6, max: 22 });
    put("Precio", x + w - 62, y + 13, { bold: true, size: 6.6, max: 14 });
    (accessories || []).slice(0, 4).forEach((item, index) => {
      const rowY = y + 26 + (index * 9);
      put(item.cantidad || "1", x + 32, rowY, { size: 7, max: 8 });
      put(firstValue(item.descripcion, item.detalle, item.detalleAccesorio, item.nombreAccesorio, item.nombre, item.numeroParte, item.numero_parte, item.notas), x + 155, rowY, { size: 7, max: 44 });
      put(money(item.precio || item.monto || item.total || item.precioUnitario || item.precio_unitario || 0), x + w - 72, rowY, { size: 7, max: 16 });
    });
    hLine(509);
    y = 519;
    label("Obsequios", x + 2, y, 74);
    pdf.setFillColor(...gray);
    pdf.rect(x, y + 4, w, 12, "F");
    put("Cantidad", x + 26, y + 13, { bold: true, size: 6.6, max: 16 });
    put("Descripción", x + 260, y + 13, { bold: true, size: 6.6, max: 22 });
    put("Precio", x + w - 62, y + 13, { bold: true, size: 6.6, max: 14 });
    (gifts || []).slice(0, 4).forEach((item, index) => {
      const rowY = y + 26 + (index * 9);
      put(item.cantidad || "1", x + 32, rowY, { size: 7, max: 8 });
      put(firstValue(item.descripcion, item.detalle, item.detalleRegalo, item.nombreRegalo, item.nombre, item.lote, item.notas), x + 155, rowY, { size: 7, max: 44 });
      put(amountText(item.precio || item.monto || item.total || item.precioUnitario || item.precio_unitario), x + w - 72, rowY, { size: 7, max: 16 });
    });
    outlineBox(405, 184);

    const signatureY = 650;
    [["Cliente", x + 92], ["Asesor de Ventas", x + w / 2], ["Jefe de Ventas", x + w - 92]].forEach(([value, center]) => {
      setFont("normal", 8);
      text("____________________________", center - 68, signatureY);
      put(value, center, signatureY + 12, { size: 7, align: "center", max: 24 });
    });
    if (signed) {
      pdf.setFont(hasAutography ? "Autography" : "helvetica", hasAutography ? "normal" : "italic");
      pdf.setFontSize(hasAutography ? 24 : 13);
      if (asesor) {
        pdf.text(asesor, x + w / 2, signatureY - 7, { align: "center", maxWidth: 135 });
      }
      if (salesBossName) {
        pdf.text(salesBossName, x + w - 92, signatureY - 7, { align: "center", maxWidth: 135 });
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
    }

    const obsY = 674;
    box(obsY, 36);
    pdf.setFillColor(...gray);
    pdf.rect(x + 1, obsY + 2, w - 2, 9, "F");
    put("OBSERVACIONES", x + w / 2, obsY + 9, { bold: true, size: 6.4, align: "center", max: 26 });
    setFont("normal", 5.2);
    const observationText = "Se deja constancia que si desiste de la compra y desea la devolución, estará afecta a un % de retención por concepto de gastos administrativos y que el motivo en materia de devolución está afecta a 20 días hábiles, cualquier cambio adicional que no conste en la presente no será responsabilidad de la empresa. La emtrega está sujeta a stock, los plazos de entrega pueden sufrir variación por posibles demoras en la entrega del vehículo por parte de la marca, por tal caso no será imputable al vendedor o a Wankamotors, cabe resaltar que el precio puede sufrir variación por factores externos ajenos a Wankamotors y estipulados por la marca. Una vez emitido el mismo no se aceptará su cambio ni canje. Por tal motivo agradecemos verificar la información registrada, en señal de conformidad el cliente deja como constancia su firma.";
    const observationLines = pdf.splitTextToSize(observationText, w - 16);
    pdf.text(observationLines.slice(0, 6), x + 8, obsY + 17, { align: "justify", lineHeightFactor: 1.08, maxWidth: w - 16 });
    outlineBox(obsY, 36);
    return;
  }

  {
    await drawTemplateWatermark();

    const formX = 43.46;
    const formW = 510.43;
    const rowH = 9.96;
    const yTop = (bottomPx, h = rowH) => pageH - bottomPx - h;
    const yText = (bottomPx) => pageH - bottomPx - 2.2;
    const rowFill = [242, 242, 242];
    const sectionFill = [228, 228, 228];
    const firstTruthy = (...values) => values.find((value) => isPresent(value)) || "";
    const amountOrBlank = (value) => (Number(value || 0) ? money(value) : "");
    const usoPlaca = [d.usoVehiculo || d.usovehiculo || r.usoVehiculo || r.usovehiculo, d.placa || r.placa]
      .filter(isPresent)
      .join(" / ") || "-";
    const origenFondos = firstTruthy(r.origenFondos, r.origen_fondos, d.origenFondos, d.origen_fondos);
    const banco = depositos[0]?.entidadFinanciera || depositos[0]?.banco || "";

    const put = (value, x, y, opts = {}) => {
      setFont(opts.bold ? "bold" : "normal", opts.size || 8.1);
      text(clip(value, opts.max || 55), x, y, opts.align ? { align: opts.align } : {});
    };
    const putLabel = (value, x, y, max = 34) => put(value, x, y, { bold: true, size: 8, max });
    const rowBox = (bottomPx, fill = null) => rect(formX, yTop(bottomPx), formW, rowH, fill);
    const section = (value, bottomPx) => {
      rowBox(bottomPx, sectionFill);
      put(value, formX + formW / 2, yText(bottomPx), { bold: true, size: 8.6, align: "center", max: 80 });
    };

    pdf.setDrawColor(...lineColor);
    pdf.setLineWidth(0.45);
    pdf.rect(0, 0, pageW, pageH);
    await drawTemplateElements(getTemplateSection("ENCABEZADO"), formX, 18, formW, 54);

    rowBox(695.5);
    putLabel("Asesor", formX + 2, yText(695.5), 12);
    put(asesor, formX + 54, yText(695.5), { bold: true, size: 9, max: 38 });
    putLabel("Fecha", formX + 360, yText(695.5), 12);
    put(fechaDoc, formX + 403, yText(695.5), { bold: true, size: 8.7, max: 14 });

    rowBox(685.54);
    putLabel("Origen de Venta", formX + 2, yText(685.54), 26);
    put(origenVenta, formX + 116, yText(685.54), { bold: true, max: 24 });
    putLabel("ID", formX + 200, yText(685.54), 6);
    put(idTexto, formX + 230, yText(685.54), { bold: true, max: 24 });
    putLabel("Campaña", formX + 360, yText(685.54), 18);
    put(campania, formX + 420, yText(685.54), { max: 20 });

    section(personTitle, 672.1);
    section("DATOS DEL CLIENTE", 659.14);

    rowBox(649.66);
    putLabel("Tipo de comprobante", formX + 2, yText(649.66), 30);
    put(tipoComprobante, formX + 177, yText(649.66), { bold: true, max: 35 });

    rowBox(639.7);
    putLabel("Razón social", formX + 2, yText(639.7), 22);
    put(tipoPersona === "JURIDICA" ? nombreComercial : r.razonSocial || r.razon_social || nombreComercial, formX + 113, yText(639.7), { bold: true, max: 55 });

    rowBox(629.74);
    putLabel("Cliente /Repr legal", formX + 2, yText(629.74), 30);
    put(cliente, formX + 51, yText(629.74), { bold: true, max: 55 });

    rowBox(619.78);
    putLabel("DNI / RUC", formX + 2, yText(619.78), 16);
    put(documento, formX + 113, yText(619.78), { bold: true, max: 18 });
    putLabel("F. de nacimiento", formX + 272, yText(619.78), 26);
    put(fechaNacimiento, formX + 396, yText(619.78), { bold: true, max: 14 });

    rowBox(609.82);
    putLabel("Correo", formX + 2, yText(609.82), 14);
    put(email, formX + 113, yText(609.82), { bold: true, max: 45 });
    putLabel("Teléfono 1", formX + 396, yText(609.82), 18);
    put(celular, formX + 463, yText(609.82), { bold: true, max: 14 });

    rowBox(599.86);
    putLabel("Ocupación", formX + 2, yText(599.86), 18);
    put(ocupacion, formX + 113, yText(599.86), { bold: true, max: 35 });
    putLabel("Teléfono 2", formX + 396, yText(599.86), 18);
    put(r.telefono2 || "-", formX + 463, yText(599.86), { bold: true, max: 14 });

    rowBox(589.87);
    putLabel("Domicilio", formX + 2, yText(589.87), 16);
    put(domicilio, formX + 113, yText(589.87), { bold: true, max: 75 });

    rowBox(579.91);
    putLabel("Distrito", formX + 2, yText(579.91), 14);
    put(distrito, formX + 113, yText(579.91), { bold: true, max: 24 });
    putLabel("Provincia", formX + 272, yText(579.91), 18);
    put(provincia, formX + 336, yText(579.91), { bold: true, max: 20 });
    putLabel("Departamento", formX + 396, yText(579.91), 25);
    put(region, formX + 470, yText(579.91), { bold: true, max: 14 });

    rowBox(566.95);
    putLabel("Cónyuge/Copropiedad", formX + 2, yText(566.95), 34);
    put(conyugue, formX + 177, yText(566.95), { bold: true, max: 48 });

    rowBox(556.99);
    putLabel("DNI Cónyuge", formX + 2, yText(556.99), 22);
    put(documentoConyugue, formX + 113, yText(556.99), { bold: true, max: 28 });

    section("DATOS DEL VEHÍCULO", 543.55);

    rowBox(534.07);
    putLabel("Modelo", formX + 2, yText(534.07), 14);
    put(modelo, formX + 113, yText(534.07), { bold: true, max: 24 });
    putLabel("Versión", formX + 272, yText(534.07), 14);
    put(version, formX + 336, yText(534.07), { bold: true, max: 28 });

    rowBox(524.11);
    putLabel("Chasis / VIN", formX + 2, yText(524.11), 22);
    put(vin, formX + 113, yText(524.11), { bold: true, max: 28 });
    putLabel("Color", formX + 272, yText(524.11), 12);
    put(color, formX + 396, yText(524.11), { bold: true, max: 20 });

    rowBox(514.15);
    putLabel("Motor", formX + 2, yText(514.15), 12);
    put(motor, formX + 113, yText(514.15), { bold: true, max: 24 });
    putLabel("Año Modelo", formX + 396, yText(514.15), 22);
    put(anio, formX + 470, yText(514.15), { bold: true, max: 8 });

    rowBox(504.19);
    putLabel("Uso del vehículo / Placa", formX + 2, yText(504.19), 38);
    put(usoPlaca, formX + 177, yText(504.19), { bold: true, max: 30 });
    putLabel("Código", formX + 396, yText(504.19), 14);
    put(codigoUnidad, formX + 470, yText(504.19), { bold: true, max: 16 });

    section("TRANSACCIÓN", 490.75);

    rowBox(481.27);
    putLabel("Precio de Lista (Valor incluye IGV)", formX + 2, yText(481.27), 52);
    put(showPriceList ? money(precioLista) : "-", formX + 360, yText(481.27), { bold: true, max: 18 });

    rowBox(471.31);
    putLabel("Descuento A", formX + 2, yText(471.31), 20);
    put(amountOrBlank(discountRows[0]?.value), formX + 113, yText(471.31), { bold: true, max: 14 });
    putLabel("Descuento C", formX + 177, yText(471.31), 20);
    put(amountOrBlank(discountRows[2]?.value), formX + 272, yText(471.31), { bold: true, max: 14 });
    putLabel("Descuento E", formX + 336, yText(471.31), 20);
    put(amountOrBlank(discountRows[4]?.value), formX + 430, yText(471.31), { bold: true, max: 14 });

    rowBox(461.35);
    putLabel("Descuento B", formX + 2, yText(461.35), 20);
    put(amountOrBlank(discountRows[1]?.value), formX + 113, yText(461.35), { bold: true, max: 14 });
    putLabel("Descuento D", formX + 177, yText(461.35), 20);
    put(amountOrBlank(discountRows[3]?.value), formX + 272, yText(461.35), { bold: true, max: 14 });
    putLabel("Descuento F", formX + 336, yText(461.35), 20);
    put(amountOrBlank(discountRows[5]?.value), formX + 430, yText(461.35), { bold: true, max: 14 });

    rowBox(451.39);
    putLabel("Precio Final (Valor incluye IGV)", formX + 2, yText(451.39), 52);
    put(money(totalFinal), formX + 360, yText(451.39), { bold: true, max: 18 });

    rowBox(441.43);
    putLabel("T.C. Referencial", formX + 2, yText(441.43), 28);
    put(tcReferencial ? `S/. ${tcReferencial}` : "-", formX + 113, yText(441.43), { bold: true, max: 14 });

    rowBox(428.45);
    putLabel("Forma de Pago", formX + 2, yText(428.45), 25);
    put(r.formaPago || d.formaPago || "-", formX + 113, yText(428.45), { bold: true, max: 24 });
    putLabel("Tipo de crédito", formX + 272, yText(428.45), 25);
    put(r.tipoCredito || d.tipoCredito || "-", formX + 396, yText(428.45), { bold: true, max: 20 });

    rowBox(418.49);
    putLabel("Banco", formX + 2, yText(418.49), 12);
    put(banco, formX + 113, yText(418.49), { bold: true, max: 24 });
    putLabel("Origen de Fondos", formX + 272, yText(418.49), 30);
    put(origenFondos || "-", formX + 396, yText(418.49), { bold: true, max: 22 });

    rowBox(405.53, rowFill);
    putLabel("Depósitos (Monto / Fecha /  Banco / N° OP)", formX + 2, yText(405.53), 70);

    [395.57, 385.61, 375.65, 365.69, 355.73].forEach((bottomPx, index) => {
      const dep = depositos[index];
      rowBox(bottomPx);
      putLabel("Monto de depósito", formX + 2, yText(bottomPx), 28);
      put(dep ? money(dep.monto || dep.importe || 0) : "", formX + 92, yText(bottomPx), { bold: true, max: 18 });
      put(dep ? formatDate(dep.fechaOperacion || dep.fecha || dep.createdAt) : "", formX + 168, yText(bottomPx), { bold: true, max: 14 });
      put(dep?.entidadFinanciera || dep?.banco || "", formX + 245, yText(bottomPx), { bold: true, max: 22 });
      put(dep?.numeroOperacion || dep?.operacion || dep?.op || "", formX + 360, yText(bottomPx), { bold: true, max: 22 });
    });

    section("OTROS", 342.29);

    rowBox(332.81);
    putLabel("Considera GLP", formX + 2, yText(332.81), 24);
    put(amountOrBlank(d.glp), formX + 113, yText(332.81), { bold: true, max: 14 });
    putLabel("Flete", formX + 272, yText(332.81), 12);
    put(amountOrBlank(d.flete), formX + 336, yText(332.81), { bold: true, max: 14 });

    rowBox(322.85);
    putLabel("Tarjeta y Placa", formX + 2, yText(322.85), 26);
    put(amountOrBlank(d.tarjetaPlaca || d.tarjetaplaca), formX + 113, yText(322.85), { bold: true, max: 14 });

    rowBox(302.93, rowFill);
    putLabel("Accesorios", formX + 2, yText(302.93), 18);
    putLabel("Cantidad", formX + 17, yText(302.93), 16);
    putLabel("Descripción", formX + 151, yText(302.93), 22);
    putLabel("Precio", formX + 440, yText(302.93), 14);

    rowBox(292.49);
    (accessories || []).slice(0, 1).forEach((item) => {
      put(item.cantidad || "1", formX + 24, yText(292.49), { bold: true, max: 8 });
      put(item.descripcion || item.nombre || "", formX + 151, yText(292.49), { bold: true, max: 42 });
      put(money(item.precio || item.monto || 0), formX + 440, yText(292.49), { bold: true, max: 16 });
    });

    rowBox(240.14, rowFill);
    putLabel("Obsequios", formX + 2, yText(240.14), 18);
    putLabel("Cantidad", formX + 17, yText(240.14), 16);
    putLabel("Descripción", formX + 151, yText(240.14), 22);
    putLabel("Precio", formX + 440, yText(240.14), 14);

    rowBox(229.7);
    (gifts || []).slice(0, 1).forEach((item) => {
      put(item.cantidad || "1", formX + 24, yText(229.7), { bold: true, max: 8 });
      put(item.descripcion || item.nombre || "", formX + 151, yText(229.7), { bold: true, max: 42 });
      put(amountOrBlank(item.precio || item.monto), formX + 440, yText(229.7), { bold: true, max: 16 });
    });

    rowBox(104.64);
    putLabel("OBSERVACIONES", formX + 2, yText(104.64), 24);

    setFont("normal", 5.6);
    pdf.text(
      [
        "Se deja constancia que si desiste de la compra y desea la devolución, estará afecta a un % de retención por concepto de gastos administrativos y que el motivo en materia de devolución está afecta a 20 días",
        "hábiles, cualquier cambio adicional que no conste en la presente no será responsabilidad de la empresa. La emtrega está sujeta a stock, los plazos de entrega pueden sufrir variación por posibles demoras en la",
        "entrega del vehículo por parte de la marca, por tal caso no será imputable al vendedor o a Wankamotors, cabe resaltar que el precio puede sufrir variación por factores externos ajenos a Wankamotors y",
        "estipulados por la marca. Una vez emitido el mismo no se aceptará su cambio ni canje. Por tal motivo agradecemos verificar la información registrada, en señal de conformidad el cliente deja como constancia",
        "su firma.",
      ],
      formX + 6,
      yTop(64.32) + 7,
      { maxWidth: formW - 12, lineHeightFactor: 1.18 },
    );

    const signBottom = 117.12;
    const signY = yTop(signBottom);
    const signatureLabels = [
      ["Cliente", formX + 36],
      ["Asesor de Ventas", formX + 201],
      ["Jefe de Ventas", formX + 375],
    ];
    signatureLabels.forEach(([label, x]) => {
      setFont("normal", 8);
      text("___________________________________", x - 36, signY - 2);
      put(label, x, signY + 7, { bold: true, max: 24 });
    });

    await drawTemplateElements(getTemplateSection("PIE"), formX, 760, formW, 20);
    return;
  }

  {
    await drawTemplateWatermark();
    rect(left, top, right - left, bottom - top);

    const pageInnerW = right - left;
    const sectionFill = [238, 238, 238];
    const rowFill = [242, 242, 242];
    const tightFont = 5.2;
    const tightBold = 5.3;
    const sectionFont = 5.6;
    const lineH = 3.45;

    const put = (value, x, y, opts = {}) => {
      setFont(opts.bold ? "bold" : "normal", opts.size || tightFont);
      text(clip(value, opts.max || 45), x, y, opts.align ? { align: opts.align } : {});
    };
    const putLabel = (label, x, y, max = 24) => put(label, x, y, { bold: true, size: tightBold, max });
    const sectionBar = (title, y, w = pageInnerW, x = left) => {
      rect(x, y, w, 3.2, sectionFill);
      put(title, x + 1, y + 2.35, { bold: true, size: sectionFont, max: 45 });
    };
    const box = (x, y, w, h, title) => {
      rect(x, y, w, h);
      sectionBar(title, y, w, x);
    };
    const kv = (label, value, x, y, labelW = 31, valueMax = 34) => {
      putLabel(label, x, y);
      put(value, x + labelW, y, { max: valueMax });
    };

    // Encabezado con logos desde plantilla.
    const headerY = top + 3;
    const headerH2 = 19;
    const headerTemplateApplied = await drawTemplateElements(getTemplateSection("ENCABEZADO"), left + 1, headerY, pageInnerW - 2, headerH2);
    if (!headerTemplateApplied) {
      setFont("bold", 19);
      text("Wankamotors", left + 1, headerY + 9);
    }
    putLabel("Asesor", left + 1, top + 18, 14);
    put(asesor, left + 23, top + 18, { bold: true, max: 34 });
    putLabel("Origen de Venta", left + 1, top + 22, 22);
    put(origenVenta, left + 23, top + 22, { max: 24 });
    putLabel("ID", left + 66, top + 22, 8);
    put(idTexto, left + 73, top + 22, { max: 22 });
    putLabel("Fecha", right - 68, top + 18, 14);
    put(fechaDoc, right - 46, top + 18, { max: 18 });
    putLabel("Campaña", right - 68, top + 22, 18);
    put(campania, right - 46, top + 22, { max: 18 });

    const titleY = top + 25;
    rect(left, titleY, pageInnerW, 4, sectionFill);
    put(personTitle, left + pageInnerW / 2, titleY + 2.8, { bold: true, size: 5.5, max: 80, align: "center" });

    // Datos del cliente.
    const clientY = titleY + 4;
    const clientH = 42;
    box(left, clientY, pageInnerW, clientH, "DATOS DEL CLIENTE");
    let y = clientY + 6.4;
    const lX = left + 1;
    const vX = left + 36;
    const rX = left + 123;
    const rvX = left + 158;
    kv("Tipo de comprobante", tipoComprobante, lX, y, 35, 38); y += lineH;
    kv("Razon social", tipoPersona === "JURIDICA" ? nombreComercial : cliente, lX, y, 35, 58); y += lineH;
    kv("Cliente / Repr legal", cliente, lX, y, 35, 58);
    kv("F. de nacimiento", fechaNacimiento, rX, y, 35, 18); y += lineH;
    kv("DNI / RUC", documento, lX, y, 35, 26);
    kv("Telefono 1", celular, rX, y, 35, 18); y += lineH;
    kv("Correo", email, lX, y, 35, 58);
    kv("Telefono 2", r.telefono2 || "", rX, y, 35, 18); y += lineH;
    kv("Ocupacion", ocupacion, lX, y, 35, 38); y += lineH;
    kv("Domicilio", domicilio, lX, y, 35, 58); y += lineH;
    kv("Distrito", distrito, lX, y, 35, 24);
    kv("Provincia", provincia, left + 78, y, 24, 24);
    kv("Departamento", region, rX, y, 35, 18); y += lineH;
    kv("Conyuge/Copropiedad", conyugue, lX, y, 35, 38); y += lineH;
    kv("DNI Conyuge", documentoConyugue, lX, y, 35, 26);

    // Datos del vehiculo.
    const vehicleY = clientY + clientH + 1.4;
    const vehicleH = 20;
    box(left, vehicleY, pageInnerW, vehicleH, "DATOS DEL VEHICULO");
    y = vehicleY + 6.4;
    kv("Modelo", modelo, lX, y, 24, 28);
    kv("Version", version, left + 66, y, 24, 32); y += lineH;
    kv("Chasis / VIN", vin, lX, y, 24, 28);
    kv("Color", color, left + 66, y, 24, 24); y += lineH;
    kv("Motor", motor, lX, y, 24, 28);
    kv("Año Modelo", anio, left + 66, y, 24, 14); y += lineH;
    kv("Uso del vehiculo / Placa", d.usoVehiculo || d.usovehiculo || "-", lX, y, 35, 28);
    kv("Codigo", codigoUnidad, left + 66, y, 24, 24);

    // Transaccion.
    const txY = vehicleY + vehicleH + 1.4;
    const txH = 54;
    box(left, txY, pageInnerW, txH, "TRANSACCION");
    y = txY + 6.4;
    kv("Precio de Lista (Valor incluye IGV)", showPriceList ? money(precioLista) : "-", lX, y, 62, 18); y += lineH;
    const discountCells = [
      [discountRows[0]?.label || "Descuento A", discountRows[0] ? money(discountRows[0].value) : "-"],
      [discountRows[2]?.label || "Descuento C", discountRows[2] ? money(discountRows[2].value) : "-"],
      [discountRows[4]?.label || "Descuento E", discountRows[4] ? money(discountRows[4].value) : "-"],
      [discountRows[1]?.label || "Descuento B", discountRows[1] ? money(discountRows[1].value) : "-"],
      [discountRows[3]?.label || "Descuento D", discountRows[3] ? money(discountRows[3].value) : "-"],
      [discountRows[5]?.label || "Descuento F", discountRows[5] ? money(discountRows[5].value) : "-"],
    ];
    const dXs = [lX, left + 66, left + 140];
    for (let rowIndex = 0; rowIndex < 2; rowIndex += 1) {
      dXs.forEach((x0, index) => {
        const item = discountCells[rowIndex * 3 + index];
        rect(x0 - 0.8, y - 2.6, 28, 3.3, rowFill);
        putLabel(item[0], x0, y, 24);
        put(item[1], x0 + 31, y, { max: 14 });
      });
      y += lineH;
    }
    kv("Precio Final (Valor incluye IGV)", money(totalFinal), lX, y, 62, 18); y += lineH;
    kv("T.C. Referencial", tcReferencial ? `S/. ${tcReferencial}` : "-", lX, y, 32, 14); y += lineH;
    kv("Forma de Pago", r.formaPago || d.formaPago || "-", lX, y, 32, 20);
    kv("Tipo de credito", r.tipoCredito || d.tipoCredito || "-", left + 66, y, 34, 20); y += lineH;
    kv("Banco", depositos[0]?.entidadFinanciera || "-", lX, y, 32, 24);
    kv("Origen de Fondos", r.origenFondos || r.origen_fondos || "-", left + 66, y, 34, 24); y += lineH + 1;

    rect(lX - 0.8, y - 2.6, 62, 3.3, rowFill);
    putLabel("Depositos (Monto / Fecha / Banco / N OP)", lX, y, 58); y += lineH;
    const depRows = Math.max(5, Math.min(6, depositos.length || 0));
    for (let index = 0; index < depRows; index += 1) {
      const dep = depositos[index];
      putLabel("Monto de deposito", lX, y, 28);
      put(dep ? money(dep.monto) : "-", left + 43, y, { max: 18 });
      put(dep ? formatDate(dep.fechaDeposito) : "-", left + 78, y, { max: 18 });
      put(dep ? dep.entidadFinanciera : "-", left + 116, y, { max: 24 });
      put(dep ? dep.numeroOperacion : "-", right - 33, y, { max: 18 });
      y += lineH;
    }

    // Otros, accesorios y obsequios.
    const otherY = txY + txH + 1.4;
    const otherH = 66;
    box(left, otherY, pageInnerW, otherH, "OTROS");
    y = otherY + 6.4;
    kv("Considera GLP", Number(d.glp || r.glp || 0) > 0 ? "SI" : "NO", lX, y, 32, 8);
    kv("Precio", money(d.glp ?? r.glp), left + 50, y, 18, 14);
    kv("Flete", Number(d.flete || r.flete || 0) > 0 ? "SI" : "NO", left + 108, y, 20, 8);
    kv("Precio", money(d.flete ?? r.flete), left + 146, y, 18, 14); y += lineH;
    kv("Tarjeta y Placa", Number(d.tarjetaPlaca || d.tarjeta_placa || r.tarjetaPlaca || r.tarjeta_placa || 0) > 0 ? "SI" : "NO", lX, y, 32, 8);
    kv("Precio", money(d.tarjetaPlaca ?? d.tarjeta_placa ?? r.tarjetaPlaca ?? r.tarjeta_placa), left + 50, y, 18, 14);

    const miniTable = (title, items, startY) => {
      putLabel(title, lX, startY, 18);
      rect(lX + 22, startY - 2.6, pageInnerW - 24, 3.3, rowFill);
      putLabel("Cantidad", lX + 7, startY + 4, 16);
      putLabel("Descripcion", left + 72, startY + 4, 24);
      putLabel("Precio", right - 25, startY + 4, 14);
      const item = (items || [])[0];
      if (item) {
        put(String(item.cantidad || 1), lX + 9, startY + 8, { max: 8 });
        put(item.detalle || item.nombre || item.numeroParte || item.lote || "-", left + 45, startY + 8, { max: 82 });
        put(money(item.total || item.precioUnitario || item.precio || 0), right - 29, startY + 8, { max: 18 });
      }
    };
    miniTable("Accesorios", accessories, otherY + 18);
    miniTable("Obsequios", gifts, otherY + 40);

    // Firmas.
    const signY = otherY + otherH + 20;
    pdf.setDrawColor(...lineColor);
    pdf.line(left + 6, signY, left + 58, signY);
    pdf.line(left + 72, signY, left + 124, signY);
    pdf.line(left + 138, signY, right - 6, signY);
    put("Cliente", left + 32, signY + 3, { bold: true, size: 4.8, align: "center", max: 20 });
    put("Asesor de Ventas", left + 98, signY + 3, { bold: true, size: 4.8, align: "center", max: 28 });
    put("Jefe de Ventas", left + 164, signY + 3, { bold: true, size: 4.8, align: "center", max: 28 });
    if (signed) {
      pdf.setFont(hasAutography ? "Autography" : "helvetica", hasAutography ? "normal" : "italic");
      pdf.setFontSize(13);
      pdf.text(asesor || "Asesor", left + 73, signY - 2);
      pdf.text(salesBossName || "Jefe de Ventas", left + 139, signY - 2);
    }

    // Observaciones.
    const obsY2 = bottom - 20;
    rect(left, obsY2, pageInnerW, 18);
    rect(left, obsY2, pageInnerW, 3.2, sectionFill);
    put("OBSERVACIONES", left + 1, obsY2 + 2.35, { bold: true, size: 5.2, max: 35 });
    const legalText =
      "Se deja constancia que si desiste de la compra y desea la devolucion, estara afecta a un % de retencion por concepto de gastos administrativos y que el monto en materia de devolucion esta afecta a 20 dias habiles, cualquier cambio adicional que no conste en la presente no sera responsabilidad de la empresa. La entrega esta sujeta a stock, los plazos de entrega pueden sufrir variacion por posibles demoras en la entrega del vehiculo por parte de la marca, por tal caso no sera imputable al vendedor o a Wankamotors, cabe resaltar que el precio puede sufrir variacion por factores externos ajenos a Wankamotors y estipulados por la marca. Una vez emitido el mismo no se aceptara su cambio ni canje.";
    setFont("normal", 3.7);
    pdf.text(pdf.splitTextToSize(legalText, pageInnerW - 4).slice(0, 5), left + 2, obsY2 + 6, { maxWidth: pageInnerW - 4, lineHeightFactor: 0.92 });
    await drawTemplateElements(getTemplateSection("PIE"), left + 2, bottom - 7, right - left - 4, 5);
    return;
  }

  // =========================================================
  // Layout tipo hoja (1 sola hoja)
  // =========================================================
  await drawTemplateWatermark();
  rect(left, top, right - left, bottom - top);

  // Header: usa el encabezado configurado en el formato activo de RESERVA.
  const headerH = 17;
  const metaH = 5.2;
  rect(left, currentY, right - left, headerH);

  const headerTemplateApplied = await drawTemplateElements(getTemplateSection("ENCABEZADO"), left + 2, currentY + 1.2, right - left - 4, headerH - 2.4);
  if (!headerTemplateApplied) {
    setFont("bold", 20);
    text("Wankamotors", left + 4, currentY + 12);
  }

  currentY += headerH;

  rect(left, currentY, right - left, metaH);
  const metaLabelW = 22;
  const asesorW = 68;
  const fechaW = 44;
  const origenW = (right - left) - metaLabelW * 3 - asesorW - fechaW;
  let metaX = left;

  rect(metaX, currentY, metaLabelW, metaH, labelFill);
  rect(metaX + metaLabelW, currentY, asesorW, metaH);
  setFont("bold", 6);
  text("ASESOR", metaX + 1.2, currentY + 3.8);
  setFont("normal", 6.3);
  text(clip(asesor, 32), metaX + metaLabelW + 1.2, currentY + 3.8);
  metaX += metaLabelW + asesorW;

  rect(metaX, currentY, metaLabelW, metaH, labelFill);
  rect(metaX + metaLabelW, currentY, fechaW, metaH);
  setFont("bold", 6);
  text("FECHA", metaX + 1.2, currentY + 3.8);
  setFont("normal", 6.3);
  text(fechaDoc, metaX + metaLabelW + 1.2, currentY + 3.8);
  metaX += metaLabelW + fechaW;

  rect(metaX, currentY, metaLabelW, metaH, labelFill);
  rect(metaX + metaLabelW, currentY, origenW, metaH);
  setFont("bold", 6);
  text("ORIGEN", metaX + 1.2, currentY + 3.8);
  setFont("normal", 6.3);
  text(clip(origenVenta, 24), metaX + metaLabelW + 1.2, currentY + 3.8);

  currentY += metaH;

  // ID / Campaña
  const idH2 = 5.2;
  rect(left, currentY, right - left, idH2);
  rect(left, currentY, 18, idH2, headerFill);

  setFont("bold", 8);
  text("ID:", left + 1.2, currentY + 3.8);
  setFont("normal", 8);
  text(clip(idTexto, 28), left + 21, currentY + 3.8);

  setFont("bold", 8);
  text("CAMPAÑA:", left + 120, currentY + 3.8);
  setFont("normal", 8);
  text(clip(campania, 24), left + 145, currentY + 3.8);

  currentY += idH2;

  // Título
  const titleH = 4.8;
  rect(left, currentY, right - left, titleH, headerFill);
  setFont("bold", 9.5);
  text(personTitle, (left + right) / 2, currentY + 3.45, { align: "center" });
  currentY += titleH;

  // Helper filas
  const rowH = 4.05;
  const labelW = 56;
  const col1W = 82;
  const col2W = (right - left) - labelW - col1W;

  const row = (label, v1, v2 = "") => {
    ensurePage(rowH);
    rect(left, currentY, right - left, rowH);
    rect(left, currentY, labelW, rowH, labelFill);

    setFont("bold", 5.8);
    text(label, left + 1.1, currentY + 2.95);

    setFont("normal", 6.1);
    if (v2 === "" || v2 === null || typeof v2 === "undefined") {
      rect(left + labelW, currentY, (right - left) - labelW, rowH);
      text(clip(v1, 74), left + labelW + 1.1, currentY + 2.95);
    } else {
      rect(left + labelW, currentY, col1W, rowH);
      rect(left + labelW + col1W, currentY, col2W, rowH);
      text(clip(v1, 44), left + labelW + 1.1, currentY + 2.95);
      text(clip(v2, 34), left + labelW + col1W + 1.1, currentY + 2.95);
    }

    currentY += rowH;
  };

  const doubleFieldRow = (label1, value1, label2, value2) => {
    ensurePage(rowH);
    const label1W = 34;
    const value1W = 58;
    const label2W = 34;
    const value2W = (right - left) - label1W - value1W - label2W;

    rect(left, currentY, label1W, rowH, labelFill);
    rect(left + label1W, currentY, value1W, rowH);
    rect(left + label1W + value1W, currentY, label2W, rowH, labelFill);
    rect(left + label1W + value1W + label2W, currentY, value2W, rowH);

    setFont("bold", 5.8);
    text(label1, left + 1.1, currentY + 2.95);
    text(label2, left + label1W + value1W + 1.1, currentY + 2.95);

    setFont("normal", 6.1);
    text(clip(value1, 28), left + label1W + 1.1, currentY + 2.95);
    text(clip(value2, 28), left + label1W + value1W + label2W + 1.1, currentY + 2.95);

    currentY += rowH;
  };

  // ===== Datos Cliente =====
  rect(left, currentY, right - left, 4.2, headerFill);
  setFont("bold", 6.3);
  text("DATOS DEL CLIENTE", left + 1.1, currentY + 3);
  currentY += 4.2;
  row("COMPROBANTE", tipoComprobante);
  if (tipoPersona === "JURIDICA") {
    row("NOMBRE COMERCIAL", nombreComercial);
  }
  row("NOMBRES Y APELLIDOS", cliente);
  row("CONYUGUE/CO-PROP.", conyugue);
  row("DNI / DNI CONY.", documento, documentoConyugue);
  row("DIRECCION", domicilio);

  // Distrito/Provincia/Región en una fila
  ensurePage(rowH);
  rect(left, currentY, right - left, rowH);
  rect(left, currentY, labelW, rowH, labelFill);

  setFont("bold", 5.8);
  text("DISTRITO", left + 1.1, currentY + 2.95);

  const aW = 42;
  const bLblW = 18;
  const bW = 36;
  const cLblW = 16;
  const cW = (right - left) - labelW - aW - bLblW - bW - cLblW;

  rect(left + labelW, currentY, aW, rowH);
  setFont("normal", 6.1);
  text(clip(distrito, 14), left + labelW + 1.1, currentY + 2.95);

  rect(left + labelW + aW, currentY, bLblW, rowH, labelFill);
  setFont("bold", 5.8);
  text("PROV.", left + labelW + aW + 1.1, currentY + 2.95);

  rect(left + labelW + aW + bLblW, currentY, bW, rowH);
  setFont("normal", 6.1);
  text(clip(provincia, 12), left + labelW + aW + bLblW + 1.1, currentY + 2.95);

  rect(left + labelW + aW + bLblW + bW, currentY, cLblW, rowH, labelFill);
  setFont("bold", 5.8);
  text("REG.", left + labelW + aW + bLblW + bW + 1.1, currentY + 2.95);

  rect(left + labelW + aW + bLblW + bW + cLblW, currentY, cW, rowH);
  setFont("normal", 6.1);
  text(clip(region, 10), left + labelW + aW + bLblW + bW + cLblW + 1.1, currentY + 2.95);

  currentY += rowH;

  row("TELEFONO", celular);
  row("F. NACIMIENTO", fechaNacimiento);
  row("CORREO", email);
  row("OCUPACION", ocupacion);
  row("ORIGEN FONDOS", r.origenFondos || r.origen_fondos || "-");

  // ===== Vehículo =====
  ensurePage(4.2);
  rect(left, currentY, right - left, 4.2, headerFill);
  setFont("bold", 6.3);
  text("DATOS DEL VEHICULO", left + 1.1, currentY + 3);
  currentY += 4.2;

  doubleFieldRow("MARCA", marca, "MODELO", modelo);
  doubleFieldRow("VERSION", version, "CLASE", clase);
  doubleFieldRow("COLOR", color, "ANIO", anio);
  doubleFieldRow("CHASIS/VIN", vin, "MOTOR", motor);
  row("CODIGO", codigoUnidad);

  // ===== Precios =====
  ensurePage(4.2);
  rect(left, currentY, right - left, 4.2, headerFill);
  setFont("bold", 6.3);
  text("TRANSACCION", left + 1.1, currentY + 3);
  currentY += 4.2;

  if (showPriceList) row("PRECIO LISTA", money(precioLista));
  const visibleDiscountRows = discountRows.length > 6
    ? [
      ...discountRows.slice(0, 5),
      {
        label: "OTROS DESCUENTOS",
        value: discountRows.slice(5).reduce((sum, item) => sum + Number(item.value || 0), 0),
      },
    ]
    : discountRows;
  visibleDiscountRows.forEach((item) => row(item.label, money(item.value)));
  row("PRECIO FINAL", money(totalFinal));
  row("TIPO DE CAMBIO", tcReferencial || "-");

  // ===== Depósitos =====
  ensurePage(4.2);
  rect(left, currentY, right - left, 4.2, headerFill);
  setFont("bold", 6.3);
  text("DEPOSITOS (MONTO / FECHA / BANCO / N OP)", left + 1.1, currentY + 3);
  currentY += 4.2;

  const depRows = Math.max(5, Math.min(7, depositos.length || 0));
  const depLabelW = 56;
  const montoW = 34;
  const depFechaW = 30;
  const bancoW = 44;
  const opW = (right - left) - depLabelW - montoW - depFechaW - bancoW;

  for (let i = 0; i < depRows; i++) {
    const dep = depositos[i];
    ensurePage(rowH);

    rect(left, currentY, right - left, rowH);
    rect(left, currentY, depLabelW, rowH, labelFill);
    setFont("bold", 5.8);
    text("MONTO DEPOSITO", left + 1.1, currentY + 2.95);

    rect(left + depLabelW, currentY, montoW, rowH);
    rect(left + depLabelW + montoW, currentY, depFechaW, rowH);
    rect(left + depLabelW + montoW + depFechaW, currentY, bancoW, rowH);
    rect(left + depLabelW + montoW + depFechaW + bancoW, currentY, opW, rowH);

    setFont("normal", 6.1);
    text(dep ? money(dep.monto) : "-", left + depLabelW + 1.1, currentY + 2.95);
    text(dep ? formatDate(dep.fechaDeposito) : "-", left + depLabelW + montoW + 1.1, currentY + 2.95);
    text(dep ? clip(dep.entidadFinanciera, 16) : "-", left + depLabelW + montoW + depFechaW + 1.1, currentY + 2.95);
    text(dep ? clip(dep.numeroOperacion, 20) : "-", left + depLabelW + montoW + depFechaW + bancoW + 1.1, currentY + 2.95);

    currentY += rowH;
  }

  // =========================================================
  // ✅ Bloque de firmas EXACTO como tu original (Autography)
  // =========================================================
  const signAreaTop = bottom - (obsH + signH + serviceH + extrasH); // inicia bloque extras de venta+firmas+extras+obs
  const serviceLabelW = 72;
  const serviceFlagW = 24;
  const servicePriceLabelW = 34;
  const serviceValueW = (right - left) - serviceLabelW - serviceFlagW - servicePriceLabelW;
  const serviceItems = [
    { label: "CONSIDERA GLP", value: d.glp ?? r.glp },
    { label: "FLETE", value: d.flete ?? r.flete },
    { label: "PLACAS Y TARJETAS", value: d.tarjetaPlaca ?? d.tarjeta_placa ?? r.tarjetaPlaca ?? r.tarjeta_placa },
  ];

  rect(left, signAreaTop, right - left, serviceRowH, headerFill);
  setFont("bold", 6.3);
  text("OTROS", left + 1.1, signAreaTop + 3);

  let summaryRowIndex = 0;
  const drawSummaryRow = (label, value, { flag = "", priceLabel = "", fillLabel = true, boldValue = false } = {}) => {
    const rowY = signAreaTop + serviceRowH + summaryRowIndex * serviceRowH;
    rect(left, rowY, serviceLabelW, serviceRowH, fillLabel ? labelFill : null);
    rect(left + serviceLabelW, rowY, serviceFlagW, serviceRowH);
    rect(left + serviceLabelW + serviceFlagW, rowY, servicePriceLabelW, serviceRowH, priceLabel ? labelFill : null);
    rect(left + serviceLabelW + serviceFlagW + servicePriceLabelW, rowY, serviceValueW, serviceRowH);
    setFont("bold", 6.8);
    text(label, left + 2, rowY + 3.8);
    text(priceLabel, left + serviceLabelW + serviceFlagW + 2, rowY + 3.8);
    setFont(boldValue ? "bold" : "normal", 7.2);
    text(flag, left + serviceLabelW + 2, rowY + 3.8);
    text(value, left + serviceLabelW + serviceFlagW + servicePriceLabelW + 2, rowY + 3.8);
    summaryRowIndex += 1;
  };

  serviceItems.forEach((item) => {
    const value = Number(item.value || 0);
    drawSummaryRow(item.label, money(value), { flag: value > 0 ? "SI" : "NO", priceLabel: "PRECIO" });
  });

  const drawQuoteMiniTable = (title, items) => {
    const titleY = signAreaTop + serviceRowH + summaryRowIndex * serviceRowH;
    rect(left, titleY, right - left, serviceRowH);
    rect(left, titleY, 24, serviceRowH, labelFill);
    setFont("bold", 5.8);
    text(title, left + 1.1, titleY + 2.95);
    summaryRowIndex += 1;

    const headY = signAreaTop + serviceRowH + summaryRowIndex * serviceRowH;
    rect(left, headY, 28, serviceRowH, labelFill);
    rect(left + 28, headY, right - left - 58, serviceRowH, labelFill);
    rect(right - 30, headY, 30, serviceRowH, labelFill);
    setFont("bold", 5.6);
    text("Cantidad", left + 6, headY + 2.95);
    text("Descripcion", left + 72, headY + 2.95);
    text("Precio", right - 24, headY + 2.95);
    summaryRowIndex += 1;

    const rowY = signAreaTop + serviceRowH + summaryRowIndex * serviceRowH;
    rect(left, rowY, right - left, serviceRowH);
    const item = (items || [])[0];
    if (item) {
      setFont("normal", 5.7);
      text(String(item.cantidad || 1), left + 8, rowY + 2.95);
      text(clip(item.detalle || item.nombre || item.numeroParte || item.lote || "-", 78), left + 30, rowY + 2.95);
      text(money(item.total || item.precioUnitario || item.precio || 0), right - 28, rowY + 2.95);
    }
    summaryRowIndex += 1;
  };

  drawQuoteMiniTable("Accesorios", accessories);
  drawQuoteMiniTable("Obsequios", gifts);

  const labelsY = signAreaTop + serviceH;
  const lineY = labelsY + 18;

  // Labels
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.2);
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
    pdf.setFontSize(15.5);

    // asesor (columna medio)
    pdf.text(asesor || "Asesor", left + 70, lineY - 3);

    // jefe ventas / autorizado (columna derecha)
    pdf.text(salesBossName || "Jefe de Ventas", left + 132, lineY - 3);
  }

  // =========================================================
  // ✅ Observaciones: texto fijo + (opcional) extra obs
  // =========================================================
  const obsY = signAreaTop + serviceH + signH + extrasH;
  rect(left, obsY, right - left, obsH);
  rect(left, obsY, right - left, 4, labelFill);

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

  setFont("bold", 5.8);
  text("OBSERVACIONES", left + 1.1, obsY + 2.9);

  // título centrado


  // texto legal
  const obsPad = 2;
  const obsTextX = left + obsPad;
  const obsTextY = obsY + 7;
  const obsTextW = (right - left) - obsPad * 2;
  const obsLineHeight = 1.0;
  const obsFontSize = 4.7;
  setFont("bold", obsFontSize);
  const wrapped = pdf.splitTextToSize(obsText.toUpperCase(), obsTextW);
  const lineHeightMm = obsFontSize * 0.3528 * obsLineHeight;
  const maxLines = Math.max(1, Math.floor((obsH - 5) / lineHeightMm));
  pdf.text(wrapped.slice(0, maxLines), obsTextX, obsTextY, { align: "justify", maxWidth: obsTextW, lineHeightFactor: obsLineHeight });
  await drawTemplateElements(getTemplateSection("PIE"), left + 2, bottom - 7, right - left - 4, 5);
}
