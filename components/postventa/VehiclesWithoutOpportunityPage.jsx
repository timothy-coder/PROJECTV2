"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/app/api/client";
import { PostventaOpportunityDialog } from "@/components/postventa/PostventaOpportunityDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMaintenanceDue } from "@/hooks/postventa/useMaintenanceDue";
import { hasPerm } from "@/lib/permissions";

export default function VehiclesWithoutOpportunityPage({ userPermissions }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [dialogVehicle, setDialogVehicle] = useState(null);
  const [clientDetail, setClientDetail] = useState(null);
  const [vehicleDetail, setVehicleDetail] = useState(null);
  const tableContainerRef = useRef(null);
  const paginationRef = useRef(null);
  const supportData = useMaintenanceDue({ page: 1, limit: 1 });

  const canView = Boolean(
    hasPerm(userPermissions, ["oportunidadespv", "view"]) ||
      hasPerm(userPermissions, ["oportunidadespv", "viewall"]) ||
      hasPerm(userPermissions, ["leadspv", "view"]) ||
      hasPerm(userPermissions, ["leadspv", "viewall"]) ||
      hasPerm(userPermissions, ["clientes", "view"]) ||
      hasPerm(userPermissions, ["clientes", "viewall"])
  );
  const canCreate = hasPerm(userPermissions, ["oportunidadespv", "create"]);

  const params = useMemo(() => {
    const next = new URLSearchParams({
      withMeta: "1",
      page: String(page),
      limit: String(limit),
    });
    if (appliedQuery.trim()) next.set("q", appliedQuery.trim());
    return next.toString();
  }, [appliedQuery, limit, page]);

  useEffect(() => {
    function updateLimit() {
      const height = window.visualViewport?.height || window.innerHeight || 800;
      const tableTop = tableContainerRef.current?.getBoundingClientRect().top || 255;
      const paginationHeight = paginationRef.current?.getBoundingClientRect().height || 44;
      const headerHeight = 42;
      const bottomGap = 18;
      const isMobile = window.matchMedia("(max-width: 639px)").matches;
      const rowHeight = isMobile ? 132 : 54;
      const availableRowsHeight = height - tableTop - paginationHeight - headerHeight - bottomGap;
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

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/powerbi/posventa/vehiculos-sin-oportunidad/data?${params}`)
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload?.message || "No se pudo cargar vehiculos sin oportunidad.");
          return payload;
        })
        .then((payload) => {
          if (cancelled) return;
          const nextRows = Array.isArray(payload?.rows) ? payload.rows : [];
          setRows(nextRows.map(mapNoOpportunityVehicle));
          setMeta(payload?.meta || { total: nextRows.length, page, limit, pages: 1 });
        })
        .catch((error) => {
          if (!cancelled) toast.error(error.message || "No se pudo cargar vehiculos sin oportunidad.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canView, limit, page, params]);

  async function createOpportunity(payload) {
    const created = await apiFetch("/api/postventa-opportunities?kind=opportunity", {
      method: "POST",
      body: JSON.stringify({ ...payload, kind: "opportunity" }),
    });
    setRows((current) => current.filter((item) => Number(item.id) !== Number(payload.vehiculoId)));
    setMeta((current) => ({ ...current, total: Math.max(0, Number(current.total || 0) - 1) }));
    toast.success("Oportunidad de PostVenta creada");
    setDialogVehicle(null);
    return created;
  }

  function applySearch() {
    setPage(1);
    setAppliedQuery(query);
  }

  if (!canView) {
    return (
      <div className="rounded-lg bg-white p-4 text-sm text-slate-700">
        No tienes permiso para ver vehiculos sin oportunidad.
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden bg-slate-50 p-3 text-slate-950 sm:p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold leading-tight text-violet-700">Vehiculos sin oportunidad</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">Vehiculos que nunca tuvieron una oportunidad de PostVenta creada</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/proximosmantenimientos")}>
          <ArrowLeft className="size-4" />
          Volver
        </Button>
      </header>

      <section className="rounded-lg border bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_110px]">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              value={query}
              placeholder="Buscar cliente, placa, VIN, marca o modelo..."
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applySearch();
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={applySearch} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Buscar
          </Button>
        </div>

        <p className="mb-3 text-xs font-medium text-slate-500">
          Mostrando {rows.length} de {meta.total || 0} vehiculos sin oportunidad.
        </p>

        <div ref={tableContainerRef} className="hidden max-w-full overflow-x-auto rounded-lg border sm:block">
          <table className="w-full min-w-[820px] table-fixed text-left text-sm">
            <thead className="bg-slate-100 text-xs font-bold text-slate-700">
              <tr>
                <th className="w-[260px] px-3 py-3">Cliente</th>
                <th className="w-[280px]">Vehiculo</th>
                <th className="w-[150px]">Placa / VIN</th>
                <th className="w-[140px]">Ult. mantenimiento</th>
                <th className="w-[150px] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 align-top">
                    <button type="button" className="line-clamp-2 text-left font-semibold leading-snug text-slate-950" onClick={() => setClientDetail(item)}>
                      {item.clienteNombre}
                    </button>
                    <p className="mt-1 text-xs text-slate-500">{item.cliente?.celular || item.cliente?.identificacionFiscal || "-"}</p>
                  </td>
                  <td className="align-top">
                    <button type="button" className="line-clamp-2 text-left leading-snug text-slate-800" onClick={() => setVehicleDetail(item)}>
                      {item.vehiculo}
                    </button>
                    {item.kilometraje ? <p className="mt-1 text-xs text-slate-500">Km: {item.kilometraje}</p> : null}
                  </td>
                  <td className="align-top">
                    <p className="font-semibold">{item.placas || "-"}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{item.vin || "-"}</p>
                  </td>
                  <td className="align-top">{formatDate(item.historialMantenimientos?.[0]?.fechaVisitaTaller) || "-"}</td>
                  <td className="px-3 text-right align-top">
                    <Button size="sm" variant="outline" className="mr-1" onClick={() => setVehicleDetail(item)}>
                      <Eye className="size-4" />
                      Ver
                    </Button>
                    {canCreate ? (
                      <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setDialogVehicle(item)}>
                        <Plus className="size-4" />
                        Crear
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    {loading ? "Cargando..." : "No hay vehiculos sin oportunidad para mostrar"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div ref={tableContainerRef} className="space-y-2 sm:hidden">
          {rows.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <button type="button" className="line-clamp-2 text-left text-xs font-bold leading-tight text-slate-950" onClick={() => setClientDetail(item)}>
                {item.clienteNombre}
              </button>
              <button type="button" className="mt-1 line-clamp-2 text-left text-[11px] font-medium leading-tight text-slate-600" onClick={() => setVehicleDetail(item)}>
                {item.vehiculo}
              </button>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                <span>Placa: <b className="text-slate-700">{item.placas || "-"}</b></span>
                <span>Km: <b className="text-slate-700">{item.kilometraje || "-"}</b></span>
                <span className="col-span-2 truncate">VIN: {item.vin || "-"}</span>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setVehicleDetail(item)}>Ver</Button>
                {canCreate ? (
                  <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setDialogVehicle(item)}>
                    <Plus className="size-4" />
                    Crear
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {!rows.length ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-slate-500">
              {loading ? "Cargando..." : "No hay vehiculos sin oportunidad para mostrar"}
            </div>
          ) : null}
        </div>

        <div ref={paginationRef} className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-slate-500">
            Pagina {meta.page || page} de {meta.pages || 1}
          </span>
          <span className="font-semibold text-slate-600">{meta.total || 0} registros</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Anterior
            </Button>
            <Button type="button" variant="outline" disabled={loading || page >= Number(meta.pages || 1)} onClick={() => setPage((current) => current + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      </section>

      {dialogVehicle ? (
        <PostventaOpportunityDialog
          open
          vehicle={dialogVehicle}
          options={supportData.options}
          currentUser={supportData.currentUser}
          canViewAll={Boolean(supportData.currentUser?.canViewAll)}
          onClose={() => setDialogVehicle(null)}
          onSubmit={createOpportunity}
        />
      ) : null}
      {clientDetail ? <ClientInfoDialog item={clientDetail} onClose={() => setClientDetail(null)} /> : null}
      {vehicleDetail ? <VehicleInfoDialog item={vehicleDetail} onClose={() => setVehicleDetail(null)} /> : null}
    </div>
  );
}

function mapNoOpportunityVehicle(row) {
  const clienteNombre = String(row.cliente_nombre_completo || "").trim() || [row.cliente_nombre, row.cliente_apellido].filter(Boolean).join(" ") || "-";
  const vehiculo = [row.marca_nombre, row.modelo_nombre, row.vehiculo_anio].filter(Boolean).join(" ") || row.vehiculo_placa || row.vehiculo_vin || "-";
  return {
    id: row.vehiculo_id,
    clienteId: row.cliente_id,
    clienteNombre,
    vehiculo,
    placas: row.vehiculo_placa || "",
    vin: row.vehiculo_vin || "",
    anio: row.vehiculo_anio || "",
    color: row.vehiculo_color || "",
    kilometraje: row.vehiculo_kilometraje || "",
    fechaUltimaVisita: row.vehiculo_fecha_ultima_visita || "",
    marcaId: row.marca_id || null,
    modeloId: row.modelo_id || null,
    marcaNombre: row.marca_nombre || "",
    modeloNombre: row.modelo_nombre || "",
    oportunidadId: null,
    oportunidadCodigo: "",
    oportunidades: [],
    cliente: {
      nombreCompleto: clienteNombre,
      celular: row.cliente_celular || "",
      email: row.cliente_email || "",
      tipoIdentificacion: row.cliente_tipo_identificacion || "",
      identificacionFiscal: row.cliente_numero_documento || "",
      nombreComercial: row.cliente_nombre_comercial || "",
      departamento: row.cliente_departamento || "",
      provincia: row.cliente_provincia || "",
      distrito: row.cliente_distrito || "",
    },
    historialMantenimientos: row.ultimo_mantenimiento_id ? [{
      id: row.ultimo_mantenimiento_id,
      fechaVisitaTaller: row.ultimo_mantenimiento_fecha,
      kilometrajeTaller: row.ultimo_mantenimiento_kilometraje,
    }] : [],
  };
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
          <Info label="Nombre comercial" value={client.nombreComercial} />
          <Info label="Ubicacion" value={[client.departamento, client.provincia, client.distrito].filter(Boolean).join(" / ")} wide />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VehicleInfoDialog({ item, onClose }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(94vw,640px)] bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>Informacion del vehiculo</DialogTitle>
          <DialogDescription>{item.vehiculo}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Marca" value={item.marcaNombre} />
          <Info label="Modelo" value={item.modeloNombre} />
          <Info label="Año" value={item.anio} />
          <Info label="Color" value={item.color} />
          <Info label="Placa" value={item.placas} />
          <Info label="VIN" value={item.vin} />
          <Info label="Kilometraje" value={item.kilometraje} />
          <Info label="Ultimo mantenimiento" value={formatDate(item.historialMantenimientos?.[0]?.fechaVisitaTaller)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, wide = false }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("es-PE");
}
