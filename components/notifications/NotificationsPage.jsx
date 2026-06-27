"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Loader2, Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { hasPerm } from "@/lib/permissions";

function typeClasses(type) {
  if (type === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (type === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (type === "error") return "border-red-200 bg-red-50 text-red-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function formatNotificationDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function notificationTypeLabel(value) {
  if (value === "success") return "Exito";
  if (value === "warning") return "Advertencia";
  if (value === "error") return "Error";
  return "Informacion";
}

const DEFAULT_OPTIONS = { canSend: false, roles: [], users: [] };

export default function NotificationsPage({ userPermissions = {} }) {
  const pageSize = 10;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [sendOpen, setSendOpen] = useState(false);
  const canSend = hasPerm(userPermissions, ["notificaciones", "send"]);

  const loadNotifications = useCallback(async (nextPage = 1, reset = true) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/notifications?limit=${pageSize}&page=${nextPage}${canSend ? "&options=1" : ""}`, { credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No se pudieron cargar las notificaciones.");
      setNotifications((current) => (reset ? payload.notifications || [] : [...current, ...(payload.notifications || [])]));
      setUnread(Number(payload.unread || 0));
      setMeta(payload.meta || { page: nextPage, pages: 1, total: payload.notifications?.length || 0 });
      if (payload.options) setOptions(payload.options);
    } catch (error) {
      toast.error(error?.message || "No se pudieron cargar las notificaciones.");
    } finally {
      setLoading(false);
    }
  }, [canSend]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadNotifications(1, true), 0);
    return () => window.clearTimeout(timer);
  }, [loadNotifications]);

  useEffect(() => {
    function handleWindowScroll() {
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;
      if (!nearBottom || loading || query.trim() || Number(meta.page || 1) >= Number(meta.pages || 1)) return;
      loadNotifications(Number(meta.page || 1) + 1, false);
    }

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [loadNotifications, loading, meta.page, meta.pages, query]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return notifications;
    return notifications.filter((item) => `${item.title} ${item.message} ${item.type}`.toLowerCase().includes(needle));
  }, [notifications, query]);

  async function markAsRead(notificationId) {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notificationId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No se pudo marcar como leida.");
      setNotifications((current) => current.map((item) => Number(item.id) === Number(notificationId) ? { ...item, read: true } : item));
      setUnread((current) => Math.max(0, current - 1));
    } catch (error) {
      toast.error(error.message || "No se pudo marcar como leida.");
    }
  }

  async function markAllAsRead() {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ all: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No se pudieron marcar como leidas.");
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      setUnread(0);
    } catch (error) {
      toast.error(error.message || "No se pudieron marcar como leidas.");
    }
  }

  return (
    <main className="min-w-0 bg-slate-50 p-3 text-slate-950 sm:p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-violet-200 pb-3">
        <div>
          <h1 className="text-base font-bold leading-tight text-violet-700">Notificaciones</h1>
        <p className="mt-0.5 text-xs font-medium text-violet-400">{unread} sin leer de {meta.total || notifications.length} notificaciones</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSend ? (
            <Button className="bg-violet-700 text-white hover:bg-violet-800" onClick={() => setSendOpen(true)}>
              <Send className="size-4" />
              Enviar notificacion
            </Button>
          ) : null}
          {unread > 0 ? (
            <Button variant="outline" onClick={markAllAsRead}>
              Marcar todas leidas
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => loadNotifications(1, true)} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
            Recargar
          </Button>
        </div>
      </header>

      <section className="mb-3 rounded-lg border bg-white p-2 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar notificacion..."
            className="h-9 bg-white pl-8 text-sm"
          />
        </div>
      </section>

      <section className="space-y-2">
        {loading ? (
          <div className="rounded-lg border bg-white p-8 text-center text-sm font-semibold text-slate-500">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin text-violet-700" />
            Cargando notificaciones...
          </div>
        ) : null}

        {!loading && filtered.map((item) => {
          const content = (
            <article className={`rounded-lg border p-3 shadow-sm transition hover:shadow-md ${item.read ? "border-slate-200 bg-white" : typeClasses(item.type)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold leading-tight">{item.title}</h2>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-snug text-slate-600">{item.message}</p>
                </div>
                {!item.read ? <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">Nuevo</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold text-slate-400">{formatNotificationDate(item.createdAt)}</p>
                {!item.read ? (
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                    onClick={(event) => {
                      event.preventDefault();
                      markAsRead(item.id);
                    }}
                  >
                    Marcar como leida
                  </button>
                ) : null}
              </div>
            </article>
          );

          return item.url ? (
            <Link key={item.id} href={item.url} className="block">
              {content}
            </Link>
          ) : (
            <div key={item.id}>{content}</div>
          );
        })}

        {!loading && !filtered.length ? (
          <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm font-semibold text-slate-500">
            No hay notificaciones para mostrar.
          </div>
        ) : null}
        {loading && notifications.length ? (
          <div className="rounded-lg border bg-white p-3 text-center text-xs font-semibold text-slate-400">
            Cargando mas notificaciones...
          </div>
        ) : null}
      </section>
      {sendOpen ? (
        <SendNotificationDialog
          open={sendOpen}
          options={options}
          onClose={() => setSendOpen(false)}
          onSent={() => {
            setSendOpen(false);
            loadNotifications(1, true);
          }}
        />
      ) : null}
    </main>
  );
}

function SendNotificationDialog({ open, options, onClose, onSent }) {
  const [form, setForm] = useState({
    title: "",
    message: "",
    type: "info",
    url: "",
    roleIds: [],
    userIds: [],
  });
  const [saving, setSaving] = useState(false);

  function toggleArray(field, id, checked) {
    setForm((current) => ({
      ...current,
      [field]: checked
        ? [...new Set([...current[field], id])]
        : current[field].filter((item) => Number(item) !== Number(id)),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No se pudo enviar la notificacion.");
      toast.success("Notificacion enviada.");
      onSent();
    } catch (error) {
      toast.error(error.message || "No se pudo enviar la notificacion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-[min(96vw,760px)] overflow-hidden bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-slate-200 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-violet-700">
            <Send className="size-4" />
            Enviar notificacion
          </DialogTitle>
          <DialogDescription>Selecciona roles o usuarios destinatarios.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex max-h-[calc(92svh-90px)] flex-col">
          <div className="grid gap-4 overflow-y-auto p-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Titulo</Label>
                <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label>Mensaje</Label>
                <Textarea rows={5} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} required />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value }))}>
                    <SelectTrigger className="w-full bg-white">
                      <span className="flex flex-1 text-left">{notificationTypeLabel(form.type)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Informacion</SelectItem>
                      <SelectItem value="success">Exito</SelectItem>
                      <SelectItem value="warning">Advertencia</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>URL opcional</Label>
                  <Input value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} placeholder="/oportunidadespv" />
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <TargetList
                title="Roles"
                empty="No hay roles."
                items={options.roles || []}
                selected={form.roleIds}
                onToggle={(id, checked) => toggleArray("roleIds", id, checked)}
              />
              <TargetList
                title="Usuarios"
                empty="No hay usuarios."
                items={(options.users || []).map((user) => ({ id: user.id, name: user.roleName ? `${user.name} - ${user.roleName}` : user.name }))}
                selected={form.userIds}
                onToggle={(id, checked) => toggleArray("userIds", id, checked)}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-violet-700 text-white hover:bg-violet-800" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Enviar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TargetList({ title, items, selected, onToggle, empty }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="text-xs font-bold text-slate-700">{title}</p>
      </div>
      <div className="max-h-44 space-y-1 overflow-y-auto p-2">
        {items.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Checkbox checked={selected.includes(Number(item.id))} onCheckedChange={(checked) => onToggle(Number(item.id), Boolean(checked))} />
            <span className="line-clamp-1">{item.name}</span>
          </label>
        ))}
        {!items.length ? <p className="py-4 text-center text-xs font-medium text-slate-400">{empty}</p> : null}
      </div>
    </div>
  );
}
