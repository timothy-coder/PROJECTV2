"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Eye, FileText } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
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

export default function ReservationDetailPage({ id }) {
  const { data, loading, update } = useReservationDetail(id);
  if (loading || !data) return <div className="p-4">Cargando reserva...</div>;
  const { reservation, detail, currentUser, vins, accessories, gifts, salesBossName, vinReleaseRequest } = data;
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
          {currentUser.canViewAll && !isSigned ? <Button variant="outline" onClick={() => update({ status: "observado", observaciones: reservation.observaciones || "Observado" })}>Marcar observado</Button> : null}
          {currentUser.canViewAll && !isSigned ? <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => update({ status: "firmado" })}>Firmar</Button> : null}
          {!currentUser.canViewAll && !isSigned ? <Button onClick={() => update({ status: "subsanado" })}>Marcar subsanado</Button> : null}
        </div>
        <ReservationForm reservation={reservation} detail={detail} vins={vins} accessories={accessories || []} gifts={gifts || []} update={update} readOnly={isSigned} />
      </div>
    </div>
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

function ReservationForm({ reservation, detail, vins, accessories, gifts, update, readOnly }) {
  const [form, setForm] = useState({ ...detail });
  const [saveState, setSaveState] = useState("guardado");
  const firstRender = useRef(true);
  const total = useMemo(() => Number(form.precioUnitario || 0) * Number(form.cantidad || 1) - Number(form.descuentoTienda || 0) - Number(form.bonoRetoma || 0) - Number(form.descuentoNper || 0) + Number(form.glp || 0) + Number(form.tarjetaPlaca || 0) + Number(form.flete || 0), [form]);
  const vinMessage = form.vinExiste ? "" : (form.cuotaInicial ? "Anticipo sin data" : "Reserva total sin data");
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
          <div className="md:col-span-2"><label className="flex items-center gap-2 text-sm font-bold"><Switch disabled={readOnly} checked={form.vinExiste} onCheckedChange={(checked) => setForm((f) => ({ ...f, vinExiste: checked, vin: checked ? f.vin : "" }))} /> VIN existe</label></div>
          {form.vinExiste ? <Field label={`VIN (${vins.length} disponibles)`}><SearchableSelect disabled={readOnly} value={form.vin} options={vins} placeholder="Seleccionar VIN" onChange={(value) => setForm((f) => ({ ...f, vin: value }))} /></Field> : <p className="text-xs font-bold text-red-600 md:col-span-2">{vinMessage}</p>}
          <Field label="Uso del Vehiculo"><Input disabled={readOnly} value={form.usoVehiculo} onChange={(e) => setForm((f) => ({ ...f, usoVehiculo: e.target.value }))} /></Field>
          <Field label="Color Externo"><Input value={form.colorExterno} disabled /></Field>
          <Field label="Color Interno"><Input value={form.colorInterno} disabled /></Field>
          <Field label="Numero de Motor"><Input disabled={readOnly} value={form.numeroMotor} onChange={(e) => setForm((f) => ({ ...f, numeroMotor: e.target.value }))} /></Field>
        </Block>
        <Block title="DESCUENTOS Y MONTOS">
          <Field label="Descuento Tienda ($)"><Input disabled={readOnly} type="number" value={form.descuentoTienda} onChange={(e) => setForm((f) => ({ ...f, descuentoTienda: e.target.value }))} /></Field>
          <Field label="Descuento Tienda (%)"><Input disabled={readOnly} type="number" value={form.descuentoTiendaPorcentaje} onChange={(e) => setForm((f) => ({ ...f, descuentoTiendaPorcentaje: e.target.value }))} /></Field>
          <Field label="Bono Retoma"><Input disabled={readOnly} type="number" value={form.bonoRetoma} onChange={(e) => setForm((f) => ({ ...f, bonoRetoma: e.target.value }))} /></Field>
          <Field label="Descuento Marca"><Input disabled={readOnly} type="number" value={form.descuentoNper} onChange={(e) => setForm((f) => ({ ...f, descuentoNper: e.target.value }))} /></Field>
          <Field label="Cantidad"><Input disabled={readOnly} type="number" value={form.cantidad} onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))} /></Field>
          <Field label="Precio Unitario"><Input disabled={readOnly} type="number" value={form.precioUnitario} onChange={(e) => setForm((f) => ({ ...f, precioUnitario: e.target.value }))} /></Field>
          <Field label="Flete"><Input disabled={readOnly} type="number" value={form.flete} onChange={(e) => setForm((f) => ({ ...f, flete: e.target.value }))} /></Field>
          <Field label="Tarjeta Placa"><Input disabled={readOnly} type="number" value={form.tarjetaPlaca} onChange={(e) => setForm((f) => ({ ...f, tarjetaPlaca: e.target.value }))} /></Field>
          <Field label="GLP"><Input disabled={readOnly} type="number" value={form.glp} onChange={(e) => setForm((f) => ({ ...f, glp: e.target.value }))} /></Field>
          <Field label="Cuota Inicial"><Input disabled={readOnly} type="number" value={form.cuotaInicial} onChange={(e) => setForm((f) => ({ ...f, cuotaInicial: e.target.value }))} /></Field>
        </Block>
        <ItemsBlock title="ACCESORIOS" rows={accessories} referenceKey="numeroParte" />
        <ItemsBlock title="REGALOS" rows={gifts} referenceKey="lote" />
        <Field label="Observaciones / Descripcion"><Textarea disabled={readOnly} value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></Field>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-right text-2xl font-bold text-blue-700">TOTAL FINAL: {money(total)}</div>
      </div>
    </section>
  );
}

function Block({ title, children }) { return <div className="border-t pt-4"><h3 className="mb-4 font-bold">{title}</h3><div className="grid gap-3 md:grid-cols-2">{children}</div></div>; }
function ItemsBlock({ title, rows, referenceKey }) { const total = rows.reduce((sum, item) => sum + Number(item.total || 0), 0); return <div className="border-t pt-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">{title}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{rows.length} registros</span></div><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="px-3 py-3">Detalle</th><th>Referencia</th><th>Cant.</th><th>Unitario</th><th>Desc.</th><th>Total</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id}><td className="px-3 py-3 font-medium">{row.detalle}</td><td>{row[referenceKey] || "-"}</td><td>{row.cantidad}</td><td>{money(row.precioUnitario)}</td><td className="text-red-600">{money(row.descuentoMonto)}</td><td className="font-bold text-blue-700">{money(row.total)}</td></tr>)}{!rows.length ? <tr><td className="py-8 text-center text-slate-500" colSpan={6}>Sin registros</td></tr> : null}</tbody></table></div><div className="mt-3 rounded-lg border bg-slate-50 p-3 text-right font-bold">Total {title}: {money(total)}</div></div>; }
function Field({ label, children }) { return <div className="space-y-1"><Label className="text-xs font-bold text-slate-600">{label}</Label>{children}</div>; }
function InfoCard({ title, lines }) { return <div className="rounded-lg border bg-white p-5 shadow-sm"><p className="mb-6 font-semibold">{title}</p>{lines.map((line, index) => <p key={index} className={index === 0 ? "font-bold" : "text-sm text-slate-600"}>{line || "-"}</p>)}</div>; }
function StatusBadge({ estado }) { return <span className="ml-2 rounded-full bg-blue-100 px-2 py-1 align-middle text-xs font-bold text-blue-700">{estado}</span>; }

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
  line("Descuento Tienda", money(detail.descuentoTienda));
  line("Bono Retoma", money(detail.bonoRetoma));
  line("Descuento Marca", money(detail.descuentoNper));
  line("Flete", money(detail.flete));
  line("Tarjeta Placa", money(detail.tarjetaPlaca));
  line("GLP", money(detail.glp));
  line("T.C. Referencial", detail.tcReferencial || "-");
  line("Total", money(detail.total));

  itemLines("ACCESORIOS", accessories, "numeroParte");
  itemLines("REGALOS", gifts, "lote");

  section("RESUMEN FINAL");
  line("Total Nota de Pedido", money(detail.total));
  line("Total Accesorios y Regalos", money(accessoriesTotal + giftsTotal));
  line("TOTAL GENERAL", money(Number(detail.total || 0) + accessoriesTotal + giftsTotal));

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
