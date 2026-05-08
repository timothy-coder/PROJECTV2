"use client";

import { useState } from "react";
import { Calendar, Edit3, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProspeccion } from "@/hooks/prospeccion/useProspeccion";
import { hasPerm } from "@/lib/permissions";

export default function ProspeccionPage({ userPermissions }) {
  const data = useProspeccion();
  const [dialog, setDialog] = useState({ open: false, item: null });
  const canView = hasPerm(userPermissions, ["prospeccion", "view"]);
  const canCreate = hasPerm(userPermissions, ["prospeccion", "create"]);
  const canEdit = hasPerm(userPermissions, ["prospeccion", "edit"]);
  const canDelete = hasPerm(userPermissions, ["prospeccion", "delete"]);
  if (!canView) return <div className="rounded-lg bg-white p-4 text-sm text-slate-700">No tienes permiso para ver prospeccion.</div>;
  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <h1 className="mb-4 text-2xl font-bold">Configuracion del sistema</h1>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Stat label="Total de Frecuencias" value={data.stats.total} />
        <Stat label="Minimo" value={`${data.stats.min} dias`} tone="green" />
        <Stat label="Promedio" value={`${data.stats.avg} dias`} tone="purple" />
        <Stat label="Maximo" value={`${data.stats.max} dias`} tone="orange" />
      </div>
      <section className="overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-blue-600 bg-white shadow-sm">
        <div className="flex items-center justify-between bg-blue-50 px-4 py-3">
          <div><h2 className="font-bold text-slate-950">Frecuencia de Mantenimiento</h2><p className="text-xs text-slate-500">Define los intervalos de tiempo para mantenimientos preventivos</p></div>
          {canCreate ? <Button onClick={() => setDialog({ open: true, item: null })}><Plus className="size-4" />Nueva Frecuencia</Button> : null}
        </div>
        <div className="p-4">
          <table className="w-full rounded-lg border border-slate-200 text-sm">
            <thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">ID</th><th className="px-3 py-2 text-left">Dias</th><th className="px-3 py-2 text-left">Estado</th><th className="px-3 py-2 text-right">Acciones</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {data.loading ? <tr><td colSpan={4} className="py-8 text-center"><Loader2 className="inline size-4 animate-spin" /></td></tr> : data.frequencies.map((item) => (
                <tr key={item.id}><td className="px-3 py-2">#{item.id}</td><td className="px-3 py-2 font-bold">{item.dias} <span className="text-xs font-normal">dias</span></td><td className="px-3 py-2"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{item.dias <= 15 ? "Corta" : "Larga"}</span></td><td className="px-3 py-2"><div className="flex justify-end gap-2">{canEdit ? <Button variant="outline" onClick={() => setDialog({ open: true, item })}><Edit3 className="size-4" />Editar</Button> : null}{canDelete ? <Button variant="destructive" onClick={() => data.delete(item.id)}><Trash2 className="size-4" />Eliminar</Button> : null}</div></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {dialog.open ? <FrequencyDialog state={dialog} onClose={() => setDialog({ open: false, item: null })} onSubmit={async (payload) => { if (dialog.item) await data.update(dialog.item.id, payload); else await data.create(payload); setDialog({ open: false, item: null }); }} /> : null}
    </div>
  );
}

function FrequencyDialog({ state, onClose, onSubmit }) {
  const [dias, setDias] = useState(state.item?.dias || "");
  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white text-slate-950">
        <DialogHeader><DialogTitle>{state.item ? "Editar" : "Nueva"} Frecuencia</DialogTitle><DialogDescription>Configura los dias.</DialogDescription></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ dias }); }} className="space-y-4">
          <div className="space-y-2"><Label>Dias</Label><Input type="number" value={dias} onChange={(e) => setDias(e.target.value)} required /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Guardar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Stat({ label, value, tone = "blue" }) {
  const tones = { blue: "border-blue-200 bg-blue-50 text-blue-700", green: "border-emerald-200 bg-emerald-50 text-emerald-700", purple: "border-violet-200 bg-violet-50 text-violet-700", orange: "border-orange-200 bg-orange-50 text-orange-700" };
  return <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}><p className="text-xs font-bold">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p><Calendar className="ml-auto size-8 opacity-25" /></div>;
}
