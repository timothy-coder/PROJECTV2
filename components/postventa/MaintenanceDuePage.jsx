"use client";

import { useMemo, useState } from "react";
import { Eye, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { PostventaOpportunityDialog } from "@/components/postventa/PostventaOpportunityDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMaintenanceDue } from "@/hooks/postventa/useMaintenanceDue";
import { hasPerm } from "@/lib/permissions";

export default function MaintenanceDuePage({ userPermissions }) {
  const data = useMaintenanceDue();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [quickRange, setQuickRange] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [dialogVehicle, setDialogVehicle] = useState(null);
  const [clientDetail, setClientDetail] = useState(null);
  const [vehicleDetail, setVehicleDetail] = useState(null);

  const canViewAll = Boolean(
    hasPerm(userPermissions, ["oportunidadespv", "viewall"]) ||
      hasPerm(userPermissions, ["leadspv", "viewall"]) ||
      data.currentUser?.canViewAll
  );

  const canView = Boolean(
    hasPerm(userPermissions, ["oportunidadespv", "view"]) || hasPerm(userPermissions, ["oportunidadespv", "viewall"])
  );

  const canCreate = hasPerm(userPermissions, ["oportunidadespv", "create"]);

  const canOpenOpportunity = Boolean(
    hasPerm(userPermissions, ["oportunidadespv", "view"]) || hasPerm(userPermissions, ["oportunidadespv", "viewall"])
  );

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (data.vehicles || []).filter((item) => {
      const matchesText =
        !text || `${item.clienteNombre} ${item.vehiculo} ${item.marca} ${item.modelo} ${item.version} ${item.placa} ${item.vin}`.toLowerCase().includes(text);

      const matchesStatus = !status || item.estadoRecordatorio === status;
      const matchesVehicle = !vehicleFilter || vehicleKey(item) === vehicleFilter;

      // Filtra por fecha de proximo mantenimiento
      const matchesDate = matchesDateRange(item.proximoMantenimiento, fromDate, toDate);

      return matchesText && matchesStatus && matchesVehicle && matchesDate;
    });
  }, [data.vehicles, query, status, vehicleFilter, fromDate, toDate]);

  const vehicleOptions = useMemo(() => {
    const options = new Map();
    for (const item of data.vehicles || []) {
      const key = vehicleKey(item);
      if (!key) continue;
      options.set(key, vehicleLabel(item));
    }
    return [{ value: "", label: "Todas las marcas/modelos/versiones" }, ...Array.from(options.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [data.vehicles]);

  function applyQuickRange(value) {
    setQuickRange(value);
    const today = dateOnly(new Date());

    if (!value) {
      setFromDate("");
      setToDate("");
      return;
    }

    if (value === "today") {
      setFromDate(today);
      setToDate(today);
      return;
    }

    const days = Number(value);
    const from = new Date();
    from.setDate(from.getDate() - days);
    setFromDate(dateOnly(from));
    setToDate(today);
  }

  if (!canView) {
    return (
      <div className="rounded-lg bg-white p-4 text-sm text-slate-700">
        No tienes permiso para ingresar a proximos mantenimientos.
      </div>
    );
  }

  return (
    <div className="min-w-0 bg-slate-50 p-4 text-slate-950">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Proximos mantenimientos</h1>
          <p className="text-sm text-slate-500">
            Resumen de vehiculos y mantenimiento pronosticado {canViewAll ? "- Vista completa" : "- Mi vista"}
          </p>
        </div>
        <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={data.reload}>
          <RefreshCw className="size-4" />
          Recargar
        </Button>
      </header>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Vista general de proximos mantenimientos</h2>

        <div className="mb-4 grid gap-3 md:grid-cols-[280px_240px_200px_160px_160px_200px_120px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar cliente, vehiculo, placa o VIN..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>

          <SearchableSelect
            value={vehicleFilter}
            options={vehicleOptions}
            placeholder="Marca / modelo / version"
            searchPlaceholder="Buscar marca, modelo o version..."
            onChange={setVehicleFilter}
          />

          <SearchableSelect
            value={status}
            options={[
              { value: "", label: "Todos" },
              { value: "Vencido", label: "Vencido" },
              { value: "Pendiente contacto", label: "Pendiente contacto" },
              { value: "Programado", label: "Programado" },
              { value: "Sin algoritmo", label: "Sin algoritmo" },
              { value: "Cerrado", label: "Cerrado" },
            ]}
            onChange={setStatus}
          />

          <Input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setQuickRange("");
            }}
            aria-label="Fecha desde"
          />

          <Input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setQuickRange("");
            }}
            aria-label="Fecha hasta"
          />

          <SearchableSelect
            value={quickRange}
            options={[
              { value: "", label: "Rango manual" },
              { value: "today", label: "Hoy" },
              { value: "30", label: "Ultimos 30 dias" },
              { value: "60", label: "Ultimos 60 dias" },
              { value: "90", label: "Ultimos 90 dias" },
            ]}
            onChange={applyQuickRange}
          />

          <Button
            variant="outline"
            onClick={() => {
              setQuery("");
              setStatus("");
              setVehicleFilter("");
              setFromDate("");
              setToDate("");
              setQuickRange("");
            }}
          >
            Limpiar
          </Button>
        </div>

        <p className="mb-3 text-xs text-slate-500">
          Mostrando {rows.length} de {(data.vehicles || []).length} vehiculos segun la fecha de proximo mantenimiento.
        </p>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-slate-100 text-xs font-bold text-slate-700">
              <tr>
                <th className="px-3 py-3">Cliente</th>
                <th>Vehiculo</th>
                <th>Prox. Mantenimiento</th>
                <th>Tipo de prediccion</th>
                <th>Dias restantes</th>
                <th>Recordatorio</th>
                <th>Estado</th>
                <th>Fecha agendada</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Button size="icon-sm" variant="outline" onClick={() => setClientDetail(item)}>
                        <Eye className="size-3.5" />
                      </Button>
                      <span className="font-semibold">{item.clienteNombre}</span>
                      
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Button size="icon-sm" variant="outline" onClick={() => setVehicleDetail(item)}>
                        <Eye className="size-3.5" />
                      </Button><span>{item.vehiculo}</span>
                      
                    </div>
                    {item.vin ? <p className="mt-1 text-xs font-medium text-slate-500">VIN: {item.vin}</p> : null}
                  </td>

                  <td>
                    <DateBadge value={item.proximoMantenimiento} days={item.diasRestantes} />
                  </td>

                  <td>
                    {item.calculo ? (
                      <span className="rounded-full border border-blue-300 bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
                        {item.calculo}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  <td>
                    <DaysBadge value={item.diasRestantes} />
                  </td>

                  <td>
                    {item.recordatorio ? (
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                        {formatDate(item.recordatorio)}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  <td>
                    <ReminderBadge value={item.estadoRecordatorio} motivo={item.cierreMotivo} />
                  </td>

                  <td>{item.fechaAgendada || item.oportunidadCodigo || "Sin oportunidad"}</td>

                  <td className="px-3 text-right">
                    {item.oportunidadId && canOpenOpportunity ? (
                      <Button size="sm" variant="outline" onClick={() => { window.location.href = `/oportunidadespv/${item.oportunidadId}`; }}>
                        Ver oportunidad
                      </Button>
                    ) : null}

                    {!item.oportunidadId && canCreate ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => setDialogVehicle(item)}
                      >
                        <Plus className="size-4" />
                        Crear oportunidad
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}

              {!rows.length ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    {data.loading ? "Cargando..." : "No hay vehiculos para mostrar"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {dialogVehicle ? (
        <PostventaOpportunityDialog
          open
          vehicle={dialogVehicle}
          options={data.options}
          currentUser={data.currentUser}
          canViewAll={canViewAll}
          onClose={() => setDialogVehicle(null)}
          onSubmit={async (payload) => {
            const created = await data.createOpportunity(payload);
            toast.success("Oportunidad de PostVenta creada");
            setDialogVehicle(null);
            if (created?.id) setVehicleDetail(null);
          }}
        />
      ) : null}
      {clientDetail ? <ClientInfoDialog item={clientDetail} onClose={() => setClientDetail(null)} /> : null}
      {vehicleDetail ? <VehicleInfoDialog item={vehicleDetail} onClose={() => setVehicleDetail(null)} /> : null}
    </div>
  );
}

function ClientInfoDialog({ item, onClose }) {
  const client = item.cliente || {};
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(94vw,640px)] bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>Informacion del cliente</DialogTitle>
          <DialogDescription>{client.nombreCompleto || item.clienteNombre}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Nombre" value={client.nombreCompleto || item.clienteNombre} />
          <Info label="Celular" value={client.celular} />
          <Info label="Email" value={client.email} />
          <Info label="Documento" value={[client.tipoIdentificacion, client.identificacionFiscal].filter(Boolean).join(" ")} />
          <Info label="Fecha nacimiento" value={formatDate(client.fechaNacimiento)} />
          <Info label="Ocupacion" value={client.ocupacion} />
          <Info label="Nombre comercial" value={client.nombreComercial} />
          <Info label="Domicilio" value={client.domicilio} wide />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VehicleInfoDialog({ item, onClose }) {
  const [tab, setTab] = useState("info");
  const history = item.historialMantenimientos || [];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] max-w-[min(94vw,760px)] overflow-hidden bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-slate-200 px-5 py-4">
          <DialogTitle>Informacion del vehiculo</DialogTitle>
          <DialogDescription>{item.vehiculo}</DialogDescription>
        </DialogHeader>
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            <button type="button" onClick={() => setTab("info")} className={`h-8 rounded-md text-xs font-bold ${tab === "info" ? "bg-white shadow-sm" : "text-slate-500"}`}>Carro</button>
            <button type="button" onClick={() => setTab("history")} className={`h-8 rounded-md text-xs font-bold ${tab === "history" ? "bg-white shadow-sm" : "text-slate-500"}`}>Historial</button>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {tab === "info" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Marca" value={item.marca} />
              <Info label="Modelo" value={item.modelo} />
              <Info label="Placa" value={item.placa} />
              <Info label="VIN" value={item.vin} />
              <Info label="Año" value={item.anio} />
              <Info label="Color" value={item.color} />
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs font-bold text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Fecha visita</th>
                    <th>Kilometraje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {history.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2">{formatDate(row.fechaVisitaTaller)}</td>
                      <td>{row.kilometrajeTaller ?? "-"}</td>
                    </tr>
                  ))}
                  {!history.length ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-slate-500">Sin historial de mantenimientos.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, wide }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}

function DateBadge({ value, days }) {
  if (!value) return <span className="text-slate-400">-</span>;
  const color =
    Number(days) < 0
      ? "bg-red-600 text-white"
      : Number(days) <= 30
        ? "bg-orange-100 text-orange-700 border-orange-300"
        : "bg-emerald-100 text-emerald-700 border-emerald-300";
  return <span className={`rounded-full border px-2 py-1 text-xs font-bold ${color}`}>{formatDate(value)}</span>;
}

function DaysBadge({ value }) {
  if (value === null || value === undefined) return <span className="text-slate-400">-</span>;
  const overdue = Number(value) < 0;
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-bold ${overdue ? "bg-red-600 text-white" : "bg-emerald-100 text-emerald-700"}`}>
      {overdue ? `Vencido (${Math.abs(value)}d)` : `${value}d`}
    </span>
  );
}

function ReminderBadge({ value, motivo }) {
  const colors = {
    Vencido: "border-red-300 bg-red-50 text-red-700",
    "Pendiente contacto": "border-orange-300 bg-orange-50 text-orange-700",
    Programado: "border-blue-300 bg-blue-50 text-blue-700",
    "Sin algoritmo": "border-slate-300 bg-slate-50 text-slate-500",
    Cerrado: "border-emerald-300 bg-emerald-50 text-emerald-700",
  };
  return <span title={value === "Cerrado" ? motivo || "Cerrado" : undefined} className={`rounded-full border px-2 py-1 text-xs font-semibold ${colors[value] || colors.Programado}`}>{value}</span>;
}

function vehicleLabel(item) {
  return [item.marca, item.modelo, item.version].filter(Boolean).join(" / ") || item.vehiculo || "-";
}

function vehicleKey(item) {
  return vehicleLabel(item).trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function dateOnly(value) {
  return value.toISOString().slice(0, 10);
}

function matchesDateRange(value, fromDate, toDate) {
  if (!fromDate && !toDate) return true;
  if (!value) return false;
  const current = String(value).slice(0, 10);
  if (fromDate && current < fromDate) return false;
  if (toDate && current > toDate) return false;
  return true;
}
