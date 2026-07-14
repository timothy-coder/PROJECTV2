"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Edit3, Loader2, Plus, Save, Trash2 } from "lucide-react";

import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { canUseAction } from "@/components/generalconfiguration/permissionUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const emptyForm = {
  id: null,
  razonSocial: "",
  direccion: "",
  ruc: "",
  celular: "",
  logoPath: "",
  scope: "global",
  tallerId: "",
  mostradorId: "",
};

export function FiscalPointTab({ tab, userPermissions }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState("");
  const [items, setItems] = useState([]);
  const [assigned, setAssigned] = useState({ talleres: [], mostradores: [] });
  const [usarGlobal, setUsarGlobal] = useState(true);
  const [form, setForm] = useState(emptyForm);

  const canCreate = canUseAction(userPermissions, tab, "create");
  const canEdit = canUseAction(userPermissions, tab, "edit");
  const canDelete = canUseAction(userPermissions, tab, "delete");
  const canSave = form.id ? canEdit : canCreate;

  const pointOptions = useMemo(() => {
    if (form.scope === "taller") return assigned.talleres.map((item) => ({ value: item.id, label: item.nombre }));
    if (form.scope === "mostrador") return assigned.mostradores.map((item) => ({ value: item.id, label: item.nombre }));
    return [];
  }, [assigned.mostradores, assigned.talleres, form.scope]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/generalconfiguration/datos-fiscales-punto", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No se pudo cargar.");
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setAssigned(payload.assigned || { talleres: [], mostradores: [] });
      setUsarGlobal(Boolean(payload.mode?.usarGlobal));
      if (payload.mode?.usarGlobal && payload.items?.[0]) setForm(toForm(payload.items[0]));
      else setForm(emptyForm);
    } catch (error) {
      setMessage(error.message || "No se pudo cargar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function onModeChange(checked) {
    setUsarGlobal(Boolean(checked));
    setForm((current) => ({
      ...current,
      scope: checked ? "global" : "taller",
      tallerId: "",
      mostradorId: "",
      id: checked ? current.id : null,
    }));
  }

  function editItem(item) {
    setForm(toForm(item));
    setUsarGlobal(item.scope === "global");
  }

  async function submit(event) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        usarGlobal,
        tallerId: !usarGlobal && form.scope === "taller" ? form.tallerId : null,
        mostradorId: !usarGlobal && form.scope === "mostrador" ? form.mostradorId : null,
      };
      const url = form.id ? `/api/generalconfiguration/datos-fiscales-punto/${form.id}` : "/api/generalconfiguration/datos-fiscales-punto";
      const response = await fetch(url, { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || "No se pudo guardar.");
      setMessage("Datos fiscales guardados.");
      await load();
    } catch (error) {
      setMessage(error.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item) {
    if (!canDelete) return;
    setMessage("");
    try {
      const response = await fetch(`/api/generalconfiguration/datos-fiscales-punto/${item.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || "No se pudo eliminar.");
      setMessage("Dato fiscal eliminado.");
      await load();
    } catch (error) {
      setMessage(error.message || "No se pudo eliminar.");
    }
  }

  async function uploadLogo(file) {
    if (!file) return;
    setUploadingLogo(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/generalconfiguration/datos-fiscales-punto/upload", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || "No se pudo subir el logo.");
      updateField("logoPath", result.path || "");
    } catch (error) {
      setMessage(error.message || "No se pudo subir el logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-violet-700">Datos fiscales de punto</h2>
            <p className="text-xs font-medium text-slate-500">Configura datos fiscales globales o por almacen/mostrador asignado.</p>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
            Global
            <Switch checked={usarGlobal} onCheckedChange={onModeChange} />
          </label>
        </div>
      </div>

      {message ? <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">{message}</div> : null}

      <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Razon social *"><Input value={form.razonSocial} onChange={(event) => updateField("razonSocial", event.target.value)} required /></Field>
          <Field label="RUC *"><Input value={form.ruc} onChange={(event) => updateField("ruc", event.target.value)} required /></Field>
          <Field label="Direccion"><Input value={form.direccion} onChange={(event) => updateField("direccion", event.target.value)} /></Field>
          <Field label="Celular"><Input value={form.celular} onChange={(event) => updateField("celular", event.target.value)} /></Field>
          <Field label="Logo">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={(event) => uploadLogo(event.target.files?.[0])} disabled={uploadingLogo || !canSave} />
              {form.logoPath ? (
                <div className="flex items-center gap-2">
                  <Image src={form.logoPath} alt="Logo fiscal" width={64} height={40} className="h-10 w-16 rounded border border-slate-200 object-contain" />
                  <Button type="button" variant="outline" size="sm" onClick={() => updateField("logoPath", "")}>Quitar</Button>
                </div>
              ) : <span className="text-xs font-medium text-slate-500">{uploadingLogo ? "Subiendo..." : "Sin logo"}</span>}
            </div>
          </Field>
          {!usarGlobal ? (
            <>
              <Field label="Tipo de punto">
                <SearchableSelect
                  value={form.scope}
                  options={[{ value: "taller", label: "Almacen" }, { value: "mostrador", label: "Mostrador" }]}
                  onChange={(value) => setForm((current) => ({ ...current, scope: value, tallerId: "", mostradorId: "" }))}
                />
              </Field>
              <Field label={form.scope === "taller" ? "Almacen asignado" : "Mostrador asignado"}>
                <SearchableSelect
                  value={form.scope === "taller" ? form.tallerId : form.mostradorId}
                  options={pointOptions}
                  placeholder="Seleccionar"
                  onChange={(value) => setForm((current) => ({ ...current, tallerId: current.scope === "taller" ? value : "", mostradorId: current.scope === "mostrador" ? value : "" }))}
                />
              </Field>
            </>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}>
            <Plus className="size-4" /> Nuevo
          </Button>
          <Button type="submit" disabled={!canSave || saving} className="bg-violet-700 text-white hover:bg-violet-800">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Guardar
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-600">
              <tr>
                <th className="px-3 py-3">Razon social</th>
                <th className="px-3 py-3">Logo</th>
                <th className="px-3 py-3">RUC</th>
                <th className="px-3 py-3">Direccion</th>
                <th className="px-3 py-3">Celular</th>
                <th className="px-3 py-3">Punto</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={7} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Cargando...</td></tr> : null}
              {!loading && items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 font-bold text-slate-900">{item.razonSocial}</td>
                  <td className="px-3 py-3">{item.logoPath ? <Image src={item.logoPath} alt={item.razonSocial} width={56} height={34} className="h-8 w-14 rounded border border-slate-200 object-contain" /> : "-"}</td>
                  <td className="px-3 py-3">{item.ruc}</td>
                  <td className="px-3 py-3">{item.direccion || "-"}</td>
                  <td className="px-3 py-3">{item.celular || "-"}</td>
                  <td className="px-3 py-3">{pointLabel(item)}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      {canEdit ? <Button type="button" variant="outline" size="icon" onClick={() => editItem(item)}><Edit3 className="size-4" /></Button> : null}
                      {canDelete ? <Button type="button" variant="destructive" size="icon" onClick={() => removeItem(item)}><Trash2 className="size-4" /></Button> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !items.length ? <tr><td colSpan={7} className="py-10 text-center text-slate-500">No hay datos fiscales registrados.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-bold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function toForm(item) {
  return {
    id: item.id,
    razonSocial: item.razonSocial || "",
    direccion: item.direccion || "",
    ruc: item.ruc || "",
    celular: item.celular || "",
    logoPath: item.logoPath || "",
    scope: item.scope === "mostrador" ? "mostrador" : item.scope === "taller" ? "taller" : "global",
    tallerId: item.tallerId ? String(item.tallerId) : "",
    mostradorId: item.mostradorId ? String(item.mostradorId) : "",
  };
}

function pointLabel(item) {
  if (item.scope === "global") return "Global";
  if (item.scope === "taller") return `Almacen: ${item.tallerNombre || item.tallerId}`;
  if (item.scope === "mostrador") return `Mostrador: ${item.mostradorNombre || item.mostradorId}`;
  return "-";
}
