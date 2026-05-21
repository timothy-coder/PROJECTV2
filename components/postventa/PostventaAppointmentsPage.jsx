"use client";

import { useMemo, useState } from "react";
import { Eye, RefreshCw, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePostventaAppointments } from "@/hooks/postventa/usePostventaAppointments";
import { hasPerm } from "@/lib/permissions";

export default function PostventaAppointmentsPage({ userPermissions }) {
  const data = usePostventaAppointments();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [manualDetail, setManualDetail] = useState(null);
  const canView = hasPerm(userPermissions, ["citas", "view"]) || hasPerm(userPermissions, ["citas", "viewall"]);
  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return data.appointments.filter((item) => !text || `${item.clienteNombre} ${item.vehiculoNombre} ${item.oportunidadCodigo} ${item.asesorNombre} ${item.estado}`.toLowerCase().includes(text));
  }, [data.appointments, query]);
  const queryDetail = useMemo(() => {
    const id = searchParams.get("id");
    if (!id || manualDetail) return null;
    return data.appointments.find((appointment) => String(appointment.id) === String(id)) || null;
  }, [data.appointments, manualDetail, searchParams]);
  const detail = manualDetail || queryDetail;
  if (!canView) return <div className="rounded-lg bg-white p-4 text-sm text-slate-700">No tienes permiso para ver citas de PostVenta.</div>;
  return (
    <div className="min-w-0 bg-slate-50 p-4 text-slate-950">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-violet-700">Citas PostVenta</h1>
          <p className="text-sm text-slate-500">{data.currentUser?.canViewAll ? "Vista completa" : "Mi vista"}</p>
        </div>
        <Button variant="outline" onClick={data.reload}><RefreshCw className="size-4" />Actualizar</Button>
      </header>
      <section className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar cita, cliente, oportunidad..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </section>
      <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-700">
              <tr><th className="px-3 py-3">Fecha</th><th>Cliente</th><th>Vehiculo</th><th>Centro</th><th>Taller</th><th>Asesor</th><th>Tipo</th><th>Estado</th><th>Oportunidad</th><th className="text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 font-bold">{item.startDate} {item.startTime}</td>
                  <td>{item.clienteNombre}</td>
                  <td>{item.vehiculoNombre}</td>
                  <td>{item.centroNombre}</td>
                  <td>{item.tallerNombre || "-"}</td>
                  <td>{item.asesorNombre}</td>
                  <td>{item.tipoServicio}</td>
                  <td><StatusBadge value={item.estado} /></td>
                  <td>{item.oportunidadCodigo || "-"}</td>
                  <td className="px-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => setManualDetail(item)} title="Ver cita"><Eye className="size-4" /></Button>
                  </td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={10} className="py-10 text-center text-slate-500">{data.loading ? "Cargando..." : "No hay citas"}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {detail ? <AppointmentDetailDialog item={detail} onClose={() => { setManualDetail(null); window.history.replaceState(null, "", "/citaspv"); }} /> : null}
    </div>
  );
}

function AppointmentDetailDialog({ item, onClose }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(94vw,760px)] bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>Cita #{item.id}</DialogTitle>
          <DialogDescription>{item.startDate} {item.startTime} - {item.endTime}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Cliente" value={item.clienteNombre} />
          <Info label="Vehiculo" value={item.vehiculoNombre} />
          <Info label="Centro" value={item.centroNombre} />
          <Info label="Taller" value={item.tallerNombre} />
          <Info label="Asesor" value={item.asesorNombre} />
          <Info label="Origen" value={item.origenNombre} />
          <Info label="Tipo servicio" value={item.tipoServicio} />
          <Info label="Estado" value={item.estado} />
          <Info label="Oportunidad" value={item.oportunidadCodigo} />
          <Info label="Creado por" value={item.creadoPorNombre} />
          <Info label="Nota cliente" value={item.notaCliente} wide />
          <Info label="Nota interna" value={item.notaInterna} wide />
        </div>
        {item.oportunidadId ? <Button className="mt-4" onClick={() => { window.location.href = `/oportunidadespv/${item.oportunidadId}`; }}>Ir a oportunidad</Button> : null}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, wide }) {
  return <div className={`rounded-lg border border-slate-200 bg-slate-50 p-3 ${wide ? "sm:col-span-2" : ""}`}><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value || "-"}</p></div>;
}

function StatusBadge({ value }) {
  const colors = {
    pendiente: "border-yellow-300 bg-yellow-50 text-yellow-700",
    confirmada: "border-emerald-300 bg-emerald-50 text-emerald-700",
    reprogramada: "border-blue-300 bg-blue-50 text-blue-700",
    cancelada: "border-red-300 bg-red-50 text-red-700",
    finalizada: "border-slate-300 bg-slate-50 text-slate-700",
    "orden creada": "border-violet-300 bg-violet-50 text-violet-700",
    clientenollego: "border-orange-300 bg-orange-50 text-orange-700",
  };
  return <span className={`rounded-full border px-2 py-1 text-xs font-bold ${colors[value] || colors.pendiente}`}>{value}</span>;
}
