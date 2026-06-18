"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, Loader2, MoreVertical, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { PostventaOpportunityDialog } from "@/components/postventa/PostventaOpportunityDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMaintenanceDue } from "@/hooks/postventa/useMaintenanceDue";
import { hasPerm } from "@/lib/permissions";

export default function MaintenanceDuePage({ userPermissions }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [quickRange, setQuickRange] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [dialogVehicle, setDialogVehicle] = useState(null);
  const [clientDetail, setClientDetail] = useState(null);
  const [vehicleDetail, setVehicleDetail] = useState(null);
  const [opportunityPicker, setOpportunityPicker] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileActionId, setMobileActionId] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const tableContainerRef = useRef(null);
  const paginationRef = useRef(null);
  useEffect(() => {
    function updateLimit() {
      const height = window.visualViewport?.height || window.innerHeight || 800;
      const tableTop = tableContainerRef.current?.getBoundingClientRect().top || 215;
      const paginationHeight = paginationRef.current?.getBoundingClientRect().height || 44;
      const tableHeaderHeight = 42;
      const bottomGap = 20;
      const rowHeight = 60;
      const availableRowsHeight = height - tableTop - paginationHeight - tableHeaderHeight - bottomGap;
      const nextLimit = Math.max(4, Math.min(100, Math.floor(availableRowsHeight / rowHeight)));
      setLimit((current) => {
        if (current === nextLimit) return current;
        setPage(1);
        return nextLimit;
      });
    }

    const frame = window.requestAnimationFrame(updateLimit);
    window.addEventListener("resize", updateLimit);
    window.visualViewport?.addEventListener("resize", updateLimit);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateLimit);
      window.visualViewport?.removeEventListener("resize", updateLimit);
    };
  }, []);
  const apiFilters = useMemo(
    () => ({
      page,
      limit,
      q: query,
      status,
      brand: brandFilter,
      model: modelFilter,
      fromDate,
      toDate,
    }),
    [brandFilter, fromDate, limit, modelFilter, page, query, status, toDate]
  );
  const data = useMaintenanceDue(apiFilters);

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

  const rows = data.vehicles || [];
  const meta = data.meta || { total: rows.length, page, limit, pages: 1 };

  const brandOptions = useMemo(() => {
    return [{ value: "", label: "Todas las marcas" }, ...(data.options?.brands || [])];
  }, [data.options?.brands]);

  const modelOptions = useMemo(() => {
    const source = brandFilter
      ? (data.options?.models || []).filter((item) => item.brand === brandFilter)
      : data.options?.models || [];
    return [{ value: "", label: "Todos los modelos" }, ...source];
  }, [data.options?.models, brandFilter]);

  function applyQuickRange(value) {
    setPage(1);
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

  async function handleRecalculateMaintenance() {
    setRecalculating(true);
    try {
      const result = await data.recalculateMaintenance();
      toast.success(`Proximo mantenimiento recalculado para ${result.updated || 0} vehiculos`);
    } catch (error) {
      toast.error(error.message || "No se pudo recalcular los mantenimientos");
    } finally {
      setRecalculating(false);
    }
  }

  function openOpportunity(item) {
    const opportunities = Array.isArray(item.oportunidades) ? item.oportunidades : [];
    if (opportunities.length > 1) {
      setOpportunityPicker(item);
      return;
    }

    const opportunityId = opportunities[0]?.id || item.oportunidadId;
    if (opportunityId) router.push(`/oportunidadespv/${opportunityId}`);
  }

  if (!canView) {
    return (
      <div className="rounded-lg bg-white p-4 text-sm text-slate-700">
        No tienes permiso para ingresar a proximos mantenimientos.
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden bg-slate-50 p-3 text-slate-950 sm:p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold leading-tight text-violet-700">Proximos mantenimientos</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">Resumen de vehiculos y mantenimiento pronosticado {canViewAll ? "- Vista completa" : "- Mi vista"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleRecalculateMaintenance}
            disabled={recalculating}
          >
            {recalculating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Recalcular proximos
          </Button>
          <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={data.reload}>
            <RefreshCw className="size-4" />
            Recargar
          </Button>
        </div>
      </header>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <button type="button" className="mb-3 flex w-full items-center justify-between rounded-md border border-violet-100 bg-violet-50 px-3 py-2 text-left text-xs font-bold text-violet-700 sm:hidden" onClick={() => setFiltersOpen((open) => !open)}>
          Filtros
          <ChevronDown className={`size-4 transition ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
        <h2 className="mb-3 hidden font-semibold sm:block">Vista general de proximos mantenimientos</h2>

        <div className={`${filtersOpen ? "grid" : "hidden"} mb-4 min-w-0 grid-cols-1 gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-8`}>
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="w-full pl-9"
              placeholder="Buscar cliente, vehiculo, placa o VIN..."
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
            />
          </div>

          <div className="min-w-0">
            <SearchableSelect
              value={brandFilter}
              options={brandOptions}
              placeholder="Marca"
              searchPlaceholder="Buscar marca..."
              onChange={(value) => {
                setPage(1);
                setBrandFilter(value);
                setModelFilter("");
              }}
            />
          </div>

          <div className="min-w-0">
            <SearchableSelect
              value={modelFilter}
              options={modelOptions}
              placeholder="Modelo"
              searchPlaceholder="Buscar modelo..."
              onChange={(value) => {
                setPage(1);
                setModelFilter(value);
              }}
            />
          </div>

          <div className="min-w-0">
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
              onChange={(value) => {
                setPage(1);
                setStatus(value);
              }}
            />
          </div>

          <Input
            type="date"
            className="min-w-0"
            value={fromDate}
            onChange={(event) => {
              setPage(1);
              setFromDate(event.target.value);
              setQuickRange("");
            }}
            aria-label="Fecha desde"
          />

          <Input
            type="date"
            className="min-w-0"
            value={toDate}
            onChange={(event) => {
              setPage(1);
              setToDate(event.target.value);
              setQuickRange("");
            }}
            aria-label="Fecha hasta"
          />

          <div className="min-w-0">
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
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setQuery("");
              setStatus("");
              setBrandFilter("");
              setModelFilter("");
              setFromDate("");
              setToDate("");
              setQuickRange("");
              setPage(1);
            }}
          >
            Limpiar
          </Button>
        </div>

        <p className="mb-3 text-xs text-slate-500">
          Mostrando {rows.length} de {meta.total || 0} vehiculos segun la fecha de proximo mantenimiento.
        </p>

        <div ref={tableContainerRef} className="hidden max-w-full overflow-x-auto rounded-lg border sm:block">
          <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
            <thead className="bg-slate-100 text-xs font-bold text-slate-700">
              <tr>
                <th className="w-[260px] px-3 py-3">Cliente</th>
                <th className="w-[220px]">Vehiculo</th>
                <th className="w-[130px]">Prox. Mantenimiento</th>
                <th className="w-[120px]">Tipo de prediccion</th>
                <th className="w-[110px]">Dias restantes</th>
                <th className="w-[110px]">Recordatorio</th>
                <th className="w-[105px]">Estado</th>
                <th className="w-[130px]">Fecha agendada</th>
                <th className="w-[145px] text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-start gap-2">
                      <Button size="icon-sm" variant="outline" onClick={() => setClientDetail(item)}>
                        <Eye className="size-3.5" />
                      </Button>
                      <span className="line-clamp-2 min-w-0 max-w-[210px] whitespace-normal break-words font-semibold leading-snug">{item.clienteNombre}</span>
                      
                    </div>
                  </td>
                  <td className="align-top">
                    <div className="flex items-start gap-2">
                      <Button size="icon-sm" variant="outline" onClick={() => setVehicleDetail(item)}>
                        <Eye className="size-3.5" />
                      </Button><span className="line-clamp-2 min-w-0 whitespace-normal break-words leading-snug">{item.vehiculo}</span>
                      
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

                  <td className="px-3 text-right align-top">
                    {item.oportunidadId && canOpenOpportunity ? (
                      <Button size="sm" variant="outline" className="mb-2 whitespace-nowrap" onClick={() => openOpportunity(item)}>
                        Ver oportunidad{item.oportunidades?.length > 1 ? ` (${item.oportunidades.length})` : ""}
                      </Button>
                    ) : null}

                    {canCreate ? (
                      <Button
                        size="sm"
                        className="whitespace-nowrap bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => setDialogVehicle(item)}
                      >
                        <Plus className="size-4" />
                        {item.oportunidadId ? "Agregar oportunidad" : "Crear oportunidad"}
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
        <div className="overflow-visible rounded-lg border sm:hidden">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
              <tr>
                <th className="w-[42%] px-2 py-2">Cliente</th>
                <th className="w-[36%] px-2 py-2">Mantenimiento</th>
                <th className="w-[22%] px-2 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-2 py-3">
                    <button type="button" className="line-clamp-2 text-left text-[11px] font-bold leading-tight text-slate-950" onClick={() => setClientDetail(item)}>
                      {item.clienteNombre}
                    </button>
                    <button type="button" className="mt-1 line-clamp-2 text-left text-[10px] font-medium leading-tight text-slate-500" onClick={() => setVehicleDetail(item)}>
                      {item.vehiculo}
                    </button>
                    {item.vin ? <p className="mt-1 truncate text-[9px] text-slate-400">VIN: {item.vin}</p> : null}
                  </td>
                  <td className="px-2 py-3">
                    <div><DateBadge value={item.proximoMantenimiento} days={item.diasRestantes} /></div>
                    <div className="mt-2"><DaysBadge value={item.diasRestantes} /></div>
                    <p className="mt-1 text-[10px] text-slate-500">{item.calculo || "-"}</p>
                  </td>
                  <td className="relative px-2 py-3 text-right">
                    <Button size="icon" variant="outline" className="size-8" onClick={() => setMobileActionId((current) => current === item.id ? null : item.id)}>
                      <MoreVertical className="size-4" />
                    </Button>
                    {mobileActionId === item.id ? (
                      <div className="absolute right-2 top-12 z-30 w-44 rounded-lg border border-slate-200 bg-white p-1 text-left text-xs shadow-xl">
                        <button type="button" className="block w-full rounded-md px-3 py-2 font-semibold hover:bg-slate-100" onClick={() => { setMobileActionId(null); setClientDetail(item); }}>Ver cliente</button>
                        <button type="button" className="block w-full rounded-md px-3 py-2 font-semibold hover:bg-slate-100" onClick={() => { setMobileActionId(null); setVehicleDetail(item); }}>Ver vehiculo</button>
                        {item.oportunidadId && canOpenOpportunity ? (
                          <button type="button" className="block w-full rounded-md px-3 py-2 font-semibold hover:bg-slate-100" onClick={() => { setMobileActionId(null); openOpportunity(item); }}>
                            Ver oportunidad{item.oportunidades?.length > 1 ? ` (${item.oportunidades.length})` : ""}
                          </button>
                        ) : null}
                        {canCreate ? (
                          <button type="button" className="block w-full rounded-md px-3 py-2 font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => { setMobileActionId(null); setDialogVehicle(item); }}>
                            {item.oportunidadId ? "Agregar oportunidad" : "Crear oportunidad"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-slate-500">
                    {data.loading ? "Cargando..." : "No hay vehiculos para mostrar"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div ref={paginationRef} className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-slate-500">
            Pagina {meta.page || page} de {meta.pages || 1}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={data.loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={data.loading || page >= Number(meta.pages || 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </Button>
          </div>
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
      {opportunityPicker ? (
        <OpportunityPickerDialog
          item={opportunityPicker}
          onClose={() => setOpportunityPicker(null)}
          onOpenOpportunity={(id) => router.push(`/oportunidadespv/${id}`)}
        />
      ) : null}
    </div>
  );
}

function OpportunityPickerDialog({ item, onClose, onOpenOpportunity }) {
  const opportunities = Array.isArray(item.oportunidades) ? item.oportunidades : [];

  return (
    <CommandDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Seleccionar oportunidad"
      description="Elige la oportunidad de PostVenta que deseas abrir."
      className="w-[min(94vw,560px)] bg-white text-slate-950"
      showCloseButton
    >
      <Command>
        <div className="border-b border-slate-200 px-3 py-2">
          <p className="text-sm font-bold text-violet-700">{item.clienteNombre}</p>
          <p className="text-xs text-slate-500">{item.vehiculo}</p>
        </div>
        <CommandInput placeholder="Buscar oportunidad..." />
        <CommandList>
          <CommandEmpty>No hay oportunidades.</CommandEmpty>
          <CommandGroup heading="Oportunidades asociadas">
            {opportunities.map((opportunity) => (
              <CommandItem
                key={opportunity.id}
                value={`${opportunity.code} ${opportunity.etapaNombre} ${opportunity.fechaAgendada}`}
                onSelect={() => {
                  onOpenOpportunity(opportunity.id);
                }}
                className="items-start py-2"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-950">{opportunity.code}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {opportunity.fechaAgendada || "Sin agenda"} {opportunity.estado ? `- ${opportunity.estado}` : ""}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
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

function makeUniqueOptions(rows, field, emptyLabel) {
  const options = new Map();
  for (const item of rows) {
    const label = String(item?.[field] || "").trim();
    if (!label) continue;
    options.set(normalizeOption(label), label);
  }
  return [
    { value: "", label: emptyLabel },
    ...Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

function normalizeOption(value) {
  return String(value || "").trim().toLowerCase();
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
