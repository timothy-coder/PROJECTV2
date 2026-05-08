"use client";

import { useMemo, useState } from "react";
import { Eye, Plus, RefreshCw, Search } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePostventaOpportunities } from "@/hooks/postventa/usePostventaOpportunities";
import { hasPerm } from "@/lib/permissions";

function permissionKey(kind) {
  return kind === "lead" ? "leadspv" : "oportunidadespv";
}

export default function PostventaOpportunitiesPage({ userPermissions, kind = "opportunity" }) {
  const data = usePostventaOpportunities(kind);
  const [query, setQuery] = useState("");
  const [stageId, setStageId] = useState("");
  const perm = permissionKey(kind);
  const canViewAll = Boolean(hasPerm(userPermissions, [perm, "viewall"]) || data.currentUser?.canViewAll);
  const canView = Boolean(hasPerm(userPermissions, [perm, "view"]) || canViewAll);
  const canCreate = hasPerm(userPermissions, [perm, "create"]);
  const canOpenMaintenance = Boolean(hasPerm(userPermissions, ["oportunidadespv", "view"]) || hasPerm(userPermissions, ["oportunidadespv", "viewall"]));
  const copy = kind === "lead"
    ? { title: "Leads PostVenta", subtitle: "Gestiona los leads de PostVenta" }
    : { title: "Oportunidades PostVenta", subtitle: "Gestiona oportunidades de mantenimiento y citas" };
  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return data.opportunities.filter((item) => {
      const matchesText = !text || `${item.code} ${item.clienteNombre} ${item.vehiculoNombre} ${item.placa}`.toLowerCase().includes(text);
      const matchesStage = !stageId || Number(item.etapaId) === Number(stageId);
      return matchesText && matchesStage;
    });
  }, [data.opportunities, query, stageId]);
  if (!canView) return <div className="rounded-lg bg-white p-4 text-sm text-slate-700">No tienes permiso para ver esta pagina.</div>;
  return (
    <div className="min-w-0 bg-slate-50 p-4 text-slate-950">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-violet-700">{copy.title}</h1>
          <p className="text-sm text-slate-500">{copy.subtitle} {canViewAll ? "- Vista completa" : "- Mi vista"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={data.reload}><RefreshCw className="size-4" />Actualizar</Button>
          {canCreate && canOpenMaintenance ? <Button className="bg-violet-700 text-white hover:bg-violet-800" onClick={() => { window.location.href = "/proximosmantenimientos"; }}><Plus className="size-4" />Desde mantenimiento</Button> : null}
        </div>
      </header>
      <section className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[320px_240px_120px]">
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Buscar cliente, vehiculo..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <SearchableSelect value={stageId} options={[{ value: "", label: "Todas las etapas" }, ...data.options.stages.map((item) => ({ value: item.id, label: item.nombre }))]} onChange={setStageId} />
          <Button variant="outline" onClick={() => { setQuery(""); setStageId(""); }}>Limpiar</Button>
        </div>
      </section>
      <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-700">
              <tr><th className="px-3 py-3">Codigo</th><th>Cliente</th><th>Vehiculo</th><th>Origen</th><th>Etapa</th><th>Asignado</th><th>Fecha agenda</th><th className="text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 font-bold text-blue-700">{item.code}</td>
                  <td>{item.clienteNombre}</td>
                  <td>{item.vehiculoNombre}</td>
                  <td>{item.origenNombre}</td>
                  <td><span className="rounded-full px-2 py-1 text-xs font-bold" style={{ color: item.etapaColor, backgroundColor: `${item.etapaColor}1f` }}>{item.etapaNombre}</span></td>
                  <td>{item.asignadoNombre}</td>
                  <td>{item.agendaDate ? `${item.agendaDate} ${item.agendaTime}` : "-"}</td>
                  <td className="px-3 text-right"><Button size="icon" variant="ghost"><Eye className="size-4" /></Button></td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={8} className="py-10 text-center text-slate-500">{data.loading ? "Cargando..." : "No hay registros"}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
