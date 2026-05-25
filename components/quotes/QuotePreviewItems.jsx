"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { apiFetch } from "@/app/api/client";
import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function money(value) {
  return `$${Number(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function QuoteVehicleDiscountEditor({ quoteId, discountAmount, discountPercentage }) {
  const router = useRouter();
  const initialType = Number(discountAmount || 0) > 0 ? "amount" : "percentage";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    discountType: initialType,
    discountValue: initialType === "amount" ? Number(discountAmount || 0) : Number(discountPercentage || 0),
  });

  async function save() {
    await apiFetch(`/api/cotizacion-preview/${quoteId}/items`, {
      method: "POST",
      body: JSON.stringify({ type: "vehicle", ...form }),
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}><Pencil className="size-4" />Editar descuento</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Descuento del vehiculo</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label="Tipo de descuento">
              <SearchableSelect
                value={form.discountType}
                options={[{ value: "percentage", label: "Por Porcentaje (%)" }, { value: "amount", label: "Por Monto ($)" }]}
                onChange={(value) => setForm({ discountType: value, discountValue: 0 })}
              />
            </Field>
            <Field label={form.discountType === "amount" ? "Monto" : "Porcentaje (%)"}>
              <Input type="number" min="0" step="0.01" value={form.discountValue} onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function QuoteVehicleColorEditor({ quoteId, colorExterno, colorInterno }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    colorExterno: colorExterno || "",
    colorInterno: colorInterno || "",
  });

  async function save() {
    await apiFetch(`/api/cotizacion-preview/${quoteId}/items`, {
      method: "POST",
      body: JSON.stringify({ type: "vehicle-colors", ...form }),
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}><Pencil className="size-4" />Editar colores</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-white text-slate-950">
          <DialogHeader><DialogTitle>Colores del vehiculo</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label="Color externo">
              <Input value={form.colorExterno} onChange={(event) => setForm((prev) => ({ ...prev, colorExterno: event.target.value }))} />
            </Field>
            <Field label="Color interno">
              <Input value={form.colorInterno} onChange={(event) => setForm((prev) => ({ ...prev, colorInterno: event.target.value }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function QuoteVehiclePricingEditor({ quoteId, precioBase, tcReferencial, diasValidez, observaciones, otrosProductos }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    precioBase: precioBase ?? "",
    tcReferencial: tcReferencial ?? "",
    diasValidez: diasValidez ?? "",
    observaciones: observaciones ?? "",
    otrosProductos: otrosProductos ?? "",
  });

  async function save() {
    await apiFetch(`/api/cotizacion-preview/${quoteId}/items`, {
      method: "POST",
      body: JSON.stringify({ type: "vehicle-pricing", ...form }),
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" className="mt-4 mr-2" onClick={() => setOpen(true)}><Pencil className="size-4" />Editar datos de cotizacion</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] max-w-2xl overflow-y-auto bg-white text-slate-950">
          <DialogHeader><DialogTitle>Datos de la cotizacion</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Precio base editable ($)">
              <Input type="number" min="0" step="0.01" value={form.precioBase} onChange={(event) => setForm((prev) => ({ ...prev, precioBase: event.target.value }))} />
            </Field>
            <Field label="T.C. referencial">
              <Input type="number" min="0" step="0.0001" value={form.tcReferencial} onChange={(event) => setForm((prev) => ({ ...prev, tcReferencial: event.target.value }))} />
            </Field>
            <Field label="Dias de validez de la cotizacion">
              <Input type="number" min="0" step="1" value={form.diasValidez} onChange={(event) => setForm((prev) => ({ ...prev, diasValidez: event.target.value }))} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Observaciones">
                <Textarea value={form.observaciones} onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Otros productos y servicios">
                <Textarea value={form.otrosProductos} onChange={(event) => setForm((prev) => ({ ...prev, otrosProductos: event.target.value }))} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function QuotePreviewItems({ quoteId, accessories, gifts, accessoryOptions, giftOptions }) {
  const router = useRouter();
  const [dialog, setDialog] = useState(null);

  async function save(payload) {
    await apiFetch(`/api/cotizacion-preview/${quoteId}/items`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setDialog(null);
    router.refresh();
  }

  async function remove(type, item) {
    if (!window.confirm("Eliminar este registro?")) return;
    await save({ type, mode: "delete", itemId: item.id });
  }

  return (
    <>
      <ItemsCard
        title="Accesorios"
        rows={accessories}
        partKey="numero_parte"
        tone="blue"
        onAdd={() => setDialog({ type: "accessory", item: null })}
        onEdit={(item) => setDialog({ type: "accessory", item })}
        onDelete={(item) => remove("accessory", item)}
      />
      <ItemsCard
        title="Regalos"
        rows={gifts}
        partKey="lote"
        tone="violet"
        onAdd={() => setDialog({ type: "gift", item: null })}
        onEdit={(item) => setDialog({ type: "gift", item })}
        onDelete={(item) => remove("gift", item)}
      />
      {dialog ? (
        <ItemDialog
          dialog={dialog}
          options={dialog.type === "gift" ? giftOptions : accessoryOptions}
          onClose={() => setDialog(null)}
          onSubmit={save}
        />
      ) : null}
    </>
  );
}

function ItemsCard({ title, rows, partKey, tone, onAdd, onEdit, onDelete }) {
  const total = rows.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const subtotal = rows.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const discount = rows.reduce((sum, item) => sum + Number(item.descuento_monto || 0) + Number(item.subtotal || 0) * Number(item.descuento_porcentaje || 0) / 100, 0);
  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-bold">{title} ({rows.length})</h2>
        <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={onAdd}><Plus className="size-4" />Agregar</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-100 text-left">
            <tr><th className="px-3 py-3">Descripcion</th><th>Referencia</th><th>Cant.</th><th>Unitario</th><th>Total C/IGV</th><th>Desc.</th><th>Total Final</th><th>Accion</th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-3">
                  <p>{row.detalle}</p>
                  {row.notas ? <p className="mt-1 text-xs text-slate-500">{row.notas}</p> : null}
                </td>
                <td>{row[partKey] || "-"}</td>
                <td>{row.cantidad}</td>
                <td>{money(row.precio_unitario)}</td>
                <td>{money(row.subtotal)}</td>
                <td className="text-red-600">{discountLabel(row)}</td>
                <td className="font-bold text-blue-700">{money(row.total)}</td>
                <td>
                  <Button size="icon" variant="ghost" className="text-blue-700" onClick={() => onEdit(row)}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-red-600" onClick={() => onDelete(row)}><Trash2 className="size-4" /></Button>
                </td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={8} className="py-8 text-center text-slate-500">Sin registros</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className={`mt-5 rounded-lg border p-4 ${tone === "violet" ? "border-violet-200 bg-violet-50" : "border-blue-200 bg-blue-50"}`}>
        <div className="grid gap-4 md:grid-cols-4">
          <Info label="Total C/IGV" value={money(subtotal)} />
          <Info label="Desc. Items" value={money(discount)} />
          <Info label="S/IGV" value={money(total / 1.18)} />
          <Info label="IGV (18%)" value={money(total - total / 1.18)} />
        </div>
        <div className="mt-4 rounded border border-blue-400 bg-white p-3 text-right font-bold text-blue-700">Total {title}: {money(total)}</div>
      </div>
    </section>
  );
}

function ItemDialog({ dialog, options, onClose, onSubmit }) {
  const item = dialog.item;
  const isGift = dialog.type === "gift";
  const initialCatalog = item ? (isGift ? item.regalo_id : item.accesorio_id) : "";
  const initialDiscountType = Number(item?.descuento_monto || 0) > 0 ? "amount" : "percentage";
  const [form, setForm] = useState({
    catalogId: initialCatalog ? String(initialCatalog) : "",
    cantidad: item?.cantidad || 1,
    discountType: initialDiscountType,
    discountValue: initialDiscountType === "amount" ? Number(item?.descuento_monto || 0) : Number(item?.descuento_porcentaje || 0),
    notas: item?.notas || "",
  });
  const selected = useMemo(() => options.find((option) => String(option.value) === String(form.catalogId)), [options, form.catalogId]);
  const unit = Number(selected?.price || item?.precio_unitario || 0);
  const subtotal = unit * Number(form.cantidad || 1);
  const discount = form.discountType === "amount" ? Number(form.discountValue || 0) : subtotal * Number(form.discountValue || 0) / 100;
  const total = Math.max(subtotal - discount, 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-3xl overflow-y-auto bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>{item ? "Editar" : "Agregar"} {isGift ? "Regalo" : "Accesorio"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={isGift ? "Regalo" : "Accesorio"}>
            <SearchableSelect value={form.catalogId} options={options} placeholder={`Seleccionar ${isGift ? "regalo" : "accesorio"}`} onChange={(value) => setForm((prev) => ({ ...prev, catalogId: value }))} />
          </Field>
          <Field label="Cantidad">
            <Input type="number" min="1" value={form.cantidad} onChange={(event) => setForm((prev) => ({ ...prev, cantidad: event.target.value }))} />
          </Field>
          <Field label="Tipo de descuento">
            <SearchableSelect
              value={form.discountType}
              options={[{ value: "percentage", label: "Por Porcentaje (%)" }, { value: "amount", label: "Por Monto ($)" }]}
              onChange={(value) => setForm((prev) => ({ ...prev, discountType: value, discountValue: 0 }))}
            />
          </Field>
          <Field label={form.discountType === "amount" ? "Monto" : "Porcentaje (%)"}>
            <Input type="number" min="0" step="0.01" value={form.discountValue} onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Notas">
              <Textarea value={form.notas} placeholder="Agregue notas..." onChange={(event) => setForm((prev) => ({ ...prev, notas: event.target.value }))} />
            </Field>
          </div>
          <div className="rounded-lg border bg-slate-50 p-4 md:col-span-2">
            <div className="grid gap-3 text-sm md:grid-cols-4">
              <Info label="Total C/IGV" value={money(subtotal)} />
              <Info label="Descuento" value={`-${money(discount)}`} />
              <Info label="S/IGV" value={money(total / 1.18)} />
              <Info label="Total Final" value={money(total)} />
            </div>
          </div>
        </div>
        <DialogFooter className="sticky bottom-0 border-t bg-white pt-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-slate-950 text-white hover:bg-slate-800" disabled={!form.catalogId} onClick={() => onSubmit({ type: dialog.type, mode: item ? "update" : "create", itemId: item?.id, ...form })}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
function Info({ label, value }) {
  return <div><p className="text-xs text-slate-600">{label}</p><p className="font-bold">{value}</p></div>;
}
function discountLabel(row) {
  const amount = Number(row.descuento_monto || 0);
  const percentage = Number(row.descuento_porcentaje || 0);
  if (percentage) return `-${percentage.toFixed(2)}%`;
  if (amount) return `-${money(amount)}`;
  return "-";
}
