"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Car,
  ChevronDown,
  Download,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserRound,
  Wrench,
} from "lucide-react";

import { ClientDialog } from "@/components/clients/ClientDialog";
import { DeleteClientDialog } from "@/components/clients/DeleteClientDialog";
import { VehicleDialog } from "@/components/clients/VehicleDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClients } from "@/hooks/clients/useClients";
import { hasPerm } from "@/lib/permissions";

function clientName(client) {
  return [client.nombre, client.apellido].filter(Boolean).join(" ") || client.nombreComercial || "-";
}

function formatDate(value) {
  if (!value) return "-";
  const textValue = String(value);
  const dateOnlyMatch = textValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(date);
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function ClientsPage({ userPermissions }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const {
    clients,
    options,
    meta,
    loading,
    error,
    createClient,
    updateClient,
    deleteClient,
    importClients,
    importVehicles,
    importMaintenance,
    recalculateVehicleMaintenance,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    addVehicleMaintenance,
  } = useClients({ page, limit, q: query });

  const fileInputRef = useRef(null);
  const vehicleFileInputRef = useRef(null);
  const maintenanceFileInputRef = useRef(null);
  const tableContainerRef = useRef(null);
  const paginationRef = useRef(null);

  const [importMessage, setImportMessage] = useState("");
  const [vehiclesClient, setVehiclesClient] = useState(null);
  const [clientDialog, setClientDialog] = useState({ mode: null, client: null });
  const [vehicleDialog, setVehicleDialog] = useState({ mode: null, client: null, vehicle: null });
  const [maintenanceDialog, setMaintenanceDialog] = useState({ client: null, vehicle: null });
  const [deleteDialog, setDeleteDialog] = useState({ type: null, client: null, vehicle: null });
  const [recalculatingMaintenance, setRecalculatingMaintenance] = useState(false);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [clientActionsOpenId, setClientActionsOpenId] = useState(null);

  const canCreate = hasPerm(userPermissions, ["clientes", "create"]);
  const canEdit = hasPerm(userPermissions, ["clientes", "edit"]);
  const canDelete = hasPerm(userPermissions, ["clientes", "delete"]);
  const canViewVehicles = hasPerm(userPermissions, ["clientes", "vehicles"]);
  const canImport = hasPerm(userPermissions, ["clientes", "import"]);
  const canExport = hasPerm(userPermissions, ["clientes", "export"]);
  const canImportVehicles = hasPerm(userPermissions, ["clientes", "vehicles_import"]);
  const canExportVehicles = hasPerm(userPermissions, ["clientes", "vehicles_export"]);
  const canImportMaintenance = hasPerm(userPermissions, ["clientes", "maintenance_import"]);
  const canExportMaintenance = hasPerm(userPermissions, ["clientes", "maintenance_export"]);

  const tableColSpan = canViewVehicles ? 8 : 7;
  const total = Number(meta.total || clients.length || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    function updateLimit() {
      const height = window.visualViewport?.height || window.innerHeight || 800;
      const tableTop = tableContainerRef.current?.getBoundingClientRect().top || 260;
      const paginationHeight = paginationRef.current?.getBoundingClientRect().height || 46;
      const tableHeaderHeight = 42;
      const bottomGap = 18;
      const rowHeight = 64;
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

  const activeVehiclesClient = useMemo(() => {
    if (!vehiclesClient) return null;
    return clients.find((client) => client.id === vehiclesClient.id) || vehiclesClient;
  }, [clients, vehiclesClient]);

  async function exportClients() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet([
      {
        id_lead: "",
        nombre: "",
        apellido: "",
        email: "",
        celular: "",
        tipo_identificacion: "DNI",
        identificacion_fiscal: "",
        fecha_nacimiento: "",
        ocupacion: "",
        domicilio: "",
        departamento: "",
        provincia: "",
        distrito: "",
        nombre_conyugue: "",
        dni_conyugue: "",
        nombre_comercial: "",
        created_by: "",
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "clientes");
    XLSX.writeFile(workbook, "clientes.xlsx");
  }

  async function exportVehicles() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet([
      {
        cliente_documento: "",
        cliente_id_lead: "",
        placas: "",
        vin: "",
        marca: "",
        modelo: "",
        anio: "",
        color: "",
        kilometraje: "",
        fecha_ultima_visita: "",
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "vehiculos");
    XLSX.writeFile(workbook, "vehiculos_clientes.xlsx");
  }

  async function exportMaintenance() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet([
      {
        vin: "",
        placas: "",
        fecha_visita_taller: "",
        kilometraje_taller: "",
        created_by: "",
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "mantenimientos");
    XLSX.writeFile(workbook, "mantenimientos_vehiculos.xlsx");
  }

  async function importClientRows(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportMessage("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      const result = await importClients(rows);
      setImportMessage(`Clientes importados ${result.imported}. Actualizados ${result.updated}.`);
    } catch (error) {
      setImportMessage(error.message || "No se pudo importar clientes.");
    } finally {
      event.target.value = "";
    }
  }

  async function importVehicleRows(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportMessage("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      const result = await importVehicles(rows);
      setImportMessage(`Vehiculos importados ${result.imported}. Actualizados ${result.updated}.`);
    } catch (error) {
      setImportMessage(error.message || "No se pudo importar vehiculos.");
    } finally {
      event.target.value = "";
    }
  }

  async function importMaintenanceRows(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportMessage("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      const result = await importMaintenance(rows);
      setImportMessage(`Mantenimientos importados ${result.imported}.`);
    } catch (error) {
      setImportMessage(error.message || "No se pudo importar mantenimientos.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleRecalculateMaintenance() {
    setImportMessage("");
    setRecalculatingMaintenance(true);
    try {
      const result = await recalculateVehicleMaintenance();
      setImportMessage(`Proximo mantenimiento recalculado para ${result.updated || 0} vehiculos.`);
    } catch (error) {
      setImportMessage(error.message || "No se pudo recalcular los mantenimientos.");
    } finally {
      setRecalculatingMaintenance(false);
    }
  }

  return (
    // ✅ página full-height; la tabla será la que scrollea
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 p-3 text-slate-950 md:h-svh sm:p-4">
      {/* ✅ Header + botones import/export siempre arriba */}
      <div className="mb-3 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
            <UserRound className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight text-violet-700">Gestión de Clientes</h1>
            <p className="mt-0.5 text-xs font-medium text-violet-400">Administra clientes y vehículos</p>
          </div>
        </div>

        <div className="relative w-full shrink-0 lg:w-64">
          <Button
            type="button"
            variant="outline"
            onClick={() => setToolbarMenuOpen((value) => !value)}
            className="h-10 w-full justify-center"
          >
            Opciones
            <ChevronDown className={`size-4 transition ${toolbarMenuOpen ? "rotate-180" : ""}`} />
          </Button>

          {toolbarMenuOpen ? (
            <div className="absolute right-0 top-11 z-30 w-full overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
              {canExport ? (
                <MobileMenuItem icon={Download} label="Formato Clientes" onClick={exportClients} close={() => setToolbarMenuOpen(false)} />
              ) : null}
              {canImport ? (
                <MobileMenuItem icon={Upload} label="Importar Clientes" onClick={() => fileInputRef.current?.click()} close={() => setToolbarMenuOpen(false)} />
              ) : null}
              {canExportVehicles ? (
                <MobileMenuItem icon={Download} label="Formato vehiculos" onClick={exportVehicles} close={() => setToolbarMenuOpen(false)} />
              ) : null}
              {canImportVehicles ? (
                <MobileMenuItem icon={Upload} label="Importar vehiculos" onClick={() => vehicleFileInputRef.current?.click()} close={() => setToolbarMenuOpen(false)} />
              ) : null}
              {canExportMaintenance ? (
                <MobileMenuItem icon={Download} label="Formato mantenimientos" onClick={exportMaintenance} close={() => setToolbarMenuOpen(false)} />
              ) : null}
              {canImportMaintenance ? (
                <MobileMenuItem icon={Upload} label="Importar mantenimientos" onClick={() => maintenanceFileInputRef.current?.click()} close={() => setToolbarMenuOpen(false)} />
              ) : null}
              {canImportMaintenance || canViewVehicles ? (
                <MobileMenuItem
                  icon={recalculatingMaintenance ? Loader2 : RefreshCw}
                  label="Recalcular proximos"
                  onClick={handleRecalculateMaintenance}
                  close={() => setToolbarMenuOpen(false)}
                  disabled={recalculatingMaintenance}
                  iconClassName={recalculatingMaintenance ? "animate-spin" : ""}
                />
              ) : null}
            </div>
          ) : null}

          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importClientRows} />
          <input ref={vehicleFileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importVehicleRows} />
          <input ref={maintenanceFileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importMaintenanceRows} />
        </div>
      </div>

      {importMessage ? (
        <p className="mb-3 shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">
          {importMessage}
        </p>
      ) : null}

      {/* ✅ Card principal ocupa el resto */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-violet-600 bg-white shadow-sm">
        {/* ✅ Barra buscar + botón "Nuevo Cliente" al costado; misma altura */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder="Buscar por nombre, apellido, DNI..."
              className="h-10 w-full bg-white pl-9"
            />
          </div>

          {canCreate ? (
            <Button
              onClick={() => setClientDialog({ mode: "create", client: null })}
              className="h-10 shrink-0 bg-violet-700 text-white hover:bg-violet-800"
            >
              <Plus className="size-4" />
              Nuevo Cliente
            </Button>
          ) : null}

        
        </div>

        {error ? (
          <div className="mx-4 mt-3 shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div ref={tableContainerRef} className="min-h-0 flex-1 overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm sm:min-w-[980px]">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Cliente</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Apellido</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">ID Lead</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Celular</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">DNI</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Creado por / propietario</th>
                {canViewVehicles ? <th className="px-3 py-2.5">Vehículos</th> : null}
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-3 py-10 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Cargando clientes...
                    </span>
                  </td>
                </tr>
              ) : clients.length ? (
                clients.map((client) => {
                  const actionsOpen = clientActionsOpenId === client.id;

                  return (
                    <Fragment key={client.id}>
                    <tr className="text-slate-800">
                      <td className="px-3 py-3">
                        <div className="font-semibold">{client.nombre || client.nombreComercial || "-"}</div>
                        <div className="text-xs text-slate-500 sm:hidden">{client.apellido || "-"}</div>
                        <div className="mt-1 text-xs font-medium text-slate-600 sm:hidden">
                          DNI: {client.identificacionFiscal || "-"}
                        </div>
                      </td>
                      <td className="hidden px-3 py-3 sm:table-cell">{client.apellido || "-"}</td>
                      <td className="hidden px-3 py-3 sm:table-cell">{client.idLead || "-"}</td>
                      <td className="hidden px-3 py-3 sm:table-cell">{client.celular || "-"}</td>
                      <td className="hidden px-3 py-3 sm:table-cell">{client.identificacionFiscal || "-"}</td>
                      <td className="hidden px-3 py-3 sm:table-cell">
                        <div className="font-semibold">{client.createdByName || "-"}</div>
                        <div className="text-xs text-slate-500">{formatDate(client.createdAt)}</div>
                      </td>

                      {canViewVehicles ? (
                        <td className="px-3 py-3 text-center sm:text-left">
                          <button
                            type="button"
                            onClick={() => setVehiclesClient(client)}
                            className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700"
                          >
                            {client.vehicles.length}
                          </button>
                        </td>
                      ) : null}

                      <td className="relative px-3 py-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setClientActionsOpenId(actionsOpen ? null : client.id)}
                          className="ml-auto flex h-8 gap-1 px-2 sm:hidden"
                        >
                          Acciones
                          <ChevronDown className={`size-4 transition ${actionsOpen ? "rotate-180" : ""}`} />
                        </Button>

                        {actionsOpen ? (
                          <div className="absolute right-3 top-12 z-20 w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg sm:hidden">
                            {canViewVehicles ? (
                              <MobileMenuItem
                                icon={Car}
                                label="Ver vehiculos"
                                onClick={() => setVehiclesClient(client)}
                                close={() => setClientActionsOpenId(null)}
                              />
                            ) : null}
                            {canEdit ? (
                              <MobileMenuItem
                                icon={Edit3}
                                label="Editar cliente"
                                onClick={() => setClientDialog({ mode: "edit", client })}
                                close={() => setClientActionsOpenId(null)}
                              />
                            ) : null}
                            {canDelete ? (
                              <MobileMenuItem
                                icon={Trash2}
                                label="Eliminar cliente"
                                onClick={() => setDeleteDialog({ type: "client", client, vehicle: null })}
                                close={() => setClientActionsOpenId(null)}
                                className="text-red-600 hover:bg-red-50"
                              />
                            ) : null}
                          </div>
                        ) : null}

                        <div className="hidden justify-end gap-2 sm:flex">
                          {canViewVehicles ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setVehiclesClient(client)}
                              title="Ver vehículos"
                            >
                              <Car className="size-4" />
                            </Button>
                          ) : null}

                          {canEdit ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setClientDialog({ mode: "edit", client })}
                              title="Editar cliente"
                            >
                              <Edit3 className="size-4" />
                            </Button>
                          ) : null}

                          {canDelete ? (
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => setDeleteDialog({ type: "client", client, vehicle: null })}
                              title="Eliminar cliente"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={tableColSpan} className="px-3 py-10 text-center text-slate-500">
                    No hay clientes para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div ref={paginationRef} className="mt-auto grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-200 px-4 py-2 text-xs">
          <span className="font-medium text-slate-500">
            Pagina {currentPage} de {totalPages}
          </span>
          <span className="text-center font-medium text-slate-500">
            {clients.length} de {total} registros
          </span>
          <div className="flex justify-end">
            <PaginationControls loading={loading} page={currentPage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </section>

      <ClientDialog
        open={clientDialog.mode === "create" || clientDialog.mode === "edit"}
        mode={clientDialog.mode}
        client={clientDialog.client}
        options={options}
        onClose={() => setClientDialog({ mode: null, client: null })}
        onSubmit={(payload) =>
          clientDialog.mode === "edit" ? updateClient(clientDialog.client.id, payload) : createClient(payload)
        }
      />

      <VehicleDialog
        open={vehicleDialog.mode === "create" || vehicleDialog.mode === "edit"}
        mode={vehicleDialog.mode}
        client={vehicleDialog.client}
        vehicle={vehicleDialog.vehicle}
        options={options}
        onClose={() => setVehicleDialog({ mode: null, client: null, vehicle: null })}
        onSubmit={(payload) =>
          vehicleDialog.mode === "edit" ? updateVehicle(vehicleDialog.vehicle.id, payload) : createVehicle(payload)
        }
        onAddMaintenance={(vehicle) => setMaintenanceDialog({ client: vehicleDialog.client, vehicle })}
      />

      <VehiclesDialog
        client={activeVehiclesClient}
        open={Boolean(activeVehiclesClient)}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        onClose={() => setVehiclesClient(null)}
        onCreate={() => setVehicleDialog({ mode: "create", client: activeVehiclesClient, vehicle: null })}
        onEdit={(vehicle) => setVehicleDialog({ mode: "edit", client: activeVehiclesClient, vehicle })}
        onDelete={(vehicle) => setDeleteDialog({ type: "vehicle", client: activeVehiclesClient, vehicle })}
        onMaintenance={(vehicle) => setMaintenanceDialog({ client: activeVehiclesClient, vehicle })}
      />

      <MaintenanceDialog
        client={maintenanceDialog.client}
        vehicle={maintenanceDialog.vehicle}
        open={Boolean(maintenanceDialog.vehicle)}
        onClose={() => setMaintenanceDialog({ client: null, vehicle: null })}
        onSubmit={(vehicleId, payload) => addVehicleMaintenance(vehicleId, payload)}
      />

      <DeleteClientDialog
        open={Boolean(deleteDialog.type)}
        title={deleteDialog.type === "vehicle" ? "Eliminar vehículo" : "Eliminar cliente"}
        description={
          deleteDialog.type === "vehicle"
            ? `Se eliminará el vehículo ${deleteDialog.vehicle?.placas || ""}.`
            : `Se eliminará el cliente ${deleteDialog.client ? clientName(deleteDialog.client) : ""}.`
        }
        onClose={() => setDeleteDialog({ type: null, client: null, vehicle: null })}
        onConfirm={() => (deleteDialog.type === "vehicle" ? deleteVehicle(deleteDialog.vehicle.id) : deleteClient(deleteDialog.client.id))}
      />
    </div>
  );
}

function MobileMenuItem({ icon: Icon, label, onClick, close, disabled = false, className = "", iconClassName = "" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onClick?.();
        close?.();
      }}
      className={[
        "flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {Icon ? <Icon className={["size-4", iconClassName].filter(Boolean).join(" ")} /> : null}
      {label}
    </button>
  );
}

function PaginationControls({ loading, page, totalPages, onPageChange, compact = false }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        disabled={loading || page <= 1}
        onClick={() => onPageChange((value) => Math.max(1, value - 1))}
      >
        Anterior
      </Button>
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        disabled={loading || page >= totalPages}
        onClick={() => onPageChange((value) => value + 1)}
      >
        Siguiente
      </Button>
    </div>
  );
}

function VehiclesDialog({
  client,
  open,
  canCreate,
  canEdit,
  canDelete,
  onClose,
  onCreate,
  onEdit,
  onDelete,
  onMaintenance,
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[92svh] w-[min(96vw,860px)] max-w-none overflow-hidden bg-white p-0 text-slate-950">
        {client ? (
          <VehiclesPanel
            client={client}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
            onCreate={onCreate}
            onEdit={onEdit}
            onDelete={onDelete}
            onMaintenance={onMaintenance}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function VehiclesPanel({ client, canCreate, canEdit, canDelete, onCreate, onEdit, onDelete, onMaintenance }) {
  return (
    <div className="flex max-h-[92svh] flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
            <Car className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-950">Vehículos de {client.nombre || client.nombreComercial}</h3>
            <p className="text-xs font-medium text-slate-500">Gestiona los vehículos de este cliente</p>
          </div>
        </div>
        {canCreate ? (
          <Button onClick={onCreate} className="h-10 bg-violet-700 text-white hover:bg-violet-800">
            <Plus className="size-4" />
            Nuevo Vehículo
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 overflow-y-auto p-4">
        <p className="mb-3 text-sm font-bold text-slate-950">Vehículos</p>
        <p className="mb-3 text-xs text-slate-500">Cliente: {clientName(client)}</p>

        <div className="space-y-2">
          {client.vehicles.length ? (
            client.vehicles.map((vehicle) => (
              <div key={vehicle.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-violet-100 px-2 py-1 text-sm font-bold text-violet-700">{vehicle.placas}</span>
                    <span className="font-bold text-slate-950">
                      {[vehicle.marcaName, vehicle.modeloName].filter(Boolean).join(" ") || `Vehículo ${vehicle.id}`}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">VIN: {vehicle.vin || "-"}</p>
                  <p className="text-xs text-slate-500">Proximo mantenimiento: {formatDate(vehicle.fechaUltimaVisita)}</p>
                </div>

                <div className="flex shrink-0 gap-2">
                  {canEdit ? (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onMaintenance(vehicle)}
                      title="Agregar mantenimiento"
                    >
                      <Wrench className="size-4" />
                    </Button>
                  ) : null}
                  {canEdit ? (
                    <Button variant="ghost" size="icon" onClick={() => onEdit(vehicle)}>
                      <Edit3 className="size-4" />
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button variant="destructive" size="icon" onClick={() => onDelete(vehicle)}>
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
              No hay vehículos registrados.
            </div>
          )}
        </div>

        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
          Total de vehículos: {client.vehicles.length}
        </div>
      </div>
    </div>
  );
}

function MaintenanceDialog({ client, vehicle, open, onClose, onSubmit }) {
  const [fechaVisitaTaller, setFechaVisitaTaller] = useState(todayInputDate());
  const [kilometrajeTaller, setKilometrajeTaller] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!vehicle?.id) return;

    setSaving(true);
    setMessage("");
    try {
      await onSubmit(vehicle.id, {
        fechaVisitaTaller,
        kilometrajeTaller,
      });
      setFechaVisitaTaller(todayInputDate());
      setKilometrajeTaller("");
      onClose();
    } catch (error) {
      setMessage(error.message || "No se pudo registrar el mantenimiento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="w-[min(94vw,430px)] max-w-none bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-slate-200 px-4 py-3">
          <DialogTitle className="text-lg font-bold text-violet-700">Agregar mantenimiento</DialogTitle>
          <p className="text-xs font-medium text-slate-500">
            {client ? clientName(client) : ""} {vehicle?.placas ? `- ${vehicle.placas}` : ""}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {message ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {message}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Fecha de visita al taller</Label>
            <Input
              type="date"
              value={fechaVisitaTaller}
              onChange={(event) => setFechaVisitaTaller(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Kilometraje</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={kilometrajeTaller}
              onChange={(event) => setKilometrajeTaller(event.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Wrench className="size-4" />}
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
