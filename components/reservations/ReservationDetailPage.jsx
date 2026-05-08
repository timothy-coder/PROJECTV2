"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Eye, FileText } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useReservationDetail } from "@/hooks/reservations/useReservations";

export default function ReservationDetailPage({ id }) {
  const { data, loading, update } = useReservationDetail(id);
  const [printing, setPrinting] = useState(false);
  if (loading || !data) return <div className="p-4">Cargando reserva...</div>;
  const { reservation, detail, currentUser, vins, accessories, gifts, salesBossName } = data;
  return (
    <div className="min-h-full bg-slate-50 p-4 text-slate-950">
      <style jsx global>{`
        @font-face { font-family: Autography; src: url('/fonts/Autography.ttf') format('truetype'); }
        @media print { body * { visibility: hidden; } #reservation-pdf, #reservation-pdf * { visibility: visible; } #reservation-pdf { position: absolute; inset: 0; background: white; } .no-print { display: none !important; } }
      `}</style>
      <div className="no-print">
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
          <InfoCard title="Total" lines={[`$${Number(detail.total || 0).toFixed(2)}`, `TC: ${detail.tcReferencial || "-"}`]} />
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {reservation.oportunidadId ? <Link className="inline-flex h-7 items-center gap-1 rounded-md border bg-white px-2 text-xs font-medium hover:bg-slate-50" href={`/oportunidades/${reservation.oportunidadId}`}><Eye className="size-4" />Ver Oportunidad</Link> : null}
          <Button variant="outline" onClick={() => { setPrinting(true); setTimeout(() => window.print(), 50); }}><Download className="size-4" />Descargar PDF</Button>
          {currentUser.canViewAll ? <Button variant="outline" onClick={() => update({ status: "observado", observaciones: reservation.observaciones || "Observado" })}>Marcar observado</Button> : null}
          {currentUser.canViewAll ? <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => update({ status: "firmado" })}>Firmar</Button> : null}
          {!currentUser.canViewAll && reservation.estado !== "firmado" ? <Button onClick={() => update({ status: "subsanado" })}>Marcar subsanado</Button> : null}
        </div>
        <ReservationForm reservation={reservation} detail={detail} vins={vins} accessories={accessories || []} gifts={gifts || []} update={update} />
      </div>
      <ReservationPdf visible={printing} reservation={reservation} detail={detail} accessories={accessories || []} gifts={gifts || []} salesBossName={salesBossName || "Jefe de Ventas"} />
    </div>
  );
}

function ReservationForm({ reservation, detail, vins, accessories, gifts, update }) {
  const [form, setForm] = useState({ ...detail });
  const [saveState, setSaveState] = useState("guardado");
  const firstRender = useRef(true);
  const total = useMemo(() => Number(form.precioUnitario || 0) * Number(form.cantidad || 1) - Number(form.descuentoTienda || 0) - Number(form.bonoRetoma || 0) - Number(form.descuentoNper || 0) + Number(form.glp || 0) + Number(form.tarjetaPlaca || 0) + Number(form.flete || 0), [form]);
  const vinMessage = form.vinExiste ? "" : (form.cuotaInicial ? "Anticipo sin data" : "Reserva total sin data");
  useEffect(() => {
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
  }, [form, total, update]);
  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="flex items-center justify-between bg-slate-50 px-4 py-3 font-bold">
        <span><FileText className="mr-2 inline size-4" />NOTA DE PEDIDO</span>
        <span className={`text-xs ${saveState === "error" ? "text-red-600" : saveState === "guardando" ? "text-orange-600" : "text-emerald-700"}`}>{saveState === "guardando" ? "Autoguardando..." : saveState === "error" ? "Error al guardar" : "Autoguardado"}</span>
      </div>
      <div className="space-y-6 p-4">
        <Block title="DATOS DEL CLIENTE">
          <Field label="Tipo de Comprobante"><Input value={form.tipoComprobante} onChange={(e) => setForm((f) => ({ ...f, tipoComprobante: e.target.value }))} /></Field>
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
          <div className="md:col-span-2"><label className="flex items-center gap-2 text-sm font-bold"><Switch checked={form.vinExiste} onCheckedChange={(checked) => setForm((f) => ({ ...f, vinExiste: checked, vin: checked ? f.vin : "" }))} /> VIN existe</label></div>
          {form.vinExiste ? <Field label={`VIN (${vins.length} disponibles)`}><SearchableSelect value={form.vin} options={vins} placeholder="Seleccionar VIN" onChange={(value) => setForm((f) => ({ ...f, vin: value }))} /></Field> : <p className="text-xs font-bold text-red-600 md:col-span-2">{vinMessage}</p>}
          <Field label="Uso del Vehiculo"><Input value={form.usoVehiculo} onChange={(e) => setForm((f) => ({ ...f, usoVehiculo: e.target.value }))} /></Field>
          <Field label="Color Externo"><Input value={form.colorExterno} disabled /></Field>
          <Field label="Color Interno"><Input value={form.colorInterno} disabled /></Field>
          <Field label="Numero de Motor"><Input value={form.numeroMotor} onChange={(e) => setForm((f) => ({ ...f, numeroMotor: e.target.value }))} /></Field>
        </Block>
        <Block title="DESCUENTOS Y MONTOS">
          <Field label="Descuento Tienda (S/)"><Input type="number" value={form.descuentoTienda} onChange={(e) => setForm((f) => ({ ...f, descuentoTienda: e.target.value }))} /></Field>
          <Field label="Descuento Tienda (%)"><Input type="number" value={form.descuentoTiendaPorcentaje} onChange={(e) => setForm((f) => ({ ...f, descuentoTiendaPorcentaje: e.target.value }))} /></Field>
          <Field label="Bono Retoma"><Input type="number" value={form.bonoRetoma} onChange={(e) => setForm((f) => ({ ...f, bonoRetoma: e.target.value }))} /></Field>
          <Field label="Descuento NPER"><Input type="number" value={form.descuentoNper} onChange={(e) => setForm((f) => ({ ...f, descuentoNper: e.target.value }))} /></Field>
          <Field label="Cantidad"><Input type="number" value={form.cantidad} onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))} /></Field>
          <Field label="Precio Unitario"><Input type="number" value={form.precioUnitario} onChange={(e) => setForm((f) => ({ ...f, precioUnitario: e.target.value }))} /></Field>
          <Field label="Flete"><Input type="number" value={form.flete} onChange={(e) => setForm((f) => ({ ...f, flete: e.target.value }))} /></Field>
          <Field label="Tarjeta Placa"><Input type="number" value={form.tarjetaPlaca} onChange={(e) => setForm((f) => ({ ...f, tarjetaPlaca: e.target.value }))} /></Field>
          <Field label="GLP"><Input type="number" value={form.glp} onChange={(e) => setForm((f) => ({ ...f, glp: e.target.value }))} /></Field>
          <Field label="Cuota Inicial"><Input type="number" value={form.cuotaInicial} onChange={(e) => setForm((f) => ({ ...f, cuotaInicial: e.target.value }))} /></Field>
        </Block>
        <ItemsBlock title="ACCESORIOS" rows={accessories} referenceKey="numeroParte" />
        <ItemsBlock title="REGALOS" rows={gifts} referenceKey="lote" />
        <Field label="Observaciones / Descripcion"><Textarea value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></Field>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-right text-2xl font-bold text-blue-700">TOTAL FINAL: ${total.toFixed(2)}</div>
      </div>
    </section>
  );
}

function ReservationPdf({ reservation, detail, accessories, gifts, salesBossName }) {
  const signed = reservation.estado === "firmado";
  const accessoriesTotal = accessories.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const giftsTotal = gifts.reduce((sum, item) => sum + Number(item.total || 0), 0);
  return (
    <div id="reservation-pdf" className="mx-auto hidden max-w-[760px] bg-white p-8 text-xs text-black print:block">
      <h1 className="text-center text-2xl font-bold text-violet-700">NISSAN</h1>
      <h2 className="text-center font-bold text-violet-700">NOTA DE PEDIDO</h2>
      <p className="text-center">Fecha: {new Date().toLocaleDateString("es-PE")}<br />Reserva #{reservation.id}</p>
      <PdfBlock title="INFORMACION DE LA RESERVA" rows={[["Oportunidad", reservation.oportunidadCode], ["Codigo Reserva", `RES-${reservation.id}`], ["Estado", reservation.estado], ["Creado por", reservation.creadoPor]]} />
      <PdfBlock title="DATOS DEL CLIENTE" rows={[["Nombre", reservation.cliente], ["Email", reservation.email], ["Telefono", reservation.celular], ["DNI/RUC", reservation.documento], ["Ocupacion", reservation.ocupacion], ["Domicilio", reservation.domicilio], ["Ubicacion", [reservation.distrito, reservation.provincia, reservation.departamento].filter(Boolean).join(", ")]]} />
      <PdfBlock title="DATOS DEL VEHICULO" rows={[["Marca", detail.marca], ["Modelo", detail.modelo], ["Clase", detail.clase], ["Version", detail.version], ["Anio", detail.anio], ["VIN", detail.vin || "-"], ["Motor #", detail.numeroMotor || "-"], ["Color Externo", detail.colorExterno || "-"], ["Color Interno", detail.colorInterno || "-"], ["Uso del Vehiculo", detail.usoVehiculo || "-"]]} />
      <PdfBlock title="DESCUENTOS Y MONTOS" rows={[["Precio Base", `$ ${Number(detail.precioBase || 0).toFixed(2)}`], ["Descuento Tienda", `$ ${Number(detail.descuentoTienda || 0).toFixed(2)}`], ["Bono Retoma", `$ ${Number(detail.bonoRetoma || 0).toFixed(2)}`], ["Descuento NPER", `$ ${Number(detail.descuentoNper || 0).toFixed(2)}`], ["Flete", `$ ${Number(detail.flete || 0).toFixed(2)}`], ["Tarjeta Placa", `$ ${Number(detail.tarjetaPlaca || 0).toFixed(2)}`], ["GLP", `$ ${Number(detail.glp || 0).toFixed(2)}`], ["Total", `$ ${Number(detail.total || 0).toFixed(2)}`]]} />
      <PdfItemsBlock title="ACCESORIOS" rows={accessories} referenceKey="numeroParte" />
      <PdfItemsBlock title="REGALOS" rows={gifts} referenceKey="lote" />
      <PdfBlock title="RESUMEN ACCESORIOS Y REGALOS" rows={[["Total Accesorios", `$ ${accessoriesTotal.toFixed(2)}`], ["Total Regalos", `$ ${giftsTotal.toFixed(2)}`], ["Total Accesorios + Regalos", `$ ${(accessoriesTotal + giftsTotal).toFixed(2)}`]]} />
      <PdfBlock title="RESUMEN FINAL" rows={[["Total Nota de Pedido", `$ ${Number(detail.total || 0).toFixed(2)}`], ["Total Accesorios y Regalos", `$ ${(accessoriesTotal + giftsTotal).toFixed(2)}`], ["TOTAL GENERAL", `$ ${(Number(detail.total || 0) + accessoriesTotal + giftsTotal).toFixed(2)}`]]} />
      <div className="mt-10 grid grid-cols-2 gap-10">
        <Signature title="FIRMA DEL CLIENTE" text={signed ? "Firma del Cliente" : ""} />
        <Signature title="FIRMA AUTORIZADO" text={signed ? salesBossName : ""} />
      </div>
    </div>
  );
}

function PdfBlock({ title, rows }) { return <section className="mt-4"><h3 className="border-b border-black pb-1 font-bold text-violet-700">{title}</h3><div className="mt-2 grid grid-cols-[180px_1fr] gap-y-1">{rows.map(([k, v]) => <div key={k} className="contents"><b>{k}:</b><span>{v || "-"}</span></div>)}</div></section>; }
function PdfItemsBlock({ title, rows, referenceKey }) { return <section className="mt-4"><h3 className="border-b border-black pb-1 font-bold text-violet-700">{title}</h3>{rows.length ? rows.map((row) => <p key={row.id} className="mt-2">- {row.detalle} {row[referenceKey] ? `(${row[referenceKey]})` : ""} Cant: {row.cantidad} | P.Unit: $ {Number(row.precioUnitario || 0).toFixed(2)} | Desc.: $ {Number(row.descuentoMonto || 0).toFixed(2)} | Total: $ {Number(row.total || 0).toFixed(2)}</p>) : <p className="mt-2">-</p>}</section>; }
function Signature({ title, text }) { return <div><p className="mb-6 font-bold">{title}:</p><div className="h-8 border-b border-black" /><p style={{ fontFamily: "Autography", fontSize: 34 }}>{text}</p></div>; }
function Block({ title, children }) { return <div className="border-t pt-4"><h3 className="mb-4 font-bold">{title}</h3><div className="grid gap-3 md:grid-cols-2">{children}</div></div>; }
function ItemsBlock({ title, rows, referenceKey }) { const total = rows.reduce((sum, item) => sum + Number(item.total || 0), 0); return <div className="border-t pt-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">{title}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{rows.length} registros</span></div><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="px-3 py-3">Detalle</th><th>Referencia</th><th>Cant.</th><th>Unitario</th><th>Desc.</th><th>Total</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id}><td className="px-3 py-3 font-medium">{row.detalle}</td><td>{row[referenceKey] || "-"}</td><td>{row.cantidad}</td><td>$ {Number(row.precioUnitario || 0).toFixed(2)}</td><td className="text-red-600">$ {Number(row.descuentoMonto || 0).toFixed(2)}</td><td className="font-bold text-blue-700">$ {Number(row.total || 0).toFixed(2)}</td></tr>)}{!rows.length ? <tr><td className="py-8 text-center text-slate-500" colSpan={6}>Sin registros</td></tr> : null}</tbody></table></div><div className="mt-3 rounded-lg border bg-slate-50 p-3 text-right font-bold">Total {title}: $ {total.toFixed(2)}</div></div>; }
function Field({ label, children }) { return <div className="space-y-1"><Label className="text-xs font-bold text-slate-600">{label}</Label>{children}</div>; }
function InfoCard({ title, lines }) { return <div className="rounded-lg border bg-white p-5 shadow-sm"><p className="mb-6 font-semibold">{title}</p>{lines.map((line, index) => <p key={index} className={index === 0 ? "font-bold" : "text-sm text-slate-600"}>{line || "-"}</p>)}</div>; }
function StatusBadge({ estado }) { return <span className="ml-2 rounded-full bg-blue-100 px-2 py-1 align-middle text-xs font-bold text-blue-700">{estado}</span>; }
