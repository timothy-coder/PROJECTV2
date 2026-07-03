"use client";

import { useMemo, useState } from "react";
import { Edit3, Layers3, Loader2, MapPinned, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { hasPerm } from "@/lib/permissions";

export default function WarehouseLocationsConfigPage({ userPermissions }) {
  const data = useWarehouseLocations();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState({ type: "", item: null });
  const [deleteDialog, setDeleteDialog] = useState({ type: "", item: null });
  const canView = hasPerm(userPermissions, ["config_anaqueles", "view"]);
  const canCreate = hasPerm(userPermissions, ["config_anaqueles", "create"]);
  const canEdit = hasPerm(userPermissions, ["config_anaqueles", "edit"]);
  const canDelete = hasPerm(userPermissions, ["config_anaqueles", "delete"]);

  const clean = query.trim().toLowerCase();
  const shelves = useMemo(() => clean ? data.shelves.filter((item) => `${item.codigo} ${item.descripcion} ${item.tallerNombre} ${item.mostradorNombre}`.toLowerCase().includes(clean)) : data.shelves, [clean, data.shelves]);
  const levels = useMemo(() => clean ? data.levels.filter((item) => `${item.anaquelCodigo} ${item.codigoNivel} ${item.ordenNivel}`.toLowerCase().includes(clean)) : data.levels, [clean, data.levels]);
  const positions = useMemo(() => clean ? data.positions.filter((item) => `${item.anaquelCodigo} ${item.codigoNivel} ${item.posicion}`.toLowerCase().includes(clean)) : data.positions, [clean, data.positions]);

  if (!canView) return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver configuracion de anaqueles.</div>;

  async function handleSubmit(payload) {
    try {
      if (dialog.type === "shelf") {
        if (dialog.item) await data.updateShelf(dialog.item.id, payload);
        else await data.createShelf(payload);
      }
      if (dialog.type === "level") {
        if (dialog.item) await data.updateLevel(dialog.item.id, payload);
        else await data.createLevel(payload);
      }
      if (dialog.type === "position") {
        if (dialog.item) await data.updatePosition(dialog.item.id, payload);
        else await data.createPosition(payload);
      }
      setDialog({ type: "", item: null });
      toast.success("Configuracion guardada");
    } catch (error) {
      toast.error(error.message || "No se pudo guardar.");
    }
  }

  async function confirmDelete() {
    try {
      if (deleteDialog.type === "shelf") await data.deleteShelf(deleteDialog.item.id);
      if (deleteDialog.type === "level") await data.deleteLevel(deleteDialog.item.id);
      if (deleteDialog.type === "position") await data.deletePosition(deleteDialog.item.id);
      setDeleteDialog({ type: "", item: null });
      toast.success("Registro eliminado");
    } catch (error) {
      toast.error(error.message || "No se pudo eliminar.");
    }
  }

  return (
    <div className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-violet-700 text-white">
            <MapPinned className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-950">Configuracion de anaqueles</h1>
            <p className="text-xs font-medium text-slate-500">Gestiona anaqueles, niveles y posiciones del almacen</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={data.reload}><RefreshCw className="size-4" />Recargar</Button>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Stat label="Anaqueles" value={data.stats.shelves} />
        <Stat label="Niveles" value={data.stats.levels} />
        <Stat label="Posiciones" value={data.stats.positions} />
      </div>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar anaquel, nivel o posicion..." className="h-10 bg-white pl-9" />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <ConfigCard
          title="Anaqueles"
          subtitle="Codigos principales y ubicacion por taller o mostrador"
          icon={MapPinned}
          count={shelves.length}
          canCreate={canCreate}
          onCreate={() => setDialog({ type: "shelf", item: null })}
        >
          <ShelfTable items={shelves} loading={data.loading} canEdit={canEdit} canDelete={canDelete} onEdit={(item) => setDialog({ type: "shelf", item })} onDelete={(item) => setDeleteDialog({ type: "shelf", item })} />
        </ConfigCard>
        <ConfigCard
          title="Niveles"
          subtitle="Niveles internos de cada anaquel"
          icon={Layers3}
          count={levels.length}
          canCreate={canCreate}
          onCreate={() => setDialog({ type: "level", item: null })}
        >
          <LevelTable items={levels} loading={data.loading} canEdit={canEdit} canDelete={canDelete} onEdit={(item) => setDialog({ type: "level", item })} onDelete={(item) => setDeleteDialog({ type: "level", item })} />
        </ConfigCard>
        <ConfigCard
          title="Posiciones"
          subtitle="Posiciones numeradas por nivel"
          icon={MapPinned}
          count={positions.length}
          canCreate={canCreate}
          onCreate={() => setDialog({ type: "position", item: null })}
        >
          <PositionTable items={positions} loading={data.loading} canEdit={canEdit} canDelete={canDelete} onEdit={(item) => setDialog({ type: "position", item })} onDelete={(item) => setDeleteDialog({ type: "position", item })} />
        </ConfigCard>
      </div>

      {dialog.type === "shelf" ? <ShelfDialog item={dialog.item} options={data.options} onClose={() => setDialog({ type: "", item: null })} onSubmit={handleSubmit} /> : null}
      {dialog.type === "level" ? <LevelDialog item={dialog.item} shelves={data.shelves} onClose={() => setDialog({ type: "", item: null })} onSubmit={handleSubmit} /> : null}
      {dialog.type === "position" ? <PositionDialog item={dialog.item} levels={data.levels} onClose={() => setDialog({ type: "", item: null })} onSubmit={handleSubmit} /> : null}
      <DeleteDialog state={deleteDialog} onClose={() => setDeleteDialog({ type: "", item: null })} onConfirm={confirmDelete} />
    </div>
  );
}

function Stat({ label, value }) {
  return <div className="rounded-lg border border-violet-100 bg-white p-3 shadow-sm"><p className="text-xs font-bold text-violet-700">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>;
}

function ConfigCard({ title, subtitle, icon: Icon, count, canCreate, onCreate, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-violet-50 px-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white"><Icon className="size-4" /></div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-950">{title}</h2>
            <p className="truncate text-xs font-medium text-slate-500">{subtitle}</p>
            <p className="mt-1 text-xs font-bold text-violet-700">{count} registros</p>
          </div>
        </div>
        {canCreate ? <Button type="button" size="sm" onClick={onCreate} className="bg-violet-700 text-white hover:bg-violet-800"><Plus className="size-4" />Nuevo</Button> : null}
      </div>
      <div className="max-h-[60svh] overflow-auto p-3">{children}</div>
    </section>
  );
}

function ShelfTable({ items, loading, canEdit, canDelete, onEdit, onDelete }) {
  if (loading) return <Loading />;
  if (!items.length) return <Empty text="No hay anaqueles." />;
  return <div className="space-y-2">{items.map((item) => <Row key={item.id} title={item.codigo} subtitle={`${item.descripcion || "-"} · ${item.tallerNombre || item.mostradorNombre || "Sin taller/mostrador"}`} active={item.activo} canEdit={canEdit} canDelete={canDelete} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />)}</div>;
}

function LevelTable({ items, loading, canEdit, canDelete, onEdit, onDelete }) {
  if (loading) return <Loading />;
  if (!items.length) return <Empty text="No hay niveles." />;
  return <div className="space-y-2">{items.map((item) => <Row key={item.id} title={`${item.anaquelCodigo} / ${item.codigoNivel}`} subtitle={`Orden ${item.ordenNivel}`} active={item.activo} canEdit={canEdit} canDelete={canDelete} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />)}</div>;
}

function PositionTable({ items, loading, canEdit, canDelete, onEdit, onDelete }) {
  if (loading) return <Loading />;
  if (!items.length) return <Empty text="No hay posiciones." />;
  return <div className="space-y-2">{items.map((item) => <Row key={item.id} title={`${item.anaquelCodigo} / ${item.codigoNivel}`} subtitle={`Posicion ${item.posicion}`} active={item.activo} canEdit={canEdit} canDelete={canDelete} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />)}</div>;
}

function Row({ title, subtitle, active, canEdit, canDelete, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-950">{title}</p>
        <p className="truncate text-xs font-medium text-slate-500">{subtitle}</p>
        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{active ? "Activo" : "Inactivo"}</span>
      </div>
      <div className="flex shrink-0 gap-1">
        {canEdit ? <Button type="button" variant="outline" size="icon" className="size-8" onClick={onEdit}><Edit3 className="size-3.5" /></Button> : null}
        {canDelete ? <Button type="button" variant="destructive" size="icon" className="size-8" onClick={onDelete}><Trash2 className="size-3.5" /></Button> : null}
      </div>
    </div>
  );
}

function ShelfDialog({ item, options, onClose, onSubmit }) {
  const [form, setForm] = useState({
    codigo: item?.codigo || "",
    descripcion: item?.descripcion || "",
    tallerId: item?.tallerId ? String(item.tallerId) : "",
    mostradorId: item?.mostradorId ? String(item.mostradorId) : "",
    activo: item?.activo ?? true,
  });
  const workshopOptions = options.workshops.map((row) => ({ value: row.id, label: row.nombre }));
  const counterOptions = options.counters.map((row) => ({ value: row.id, label: row.nombre }));
  return (
    <BaseDialog title={item ? "Editar anaquel" : "Nuevo anaquel"} onClose={onClose} onSubmit={() => onSubmit(form)}>
      <Field label="Codigo *"><Input required value={form.codigo} onChange={(event) => setForm((current) => ({ ...current, codigo: event.target.value.toUpperCase() }))} /></Field>
      <Field label="Descripcion"><Input value={form.descripcion} onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))} /></Field>
      <ClearableSelectField
        label="Taller"
        value={form.tallerId}
        disabled={Boolean(form.mostradorId)}
        options={workshopOptions}
        placeholder="Seleccionar taller"
        onChange={(tallerId) => setForm((current) => ({ ...current, tallerId, mostradorId: "" }))}
        onClear={() => setForm((current) => ({ ...current, tallerId: "" }))}
      />
      <ClearableSelectField
        label="Mostrador"
        value={form.mostradorId}
        disabled={Boolean(form.tallerId)}
        options={counterOptions}
        placeholder="Seleccionar mostrador"
        onChange={(mostradorId) => setForm((current) => ({ ...current, mostradorId, tallerId: "" }))}
        onClear={() => setForm((current) => ({ ...current, mostradorId: "" }))}
      />
      <ActiveSwitch checked={form.activo} onChange={(activo) => setForm((current) => ({ ...current, activo }))} />
    </BaseDialog>
  );
}

function LevelDialog({ item, shelves, onClose, onSubmit }) {
  const [form, setForm] = useState({
    anaquelId: item?.anaquelId ? String(item.anaquelId) : "",
    codigoNivel: item?.codigoNivel || "",
    ordenNivel: item?.ordenNivel || "",
    activo: item?.activo ?? true,
  });
  const shelfOptions = shelves.map((row) => ({ value: row.id, label: row.codigo }));
  return (
    <BaseDialog title={item ? "Editar nivel" : "Nuevo nivel"} onClose={onClose} onSubmit={() => onSubmit(form)}>
      <Field label="Anaquel *"><SearchableSelect value={form.anaquelId} options={shelfOptions} placeholder="Seleccionar anaquel" onChange={(anaquelId) => setForm((current) => ({ ...current, anaquelId }))} /></Field>
      <Field label="Codigo nivel *"><Input required value={form.codigoNivel} onChange={(event) => setForm((current) => ({ ...current, codigoNivel: event.target.value.toUpperCase() }))} /></Field>
      <Field label="Orden *"><Input required type="number" value={form.ordenNivel} onChange={(event) => setForm((current) => ({ ...current, ordenNivel: event.target.value }))} /></Field>
      <ActiveSwitch checked={form.activo} onChange={(activo) => setForm((current) => ({ ...current, activo }))} />
    </BaseDialog>
  );
}

function PositionDialog({ item, levels, onClose, onSubmit }) {
  const [form, setForm] = useState({
    nivelId: item?.nivelId ? String(item.nivelId) : "",
    posicion: item?.posicion || "",
    activo: item?.activo ?? true,
  });
  const levelOptions = levels.map((row) => ({ value: row.id, label: `${row.anaquelCodigo} / ${row.codigoNivel}` }));
  return (
    <BaseDialog title={item ? "Editar posicion" : "Nueva posicion"} onClose={onClose} onSubmit={() => onSubmit(form)}>
      <Field label="Nivel *"><SearchableSelect value={form.nivelId} options={levelOptions} placeholder="Seleccionar nivel" onChange={(nivelId) => setForm((current) => ({ ...current, nivelId }))} /></Field>
      <Field label="Posicion *"><Input required type="number" value={form.posicion} onChange={(event) => setForm((current) => ({ ...current, posicion: event.target.value }))} /></Field>
      <ActiveSwitch checked={form.activo} onChange={(activo) => setForm((current) => ({ ...current, activo }))} />
    </BaseDialog>
  );
}

function BaseDialog({ title, onClose, onSubmit, children }) {
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    await onSubmit();
    setSaving(false);
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(96vw,520px)] bg-white text-slate-950">
        <form onSubmit={submit} className="space-y-3">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-violet-700">{title}</DialogTitle>
            <DialogDescription>Completa los datos requeridos.</DialogDescription>
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-violet-700 text-white hover:bg-violet-800">{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActiveSwitch({ checked, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
      <div>
        <p className="text-sm font-bold">Activo</p>
        <p className="text-xs font-medium text-slate-500">Disponible para seleccionar en ubicaciones</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700">{label}</Label>{children}</div>;
}

function ClearableSelectField({ label, value, disabled, options, placeholder, onChange, onClear }) {
  return (
    <Field label={label}>
      <div className="relative">
        <SearchableSelect value={value} disabled={disabled} options={options} placeholder={placeholder} onChange={onChange} />
        {value ? (
          <button
            type="button"
            className="absolute right-8 top-1/2 z-10 grid size-5 -translate-y-1/2 place-items-center rounded-full text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClear}
            title={`Quitar ${label.toLowerCase()}`}
          >
          x
          </button>
        ) : null}
      </div>
    </Field>
  );
}

function Loading() {
  return <div className="py-10 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</div>;
}

function Empty({ text }) {
  return <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{text}</div>;
}

function DeleteDialog({ state, onClose, onConfirm }) {
  if (!state.type) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-red-600">Eliminar registro</DialogTitle>
          <DialogDescription>Esta accion no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>Eliminar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
