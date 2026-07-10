"use client";

import { useMemo, useState } from "react";
import { Eye, RefreshCw, Search, Wrench } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePostventaAppointments } from "@/hooks/postventa/usePostventaAppointments";
import { hasPerm } from "@/lib/permissions";

const PAGE_SIZE = 8;

export default function PostventaAppointmentsPage({ userPermissions }) {
  const data = usePostventaAppointments();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [manualDetail, setManualDetail] = useState(null);
  const canView = hasPerm(userPermissions, ["citas", "view"]) || hasPerm(userPermissions, ["citas", "viewall"]);
  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return data.appointments.filter((item) => !text || `${item.clienteNombre} ${item.vehiculoNombre} ${item.oportunidadCodigo} ${item.asesorNombre} ${item.estado}`.toLowerCase().includes(text));
  }, [data.appointments, query]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, currentPage]);
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
          <Input
            className="pl-9"
            placeholder="Buscar cita, cliente, oportunidad..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </section>
      <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-700">
              <tr><th className="px-3 py-3">Fecha</th><th>Cliente</th><th>Vehiculo</th><th>Centro</th><th>Taller</th><th>Asesor</th><th>Tipo</th><th>Estado</th><th>Oportunidad</th><th className="text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y">
              {pageRows.map((item) => (
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
        <div className="flex flex-col gap-2 border-t border-slate-200 px-3 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Pagina {currentPage} de {totalPages} · Mostrando {pageRows.length} de {rows.length} citas
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Siguiente</Button>
          </div>
        </div>
      </section>
      {detail ? (
        <AppointmentDetailDialog
          item={detail}
          maintenanceSubitems={data.maintenanceSubitems || []}
          onRegister={async (payload) => {
            await data.update(detail.id, payload);
            setManualDetail(null);
            toast.success("Mantenimiento registrado y cita actualizada.");
          }}
          onClose={() => { setManualDetail(null); window.history.replaceState(null, "", "/citaspv"); }}
        />
      ) : null}
    </div>
  );
}

function AppointmentDetailDialog({ item, maintenanceSubitems, onRegister, onClose }) {
  const [form, setForm] = useState({
    fechaVisitaTaller: item.startDate || "",
    kilometrajeTaller: "",
    submantenimientoId: "",
  });
  const submaintenanceOptions = maintenanceSubitemOptions(maintenanceSubitems || []);

  async function submitMaintenance() {
    if (!form.fechaVisitaTaller || form.kilometrajeTaller === "" || !form.submantenimientoId) {
      toast.error("Completa fecha, kilometraje y submantenimiento.");
      return;
    }
    await onRegister({
      centroId: item.centroId,
      tallerId: item.tallerId || "",
      asesorId: item.asesorId || "",
      origenId: item.origenId || "",
      startDate: form.fechaVisitaTaller,
      startTime: item.startTime || "00:00",
      endDate: form.fechaVisitaTaller,
      endTime: item.endTime || item.startTime || "00:00",
      estado: "finalizada",
      tipoServicio: item.tipoServicio || "TALLER",
      notaCliente: item.notaCliente || "",
      notaInterna: item.notaInterna || "",
      kilometrajeTaller: form.kilometrajeTaller,
      submantenimientoId: form.submantenimientoId,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-[min(96vw,860px)] overflow-y-auto bg-white p-4 text-slate-950 sm:p-5">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">Cita #{item.id}</DialogTitle>
          <DialogDescription className="text-xs">{item.startDate} {item.startTime} - {item.endTime}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
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
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <h3 className="mb-2 flex min-w-0 items-center gap-1.5 text-[13px] font-bold leading-none text-amber-900">
            <Wrench className="size-3.5 shrink-0" />
            <span className="truncate">Registrar mantenimiento</span>
          </h3>
          <div className="grid gap-2 min-[520px]:grid-cols-[112px_76px_minmax(170px,1fr)_auto] min-[520px]:items-end">
            <Field label="Fecha *">
              <Input className="h-8 px-2 text-xs" type="date" value={form.fechaVisitaTaller} onChange={(event) => setForm((current) => ({ ...current, fechaVisitaTaller: event.target.value }))} />
            </Field>
            <Field label="Km *">
              <Input className="h-8 px-2 text-xs" type="number" min="0" value={form.kilometrajeTaller} onChange={(event) => setForm((current) => ({ ...current, kilometrajeTaller: event.target.value }))} />
            </Field>
            <Field label="Submantenimiento *">
              <SearchableSelect className="h-8 px-2 text-xs" value={form.submantenimientoId} options={submaintenanceOptions} placeholder="Seleccionar submantenimiento" searchPlaceholder="Buscar submantenimiento..." onChange={(submantenimientoId) => setForm((current) => ({ ...current, submantenimientoId }))} />
            </Field>
            <Button type="button" className="h-8 px-3 text-xs bg-amber-600 text-white hover:bg-amber-700" onClick={submitMaintenance}>Guardar</Button>
          </div>
        </div>
        {item.oportunidadId ? <Button className="mt-3 h-9" onClick={() => { window.location.href = `/oportunidadespv/${item.oportunidadId}`; }}>Ir a oportunidad</Button> : null}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, wide }) {
  return <div className={`rounded-lg border border-slate-200 bg-slate-50 p-2.5 ${wide ? "sm:col-span-2" : ""}`}><p className="text-[11px] font-bold uppercase leading-none text-slate-500">{label}</p><p className="mt-1 break-words text-[13px] font-semibold leading-snug">{value || "-"}</p></div>;
}

function Field({ label, children }) {
  return <label className="grid gap-1 text-[11px] font-bold leading-none text-slate-600"><span>{label}</span>{children}</label>;
}

function maintenanceSubitemOptions(items = []) {
  return items
    .map((item) => ({
      value: item.id,
      label: item.name || "Sin nombre",
      keywords: [item.name, item.mantenimientoName].filter(Boolean).join(" "),
    }));
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
