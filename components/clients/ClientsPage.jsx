"use client";

import { Fragment, useMemo, useState } from "react";
import { Car, Edit3, Loader2, Plus, Search, Trash2, UserRound } from "lucide-react";

import { ClientDialog } from "@/components/clients/ClientDialog";
import { DeleteClientDialog } from "@/components/clients/DeleteClientDialog";
import { VehicleDialog } from "@/components/clients/VehicleDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClients } from "@/hooks/clients/useClients";
import { hasPerm } from "@/lib/permissions";

function clientName(client) {
  return [client.nombre, client.apellido].filter(Boolean).join(" ") || client.nombreComercial || "-";
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(value));
}

export default function ClientsPage({ userPermissions }) {
  const {
    clients,
    options,
    loading,
    error,
    createClient,
    updateClient,
    deleteClient,
    createVehicle,
    updateVehicle,
    deleteVehicle,
  } = useClients();
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [clientDialog, setClientDialog] = useState({ mode: null, client: null });
  const [vehicleDialog, setVehicleDialog] = useState({ mode: null, client: null, vehicle: null });
  const [deleteDialog, setDeleteDialog] = useState({ type: null, client: null, vehicle: null });
  const canCreate = hasPerm(userPermissions, ["clientes", "create"]);
  const canEdit = hasPerm(userPermissions, ["clientes", "edit"]);
  const canDelete = hasPerm(userPermissions, ["clientes", "delete"]);
  const canViewVehicles = hasPerm(userPermissions, ["clientes", "vehicles"]);
  const tableColSpan = canViewVehicles ? 7 : 6;
  const filteredClients = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return clients;
    return clients.filter((client) =>
      [
        client.nombre,
        client.apellido,
        client.nombreComercial,
        client.idLead,
        client.identificacionFiscal,
        client.celular,
        client.email,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(clean))
    );
  }, [clients, query]);

  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-3 text-slate-950 sm:p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
            <UserRound className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight text-slate-950">Gestión de Clientes</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">Administra clientes y vehículos</p>
          </div>
        </div>
        {canCreate ? (
          <Button onClick={() => setClientDialog({ mode: "create", client: null })} className="bg-violet-700 text-white hover:bg-violet-800">
            <Plus className="size-4" />
            Nuevo Cliente
          </Button>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-violet-600 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, apellido, DNI..."
              className="h-9 bg-white pl-9"
            />
          </div>
        </div>

        {error ? (
          <div className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Nombre</th>
                <th className="px-3 py-2.5">Apellido</th>
                <th className="px-3 py-2.5">ID Lead</th>
                <th className="px-3 py-2.5">Celular</th>
                <th className="px-3 py-2.5">DNI</th>
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
              ) : filteredClients.length ? (
                filteredClients.map((client) => (
                  <Fragment key={client.id}>
                    <tr className="text-slate-800">
                      <td className="px-3 py-3 font-semibold">{client.nombre || client.nombreComercial || "-"}</td>
                      <td className="px-3 py-3">{client.apellido || "-"}</td>
                      <td className="px-3 py-3">{client.idLead || "-"}</td>
                      <td className="px-3 py-3">{client.celular || "-"}</td>
                      <td className="px-3 py-3">{client.identificacionFiscal || "-"}</td>
                      {canViewVehicles ? <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
                          className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700"
                        >
                          {client.vehicles.length}
                        </button>
                      </td> : null}
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          {canViewVehicles ? <Button variant="ghost" size="icon" onClick={() => setExpandedId(expandedId === client.id ? null : client.id)} title="Ver vehículos">
                            <Car className="size-4" />
                          </Button> : null}
                          {canEdit ? (
                            <Button variant="ghost" size="icon" onClick={() => setClientDialog({ mode: "edit", client })} title="Editar cliente">
                              <Edit3 className="size-4" />
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button variant="destructive" size="icon" onClick={() => setDeleteDialog({ type: "client", client, vehicle: null })} title="Eliminar cliente">
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {canViewVehicles && expandedId === client.id ? (
                      <tr>
                        <td colSpan={tableColSpan} className="bg-white p-0">
                          <VehiclesPanel
                            client={client}
                            canCreate={canCreate}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            onCreate={() => setVehicleDialog({ mode: "create", client, vehicle: null })}
                            onEdit={(vehicle) => setVehicleDialog({ mode: "edit", client, vehicle })}
                            onDelete={(vehicle) => setDeleteDialog({ type: "vehicle", client, vehicle })}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
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
      </section>

      <ClientDialog
        open={clientDialog.mode === "create" || clientDialog.mode === "edit"}
        mode={clientDialog.mode}
        client={clientDialog.client}
        options={options}
        onClose={() => setClientDialog({ mode: null, client: null })}
        onSubmit={(payload) =>
          clientDialog.mode === "edit"
            ? updateClient(clientDialog.client.id, payload)
            : createClient(payload)
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
          vehicleDialog.mode === "edit"
            ? updateVehicle(vehicleDialog.vehicle.id, payload)
            : createVehicle(payload)
        }
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
        onConfirm={() =>
          deleteDialog.type === "vehicle"
            ? deleteVehicle(deleteDialog.vehicle.id)
            : deleteClient(deleteDialog.client.id)
        }
      />
    </div>
  );
}

function VehiclesPanel({ client, canCreate, canEdit, canDelete, onCreate, onEdit, onDelete }) {
  return (
    <div className="border-l-4 border-l-violet-600 bg-white">
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
          <Button onClick={onCreate} className="bg-violet-700 text-white hover:bg-violet-800">
            <Plus className="size-4" />
            Nuevo Vehículo
          </Button>
        ) : null}
      </div>
      <div className="p-4">
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
                  <p className="text-xs text-slate-500">Última visita: {formatDate(vehicle.fechaUltimaVisita)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {canEdit ? <Button variant="ghost" size="icon" onClick={() => onEdit(vehicle)}><Edit3 className="size-4" /></Button> : null}
                  {canDelete ? <Button variant="destructive" size="icon" onClick={() => onDelete(vehicle)}><Trash2 className="size-4" /></Button> : null}
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
