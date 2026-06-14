"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, ChevronDown, Download, Edit3, ExternalLink, Layers, Loader2, Plus, Search, Send, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

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
  const [expandedGroups, setExpandedGroups] = useState({});
  const [groupDialog, setGroupDialog] = useState({ open: false, price: null, item: null });
  const [itemDialog, setItemDialog] = useState({ open: false, group: null, item: null });
  const [sendDialog, setSendDialog] = useState({ open: false, price: null });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, title: "", description: "", onConfirm: null });
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
      marca: price.marcaName,
      modelo: price.modeloName,
      version: price.version,
      grupo: group.nombre,
      orden_grupo: group.orden,
      grupo_activo: group.isActive ? 1 : 0,
      clave: item.clave,
      valor: item.valor,
      tipo_valor: item.valorTipo || "TEXTO",
      url: item.valorUrl || "",
      archivo: item.valorPath || "",
      orden_item: item.orden,
      item_activo: item.isActive ? 1 : 0,
    }))));
    const template = [{ marca: "", modelo: "", version: "", grupo: "", orden_grupo: 0, grupo_activo: 1, clave: "", tipo_valor: "TEXTO", valor: "", url: "", archivo: "", orden_item: 0, item_activo: 1 }];
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
      toast.success("Catalogo importado", { description: `Se importaron ${result.imported} especificaciones.` });
    } catch (error) {
      setMessage(error.message || "No se pudo importar el catalogo.");
      toast.error("No se pudo importar", { description: error.message || "Revisa el formato del archivo." });
    } finally {
      event.target.value = "";
    }
  }

  async function openTechnicalSheetPdf(price) {
    try {
      const response = await fetch(`/api/catalog/pdf/${price.id}`, { credentials: "include" });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.message || "No se pudo descargar la ficha tecnica.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ficha-tecnica-${price.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("No se pudo descargar", { description: error.message || "Revisa la ficha tecnica." });
    }
  }

  if (!canView) return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver catalogo.</div>;

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 p-3 text-slate-950 md:h-svh sm:p-4">
      <div className="mb-3 flex shrink-0 flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
            <BookOpen className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-violet-700">Catalogo</h1>
            <p className="mt-0.5 text-xs font-medium text-violet-400">Gestiona especificaciones por version de carro</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport || canImport ? (
            <div className="relative">
              <Button variant="outline" onClick={() => setOptionsOpen((current) => !current)} className="h-9">
                <Download className="size-4" />
                Opciones
                <ChevronDown className={`size-4 transition ${optionsOpen ? "rotate-180" : ""}`} />
              </Button>
              {optionsOpen ? (
                <div className="absolute left-0 z-30 mt-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg sm:left-auto sm:right-0">
                  {canExport ? (
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-violet-50 hover:text-violet-700" onClick={() => { setOptionsOpen(false); exportCatalog(); }}>
                      <Download className="size-4" />
                      Exportar
                    </button>
                  ) : null}
                  {canImport ? (
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-violet-50 hover:text-violet-700" onClick={() => { setOptionsOpen(false); fileInputRef.current?.click(); }}>
                      <Upload className="size-4" />
                      Importar
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importCatalog} />
        </div>
      </div>
      {message ? <p className="mb-3 shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">{message}</p> : null}
      <div className="mb-3 grid grid-cols-4 shrink-0 gap-1.5 sm:gap-2">
        <Stat label="Versiones" value={data.stats.prices} />
        <Stat label="Grupos" value={data.stats.groups} />
        <Stat label="Specs" value={data.stats.items} />
        <Stat label="Activas" value={data.stats.activeItems} />
      </div>
      <section className="shrink-0 rounded-t-lg border border-b-0 border-violet-200 bg-white px-3 py-2 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar marca, modelo o version..." className="h-9 bg-white pl-9" />
        </div>
      </section>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-lg border border-violet-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 space-y-2 overflow-auto overscroll-contain p-3">
          {data.loading ? <div className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</div> : filteredPrices.map((price) => {
            const isOpen = expanded[price.id] ?? false;
            return (
              <div key={price.id} className="overflow-visible rounded-lg border border-slate-200">
                <button className="flex w-full items-center justify-between bg-slate-50 px-3 py-2.5 text-left" onClick={() => setExpanded((current) => ({ ...current, [price.id]: !isOpen }))}>
                  <span className="min-w-0 pr-2 text-[13px] font-bold leading-tight sm:text-base">{price.marcaName} {price.modeloName} <span className="text-violet-700">{price.version}</span></span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">{price.groups.length} grupos <ChevronDown className={`size-4 transition ${isOpen ? "rotate-180" : ""}`} /></span>
                </button>
                {isOpen ? (
                  <div className="space-y-2 p-2.5">
                    <PriceActions
                      price={price}
                      canCreate={canCreate}
                      onOpenFicha={() => window.open(`/catalogo/${price.id}`, "_blank", "noopener,noreferrer")}
                      onDownloadPdf={() => openTechnicalSheetPdf(price)}
                      onSend={() => setSendDialog({ open: true, price })}
                      onNewGroup={() => setGroupDialog({ open: true, price, item: null })}
                    />
                    {price.groups.map((group) => {
                      const groupOpen = expandedGroups[group.id] ?? false;
                      return (
                        <GroupCard
                          key={group.id}
                          group={group}
                          isOpen={groupOpen}
                          onToggle={() => setExpandedGroups((current) => ({ ...current, [group.id]: !groupOpen }))}
                          canCreate={canCreate}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          onEditGroup={() => setGroupDialog({ open: true, price, item: group })}
                          onDeleteGroup={() => setDeleteConfirm({
                            open: true,
                            title: "Eliminar grupo",
                            description: `Se eliminara el grupo "${group.nombre}" y sus especificaciones. Esta accion no se puede deshacer.`,
                            onConfirm: async () => { await data.deleteGroup(group.id); toast.success("Grupo eliminado"); },
                          })}
                          onNewItem={() => setItemDialog({ open: true, group, item: null })}
                          onEditItem={(item) => setItemDialog({ open: true, group, item })}
                          onDeleteItem={(item) => setDeleteConfirm({
                            open: true,
                            title: "Eliminar especificacion",
                            description: `Se eliminara la especificacion "${item.clave}". Esta accion no se puede deshacer.`,
                            onConfirm: async () => { await data.deleteItem(item.id); toast.success("Spec eliminada"); },
                          })}
                        />
                      );
                    })}
                    {!price.groups.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Sin grupos de especificaciones.</p> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          <span className="font-medium">Pagina 1 de 1</span>
          <span className="text-center font-medium">{filteredPrices.length} de {data.prices.length} registros</span>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled className="h-9">
              Anterior
            </Button>
            <Button variant="outline" disabled className="h-9">
              Siguiente
            </Button>
          </div>
        </div>
      </section>
      {groupDialog.open ? <GroupDialog state={groupDialog} onClose={() => setGroupDialog({ open: false, price: null, item: null })} onSubmit={async (payload) => { if (groupDialog.item) { await data.updateGroup(groupDialog.item.id, payload); toast.success("Grupo actualizado"); } else { await data.createGroup(payload); toast.success("Grupo creado"); } setGroupDialog({ open: false, price: null, item: null }); }} /> : null}
      {itemDialog.open ? <ItemDialog state={itemDialog} data={data} onClose={() => setItemDialog({ open: false, group: null, item: null })} onSubmit={async (payload) => { if (itemDialog.item) { await data.updateItem(itemDialog.item.id, payload); toast.success("Spec actualizada"); } else { await data.createItem(payload); toast.success("Spec creada"); } setItemDialog({ open: false, group: null, item: null }); }} /> : null}
      {sendDialog.open ? <SendTechnicalSheetDialog state={sendDialog} onClose={() => setSendDialog({ open: false, price: null })} /> : null}
      {deleteConfirm.open ? <ConfirmDeleteDialog state={deleteConfirm} onClose={() => setDeleteConfirm({ open: false, title: "", description: "", onConfirm: null })} /> : null}
    </div>
  );
}

function SendTechnicalSheetDialog({ state, onClose }) {
  const price = state.price;
  const fichaUrl = typeof window !== "undefined" ? `${window.location.origin}/catalogo/${price.id}` : `/catalogo/${price.id}`;
  const [form, setForm] = useState({
    phone: "",
    text: `Hola, te comparto la ficha tecnica de ${price.marcaName} ${price.modeloName} ${price.version}: ${fichaUrl}`,
  });

  function handleSubmit(event) {
    event.preventDefault();
    const phone = form.phone.replace(/\D/g, "");
    if (!phone) {
      toast.error("Ingresa un numero de WhatsApp");
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(form.text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(94vw,520px)] rounded-xl bg-white text-slate-950">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-violet-700">Enviar ficha tecnica</DialogTitle>
            <DialogDescription>Completa el numero y mensaje para abrir WhatsApp.</DialogDescription>
          </DialogHeader>
          <Field label="Numero">
            <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="51999999999" />
          </Field>
          <Field label="Mensaje">
            <Textarea value={form.text} onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))} className="min-h-28" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-violet-700 text-white hover:bg-violet-800"><Send className="size-4" />Abrir WhatsApp</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PriceActions({ canCreate, onOpenFicha, onDownloadPdf, onSend, onNewGroup }) {
  return (
    <div className="flex justify-end sm:justify-start">
      <MobileActionsDropdown
        label="Opciones"
        icon={ExternalLink}
        width={192}
        actions={[
          { icon: ExternalLink, label: "Ficha tecnica", onClick: onOpenFicha },
          { icon: Download, label: "Descargar PDF", onClick: onDownloadPdf },
          { icon: Send, label: "Enviar a", onClick: onSend },
          canCreate ? { icon: Plus, label: "Nuevo Grupo", onClick: onNewGroup } : null,
        ]}
      />
      <div className="hidden flex-wrap gap-2 sm:flex">
        <Button size="sm" variant="outline" className="h-8" onClick={onOpenFicha}><ExternalLink className="size-4" />Ficha tecnica</Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onDownloadPdf}><Download className="size-4" />Descargar PDF</Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onSend}><Send className="size-4" />Enviar a</Button>
        {canCreate ? <Button size="sm" className="h-8" onClick={onNewGroup}><Plus className="size-4" />Nuevo Grupo</Button> : null}
      </div>
    </div>
  );
}

function MobileActionsDropdown({ label, icon: Icon, actions, width = 176 }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const visibleActions = actions.filter(Boolean);

  function toggleMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 8;
    const menuHeight = Math.max(48, visibleActions.length * 40 + 8);
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const belowTop = rect.bottom + gap;
    const aboveTop = rect.top - menuHeight - gap;
    const top = belowTop + menuHeight <= window.innerHeight - 8 ? belowTop : Math.max(8, aboveTop);
    setPosition({ left, top });
    setOpen((current) => !current);
  }

  const menu = open && position && typeof document !== "undefined" ? createPortal(
    <div className="fixed z-[100] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl" style={{ left: position.left, top: position.top, width }}>
      {visibleActions.map((action) => (
        <ActionMenuItem key={action.label} icon={action.icon} label={action.label} onClick={() => { setOpen(false); action.onClick(); }} />
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={buttonRef} className="sm:hidden">
      <Button size="sm" variant="outline" className="h-8" onClick={toggleMenu}>
        {Icon ? <Icon className="size-4" /> : null}
        {label}
        <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
      </Button>
      {menu}
    </div>
  );
}

function ActionMenuItem({ icon: Icon, label, onClick }) {
  return (
    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-violet-50 hover:text-violet-700" onClick={onClick}>
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function GroupCard({ group, isOpen, onToggle, canCreate, canEdit, canDelete, onEditGroup, onDeleteGroup, onNewItem, onEditItem, onDeleteItem }) {
  return (
    <div className="overflow-visible rounded-lg border border-blue-100">
      <div className="flex items-center justify-between gap-2 bg-blue-50 px-3 py-2">
        <button type="button" className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left" onClick={onToggle}>
          <div className="min-w-0"><h3 className="truncate font-bold text-slate-950">{group.nombre}</h3><p className="text-xs text-slate-500">Orden {group.orden} - {group.isActive ? "Activo" : "Inactivo"} - {group.items.length} specs</p></div>
          <ChevronDown className={`size-4 shrink-0 text-blue-700 transition ${isOpen ? "rotate-180" : ""}`} />
        </button>
        <GroupActions canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} onNewItem={onNewItem} onEditGroup={onEditGroup} onDeleteGroup={onDeleteGroup} />
      </div>
      {isOpen ? <div className="divide-y divide-slate-200">
        {group.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0"><p className="font-semibold">{item.clave}: <SpecValuePreview item={item} /></p><p className="text-xs text-slate-500">Orden {item.orden} - {item.isActive ? "Activo" : "Inactivo"}</p></div>
            <ItemActions canEdit={canEdit} canDelete={canDelete} onEditItem={() => onEditItem(item)} onDeleteItem={() => onDeleteItem(item)} />
          </div>
        ))}
        {!group.items.length ? <div className="px-3 py-4 text-sm text-slate-500">Sin specs en este grupo.</div> : null}
      </div> : null}
    </div>
  );
}

function GroupActions({ canCreate, canEdit, canDelete, onNewItem, onEditGroup, onDeleteGroup }) {
  return (
    <div className="shrink-0">
      <MobileActionsDropdown
        label="Acciones"
        actions={[
          canCreate ? { icon: Plus, label: "Spec", onClick: onNewItem } : null,
          canEdit ? { icon: Edit3, label: "Editar grupo", onClick: onEditGroup } : null,
          canDelete ? { icon: Trash2, label: "Eliminar grupo", onClick: onDeleteGroup } : null,
        ]}
      />
      <div className="hidden shrink-0 gap-2 sm:flex">
        {canCreate ? <Button size="sm" variant="outline" className="h-8" onClick={onNewItem}><Plus className="size-4" />Spec</Button> : null}
        {canEdit ? <Button size="icon" variant="outline" className="size-8" onClick={onEditGroup}><Edit3 className="size-4" /></Button> : null}
        {canDelete ? <Button size="icon" variant="destructive" className="size-8" onClick={onDeleteGroup}><Trash2 className="size-4" /></Button> : null}
      </div>
    </div>
  );
}

function ItemActions({ canEdit, canDelete, onEditItem, onDeleteItem }) {
  if (!canEdit && !canDelete) return null;

  return (
    <div className="shrink-0">
      <MobileActionsDropdown
        label="Acciones"
        actions={[
          canEdit ? { icon: Edit3, label: "Editar", onClick: onEditItem } : null,
          canDelete ? { icon: Trash2, label: "Eliminar", onClick: onDeleteItem } : null,
        ]}
      />
      <div className="hidden shrink-0 gap-2 sm:flex">
        {canEdit ? <Button size="icon" variant="outline" className="size-8" onClick={onEditItem}><Edit3 className="size-4" /></Button> : null}
        {canDelete ? <Button size="icon" variant="destructive" className="size-8" onClick={onDeleteItem}><Trash2 className="size-4" /></Button> : null}
      </div>
    </div>
  );
}

function GroupDialog({ state, onClose, onSubmit }) {
  const [form, setForm] = useState({ precioId: state.price.id, nombre: state.item?.nombre || "", orden: state.item?.orden ?? 0, isActive: state.item?.isActive ?? true });
  return <EntityDialog title={state.item ? "Editar grupo" : "Nuevo grupo"} onClose={onClose} onSubmit={() => onSubmit(form)}><Field label="Grupo"><Input value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} required /></Field><Field label="Orden"><Input type="number" value={form.orden} onChange={(event) => setForm((current) => ({ ...current, orden: event.target.value }))} /></Field><Toggle label="Activo" checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: Boolean(checked) }))} /></EntityDialog>;
}

function ItemDialog({ state, data, onClose, onSubmit }) {
  const [form, setForm] = useState({
    groupId: state.group.id,
    clave: state.item?.clave || "",
    valorTipo: state.item?.valorTipo || "TEXTO",
    valor: state.item?.valor || "",
    valorUrl: state.item?.valorUrl || "",
    valorPath: state.item?.valorPath || "",
    orden: state.item?.orden ?? 0,
    isActive: state.item?.isActive ?? true,
  });
  const [uploading, setUploading] = useState(false);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await data.upload(file, form.valorTipo);
      setForm((current) => ({ ...current, valorPath: uploaded.path, valor: current.valor || file.name }));
      toast.success("Archivo subido");
    } catch (error) {
      toast.error("No se pudo subir", { description: error.message });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <EntityDialog title={state.item ? "Editar spec" : "Nueva spec"} onClose={onClose} onSubmit={() => onSubmit(form)}>
      <Field label="Clave"><Input value={form.clave} onChange={(event) => setForm((current) => ({ ...current, clave: event.target.value }))} required /></Field>
      <Field label="Tipo de valor">
        <select value={form.valorTipo} onChange={(event) => setForm((current) => ({ ...current, valorTipo: event.target.value, valorUrl: "", valorPath: "" }))} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
          <option value="TEXTO">Texto</option>
          <option value="LINK">Link</option>
          <option value="IMAGEN">Imagen</option>
          <option value="VIDEO">Video</option>
        </select>
      </Field>
      <Field label={form.valorTipo === "LINK" ? "Texto del enlace" : form.valorTipo === "TEXTO" ? "Valor" : "Descripcion"}>
        {form.valorTipo === "TEXTO" ? <Textarea value={form.valor} onChange={(event) => setForm((current) => ({ ...current, valor: event.target.value }))} /> : <Input value={form.valor} onChange={(event) => setForm((current) => ({ ...current, valor: event.target.value }))} />}
      </Field>
      {form.valorTipo === "LINK" ? <Field label="URL"><Input value={form.valorUrl} placeholder="https://" onChange={(event) => setForm((current) => ({ ...current, valorUrl: event.target.value }))} /></Field> : null}
      {["IMAGEN", "VIDEO"].includes(form.valorTipo) ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Field label={form.valorTipo === "IMAGEN" ? "Imagen" : "Video"}><Input type="file" accept={form.valorTipo === "IMAGEN" ? ".jpg,.jpeg,.png,image/jpeg,image/png" : "video/*"} onChange={handleUpload} disabled={uploading} /></Field>
          {form.valorPath ? <SpecValuePreview item={form} large /> : <p className="text-xs font-medium text-slate-500">{uploading ? "Subiendo..." : "Selecciona un archivo para guardarlo en el sistema."}</p>}
        </div>
      ) : null}
      <Field label="Orden"><Input type="number" value={form.orden} onChange={(event) => setForm((current) => ({ ...current, orden: event.target.value }))} /></Field>
      <Toggle label="Activo" checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: Boolean(checked) }))} />
    </EntityDialog>
  );
}

function SpecValuePreview({ item, large = false }) {
  const href = getSpecMediaHref(item);
  if (item.valorTipo === "LINK") return <a href={href} onClick={(event) => event.stopPropagation()} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">{item.valor || href}</a>;
  if (item.valorTipo === "IMAGEN") return href ? <img src={href} alt={item.valor || "Imagen"} className={large ? "max-h-48 rounded-md border object-contain" : "ml-2 inline-block max-h-12 max-w-24 rounded border object-contain align-middle"} /> : <span className="font-normal text-slate-500">Imagen sin archivo</span>;
  if (item.valorTipo === "VIDEO") return href ? <video src={href} controls={large} className={large ? "max-h-48 w-full rounded-md border" : "ml-2 inline-block h-12 w-24 rounded border align-middle"} /> : <span className="font-normal text-slate-500">Video sin archivo</span>;
  return <span className="font-normal text-slate-600">{item.valor}</span>;
}

function getSpecMediaHref(item) {
  if (item.valorTipo === "LINK") return item.valorUrl || item.valorPath || item.valor;
  return item.valorPath || item.valorUrl || "";
}

function ConfirmDeleteDialog({ state, onClose }) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await state.onConfirm?.();
      onClose();
    } catch (error) {
      toast.error("No se pudo eliminar", { description: error.message || "Intenta nuevamente." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(92vw,420px)] rounded-xl bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-red-700">{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntityDialog({ title, children, onClose, onSubmit }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-[min(94vw,560px)] overflow-hidden rounded-xl bg-white p-0 text-slate-950 shadow-2xl">
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="flex max-h-[92svh] flex-col">
          <DialogHeader className="border-b border-slate-200 px-5 py-4">
            <DialogTitle className="text-xl font-bold text-violet-700">{title}</DialogTitle>
            <DialogDescription>Completa la informacion.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto px-5 py-4">{children}</div>
          <DialogFooter className="border-t border-slate-200 bg-slate-50 px-5 py-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-violet-700 text-white hover:bg-violet-800">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }) {
  return <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-1.5 py-2 sm:px-3"><div className="min-w-0"><p className="truncate text-[10px] font-semibold leading-4 text-violet-700 sm:text-[11px]">{label}</p><p className="mt-0.5 text-base font-bold leading-5 text-slate-950 sm:text-xl sm:leading-6">{value}</p></div><Layers className="hidden size-5 shrink-0 text-violet-300 sm:block" /></div>;
}

function Field({ label, children }) {
  return <div className="space-y-1"><Label className="text-xs font-bold text-slate-600">{label}</Label>{children}</div>;
}

function Toggle({ label, checked, onCheckedChange }) {
  return <label className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50/40 p-3 text-sm font-bold text-violet-700"><Switch checked={checked} onCheckedChange={onCheckedChange} />{label}</label>;
}
