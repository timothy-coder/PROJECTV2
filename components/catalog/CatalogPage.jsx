"use client";

import { useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, Download, Edit3, ExternalLink, Layers, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCatalog } from "@/hooks/catalog/useCatalog";
import { hasPerm } from "@/lib/permissions";

export default function CatalogPage({ userPermissions }) {
  const data = useCatalog();
  const fileInputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState({});
  const [groupDialog, setGroupDialog] = useState({ open: false, price: null, item: null });
  const [itemDialog, setItemDialog] = useState({ open: false, group: null, item: null });
  const [message, setMessage] = useState("");
  const canView = hasPerm(userPermissions, ["catalogoventa", "view"]);
  const canCreate = hasPerm(userPermissions, ["catalogoventa", "create"]);
  const canEdit = hasPerm(userPermissions, ["catalogoventa", "edit"]);
  const canDelete = hasPerm(userPermissions, ["catalogoventa", "delete"]);
  const canImport = hasPerm(userPermissions, ["catalogoventa", "import"]) || canCreate || canEdit;
  const canExport = hasPerm(userPermissions, ["catalogoventa", "export"]) || canView;

  const filteredPrices = useMemo(() => {
    const text = query.trim().toLowerCase();
    return data.prices.filter((price) => !text || `${price.marcaName} ${price.modeloName} ${price.version}`.toLowerCase().includes(text));
  }, [data.prices, query]);

  async function exportCatalog() {
    const XLSX = await import("xlsx");
    const rows = data.prices.flatMap((price) => price.groups.flatMap((group) => group.items.map((item) => ({
      precio_id: price.id,
      marca: price.marcaName,
      modelo: price.modeloName,
      version: price.version,
      grupo: group.nombre,
      orden_grupo: group.orden,
      grupo_activo: group.isActive ? 1 : 0,
      clave: item.clave,
      valor: item.valor,
      orden_item: item.orden,
      item_activo: item.isActive ? 1 : 0,
    }))));
    const template = [{ precio_id: "", marca: "", modelo: "", version: "", grupo: "", orden_grupo: 0, grupo_activo: 1, clave: "", valor: "", orden_item: 0, item_activo: 1 }];
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "catalogo_specs");
    XLSX.writeFile(workbook, "catalogo_specs.xlsx");
  }

  async function importCatalog(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      const result = await data.importRows(rows);
      setMessage(`Importados ${result.imported} specs.`);
    } catch (error) {
      setMessage(error.message || "No se pudo importar el catalogo.");
    } finally {
      event.target.value = "";
    }
  }

  if (!canView) return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver catalogo.</div>;

  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-violet-700 text-white"><BookOpen className="size-5" /></div>
          <div>
            <h1 className="text-3xl font-bold leading-none text-violet-700">Catalogo</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">Gestiona especificaciones por version de carro</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport ? <Button variant="outline" onClick={exportCatalog}><Download className="size-4" />Exportar</Button> : null}
          {canImport ? <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="size-4" />Importar</Button> : null}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importCatalog} />
        </div>
      </div>
      {message ? <p className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">{message}</p> : null}
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Stat label="Versiones" value={data.stats.prices} />
        <Stat label="Grupos" value={data.stats.groups} />
        <Stat label="Specs" value={data.stats.items} />
        <Stat label="Activas" value={data.stats.activeItems} />
      </div>
      <section className="mb-4 rounded-lg border border-violet-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar marca, modelo o version..." className="pl-9" />
        </div>
      </section>
      <section className="space-y-3 rounded-lg border border-violet-200 bg-white p-4 shadow-sm">
        {data.loading ? <div className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</div> : filteredPrices.map((price) => {
          const isOpen = expanded[price.id] ?? false;
          return (
            <div key={price.id} className="overflow-hidden rounded-lg border border-slate-200">
              <button className="flex w-full items-center justify-between bg-slate-50 px-3 py-3 text-left" onClick={() => setExpanded((current) => ({ ...current, [price.id]: !isOpen }))}>
                <span className="font-bold">{price.marcaName} {price.modeloName} <span className="text-violet-700">{price.version}</span></span>
                <span className="flex items-center gap-2 text-xs text-slate-500">{price.groups.length} grupos <ChevronDown className={`size-4 transition ${isOpen ? "rotate-180" : ""}`} /></span>
              </button>
              {isOpen ? (
                <div className="space-y-3 p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => window.open(`/catalogo/${price.id}`, "_blank", "noopener,noreferrer")}><ExternalLink className="size-4" />Ficha tecnica</Button>
                    {canCreate ? <Button size="sm" onClick={() => setGroupDialog({ open: true, price, item: null })}><Plus className="size-4" />Nuevo Grupo</Button> : null}
                  </div>
                  {price.groups.map((group) => <GroupCard key={group.id} group={group} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} onEditGroup={() => setGroupDialog({ open: true, price, item: group })} onDeleteGroup={() => data.deleteGroup(group.id)} onNewItem={() => setItemDialog({ open: true, group, item: null })} onEditItem={(item) => setItemDialog({ open: true, group, item })} onDeleteItem={(item) => data.deleteItem(item.id)} />)}
                  {!price.groups.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Sin grupos de especificaciones.</p> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>
      {groupDialog.open ? <GroupDialog state={groupDialog} onClose={() => setGroupDialog({ open: false, price: null, item: null })} onSubmit={async (payload) => { if (groupDialog.item) await data.updateGroup(groupDialog.item.id, payload); else await data.createGroup(payload); setGroupDialog({ open: false, price: null, item: null }); }} /> : null}
      {itemDialog.open ? <ItemDialog state={itemDialog} onClose={() => setItemDialog({ open: false, group: null, item: null })} onSubmit={async (payload) => { if (itemDialog.item) await data.updateItem(itemDialog.item.id, payload); else await data.createItem(payload); setItemDialog({ open: false, group: null, item: null }); }} /> : null}
    </div>
  );
}

function GroupCard({ group, canCreate, canEdit, canDelete, onEditGroup, onDeleteGroup, onNewItem, onEditItem, onDeleteItem }) {
  return (
    <div className="rounded-lg border border-blue-100">
      <div className="flex items-center justify-between bg-blue-50 px-3 py-2">
        <div><h3 className="font-bold text-slate-950">{group.nombre}</h3><p className="text-xs text-slate-500">Orden {group.orden} - {group.isActive ? "Activo" : "Inactivo"}</p></div>
        <div className="flex gap-2">{canCreate ? <Button size="sm" variant="outline" onClick={onNewItem}><Plus className="size-4" />Spec</Button> : null}{canEdit ? <Button size="icon" variant="outline" onClick={onEditGroup}><Edit3 className="size-4" /></Button> : null}{canDelete ? <Button size="icon" variant="destructive" onClick={onDeleteGroup}><Trash2 className="size-4" /></Button> : null}</div>
      </div>
      <div className="divide-y divide-slate-200">
        {group.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-3 py-2">
            <div><p className="font-semibold">{item.clave}: <span className="font-normal text-slate-600">{item.valor}</span></p><p className="text-xs text-slate-500">Orden {item.orden} - {item.isActive ? "Activo" : "Inactivo"}</p></div>
            <div className="flex gap-2">{canEdit ? <Button size="icon" variant="outline" onClick={() => onEditItem(item)}><Edit3 className="size-4" /></Button> : null}{canDelete ? <Button size="icon" variant="destructive" onClick={() => onDeleteItem(item)}><Trash2 className="size-4" /></Button> : null}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupDialog({ state, onClose, onSubmit }) {
  const [form, setForm] = useState({ precioId: state.price.id, nombre: state.item?.nombre || "", orden: state.item?.orden ?? 0, isActive: state.item?.isActive ?? true });
  return <EntityDialog title={state.item ? "Editar grupo" : "Nuevo grupo"} onClose={onClose} onSubmit={() => onSubmit(form)}><Field label="Grupo"><Input value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} required /></Field><Field label="Orden"><Input type="number" value={form.orden} onChange={(event) => setForm((current) => ({ ...current, orden: event.target.value }))} /></Field><Toggle label="Activo" checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: Boolean(checked) }))} /></EntityDialog>;
}

function ItemDialog({ state, onClose, onSubmit }) {
  const [form, setForm] = useState({ groupId: state.group.id, clave: state.item?.clave || "", valor: state.item?.valor || "", orden: state.item?.orden ?? 0, isActive: state.item?.isActive ?? true });
  return <EntityDialog title={state.item ? "Editar spec" : "Nueva spec"} onClose={onClose} onSubmit={() => onSubmit(form)}><Field label="Clave"><Input value={form.clave} onChange={(event) => setForm((current) => ({ ...current, clave: event.target.value }))} required /></Field><Field label="Valor"><Textarea value={form.valor} onChange={(event) => setForm((current) => ({ ...current, valor: event.target.value }))} /></Field><Field label="Orden"><Input type="number" value={form.orden} onChange={(event) => setForm((current) => ({ ...current, orden: event.target.value }))} /></Field><Toggle label="Activo" checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: Boolean(checked) }))} /></EntityDialog>;
}

function EntityDialog({ title, children, onClose, onSubmit }) {
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-[min(94vw,480px)] bg-white text-slate-950"><form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="space-y-3"><DialogHeader><DialogTitle className="text-violet-700">{title}</DialogTitle><DialogDescription>Completa la informacion.</DialogDescription></DialogHeader>{children}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Guardar</Button></DialogFooter></form></DialogContent></Dialog>;
}

function Stat({ label, value }) {
  return <div className="flex min-h-20 items-center justify-between rounded-lg border border-violet-200 bg-violet-50 p-4 shadow-sm"><div><p className="text-xs font-bold text-violet-700">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div><Layers className="size-7 text-violet-300" /></div>;
}

function Field({ label, children }) {
  return <div className="space-y-1"><Label className="text-xs font-bold text-slate-600">{label}</Label>{children}</div>;
}

function Toggle({ label, checked, onCheckedChange }) {
  return <label className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50/40 p-3 text-sm font-bold text-violet-700"><Switch checked={checked} onCheckedChange={onCheckedChange} />{label}</label>;
}
