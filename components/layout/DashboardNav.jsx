"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, Menu, ChevronLeft, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";

import { useIsMobile } from "@/hooks/useIsMobile";
import { HOME_ITEM, NAV_TREE } from "@/lib/navtree";
import { hasPerm } from "@/lib/permissions";

// shadcn
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function getInitials(user) {
  const source = user?.fullname || user?.username || "Usuario";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "U";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first}${second || ""}`.toUpperCase();
}

function UserBox({ user, collapsed = false, onNavigate }) {
  const router = useRouter();
  const displayName = user?.fullname || user?.username || "Usuario";
  const roleName = user?.role?.name || "Sin rol";
  const initials = getInitials(user);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      toast.success("Sesion cerrada");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(error?.message || "No se pudo cerrar sesion");
    }
  };

  if (collapsed) {
    return (
      <div className="border-t border-white/10 p-2">
        <Link
          href="/perfil"
          title="Mi perfil"
          className="flex h-11 w-full items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/15 text-sm font-semibold text-white transition hover:bg-indigo-500/25"
        >
          {initials}
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 p-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-sm">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="truncate text-[11px] text-slate-400">{roleName}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/perfil"
            onClick={onNavigate}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-white/10 bg-white px-2 text-xs font-medium text-slate-950 transition hover:bg-slate-100"
          >
            <UserRound className="h-3.5 w-3.5" />
            Mi perfil
          </Link>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleLogout}
            className="h-8 text-red-100 hover:bg-red-500/15 hover:text-white"
          >
            <LogOut className="mr-1 h-3.5 w-3.5" />
            Salir
          </Button>
        </div>
      </div>
    </div>
  );
}

function buildMenuForUser(menu, userPermissions) {
  return menu
    .map((section) => {
      const items = section.items.filter((item) => {
        if (item.perms?.length) {
          return item.perms.some((perm) => hasPerm(userPermissions, perm));
        }

        return hasPerm(userPermissions, item.perm);
      });
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);
}

function getActiveGroupKey(menu, pathname) {
  for (const section of menu) {
    for (const item of section.items) {
      if (pathname === item.to || pathname.startsWith(item.to + "/")) return section.key;
    }
  }
  return "";
}

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

function NotificationsButton({ collapsed = false }) {
  const pageSize = 10;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });

  async function loadNotifications(nextPage = 1, reset = true) {
    setLoading(true);
    try {
      const response = await fetch(`/api/notifications?limit=${pageSize}&page=${nextPage}`, { credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No se pudieron cargar las notificaciones.");
      setUnread(Number(payload.unread || 0));
      setNotifications((current) => (reset ? payload.notifications || [] : [...current, ...(payload.notifications || [])]));
      setMeta(payload.meta || { page: nextPage, pages: 1, total: payload.notifications?.length || 0 });
    } catch (error) {
      toast.error(error?.message || "No se pudieron cargar las notificaciones.");
    } finally {
      setLoading(false);
    }
  }

  function handleScroll(event) {
    const element = event.currentTarget;
    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 24;
    if (!nearBottom || loading || Number(meta.page || 1) >= Number(meta.pages || 1)) return;
    loadNotifications(Number(meta.page || 1) + 1, false);
  }

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
      toast.error(error?.message || "No se pudo marcar como leida.");
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
      toast.error(error?.message || "No se pudieron marcar como leidas.");
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadNotifications();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const button = (
    <button
      type="button"
      title="Notificaciones"
      className={`relative inline-flex items-center justify-center rounded-lg border border-white/10 text-slate-100 transition hover:bg-white/10 ${collapsed ? "h-11 w-full" : "h-8 gap-2 px-2 text-xs font-medium"}`}
      onClick={() => {
        setOpen(true);
        loadNotifications(1, true);
      }}
    >
      <Bell className={collapsed ? "size-5" : "size-3.5"} />
      {!collapsed ? <span>Notificaciones</span> : null}
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-5 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );

  return (
    <>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger render={button} />
          <TooltipContent side="right" align="center" sideOffset={10} className="bg-slate-950 text-white">
            Notificaciones
          </TooltipContent>
        </Tooltip>
      ) : button}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88svh] max-w-[min(94vw,620px)] overflow-hidden bg-white p-0 text-slate-950">
          <DialogHeader className="border-b border-slate-200 px-5 py-4 pr-12">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-violet-700">
                  <Bell className="size-4" />
                  Notificaciones
                </DialogTitle>
                <DialogDescription className="mt-0.5">{unread} sin leer</DialogDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {unread > 0 ? (
                  <button type="button" className="inline-flex h-8 w-fit shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50" onClick={markAllAsRead}>
                    Marcar leidas
                  </button>
                ) : null}
                <Link
                  href="/notificaciones"
                  className="inline-flex h-8 w-fit shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50 px-3 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
                  onClick={() => setOpen(false)}
                >
                  Ver todas
                </Link>
              </div>
            </div>
          </DialogHeader>
          <div className="max-h-[68svh] space-y-2 overflow-y-auto p-4" onScroll={handleScroll}>
            {loading && !notifications.length ? <div className="py-8 text-center text-sm font-semibold text-slate-500">Cargando...</div> : null}
            {!loading && notifications.map((item) => (
              <a
                key={item.id}
                href={item.url || "#"}
                className={`block rounded-lg border p-3 transition hover:shadow-sm ${item.read ? "border-slate-200 bg-white" : typeClasses(item.type)}`}
                onClick={(event) => {
                  if (!item.url) event.preventDefault();
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold">{item.title}</p>
                  {!item.read ? <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">Nuevo</span> : null}
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-snug text-slate-600">{item.message}</p>
                {item.createdByName ? <p className="mt-1 text-[10px] font-bold text-slate-400">Creado por: {item.createdByName}</p> : null}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold text-slate-400">{formatNotificationDate(item.createdAt)}</p>
                  {!item.read ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                      onClick={(event) => {
                        event.preventDefault();
                        markAsRead(item.id);
                      }}
                    >
                      Marcar leida
                    </button>
                  ) : null}
                </div>
              </a>
            ))}
            {!loading && !notifications.length ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
                <div className="mx-auto grid size-10 place-items-center rounded-full bg-violet-50 text-violet-700">
                  <Bell className="size-4" />
                </div>
                <p className="mt-3 text-sm font-bold text-slate-700">No tienes notificaciones.</p>
                <p className="mt-1 text-xs font-medium text-slate-400">Cuando llegue un aviso aparecera aqui.</p>
              </div>
            ) : null}
            {loading && notifications.length ? (
              <div className="py-3 text-center text-xs font-semibold text-slate-400">Cargando mas...</div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CollapsedNavIcon({ href, label, active, children }) {
  const className = [
    "flex items-center justify-center p-3 rounded-lg text-sm transition",
    active
      ? "bg-indigo-600/20 border border-indigo-500/30 text-white"
      : "hover:bg-white/5 text-slate-200",
  ].join(" ");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link href={href} title={label} aria-label={label} className={className}>
            {children}
          </Link>
        }
      />
      <TooltipContent side="right" align="center" sideOffset={10} className="bg-slate-950 text-white">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function NavLinks({ menu, pathname, onNavigate, activeGroupKey }) {
  const [openGroupKey, setOpenGroupKey] = useState(activeGroupKey);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpenGroupKey(activeGroupKey);
    }, 0);

    return () => clearTimeout(timer);
  }, [activeGroupKey]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* HOME */}
      <div className="p-3">
        <Link
          href={HOME_ITEM.to}
          onClick={onNavigate}
          className={[
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
            pathname === HOME_ITEM.to || pathname.startsWith(HOME_ITEM.to + "/")
              ? "bg-indigo-600/20 border border-indigo-500/30 text-white"
              : "hover:bg-white/5 text-slate-200",
          ].join(" ")}
        >
          {HOME_ITEM.icon ? <HOME_ITEM.icon className="w-4 h-4" /> : null}
          <span>{HOME_ITEM.label}</span>
        </Link>
      </div>

      {/* Acordeón:
         - Sin collapsible para evitar warning.
         - Controlado con `value`.
         - Si activeGroupKey = "" => todas cerradas.
      */}
      <Accordion type="single" value={openGroupKey} onValueChange={(value) => setOpenGroupKey(value || "")} className="border-0 bg-transparent px-2 pb-4">
        {menu.map((section) => (
          <AccordionItem key={section.key} value={section.key} className="border-white/10 bg-transparent data-open:bg-slate-800/40">
            <AccordionTrigger className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white hover:no-underline">
              {section.label}
            </AccordionTrigger>

            <AccordionContent className="space-y-1 rounded-lg bg-slate-950/30 px-1 pb-2 [&_a]:no-underline [&_a]:hover:text-white">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || pathname.startsWith(item.to + "/");

                return (
                  <Link
                    key={item.to}
                    href={item.to}
                    onClick={onNavigate}
                    className={[
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                      active
                        ? "bg-indigo-600/20 border border-indigo-500/30 text-white"
                        : "hover:bg-white/5 text-slate-200",
                    ].join(" ")}
                  >
                    {Icon ? <Icon className="w-4 h-4" /> : null}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export default function DashboardNav({ title = "Dashboard", user }) {
  const pathname = usePathname();
  const isMobile = useIsMobile(768);

  // ✅ Desktop colapsado por defecto
  const [collapsed, setCollapsed] = useState(true);

  // ✅ Mobile drawer
  const [open, setOpen] = useState(false);

  const userPermissions = useMemo(() => user?.permissions || {}, [user?.permissions]);

  // ✅ menú filtrado por permisos
  const menu = useMemo(() => buildMenuForUser(NAV_TREE, userPermissions), [userPermissions]);

  // ✅ sección activa por ruta (solo esa abierta; si no hay => "")
  const activeGroupKey = useMemo(() => getActiveGroupKey(menu, pathname), [menu, pathname]);

  const onNavigate = () => {
    if (isMobile) setOpen(false);
    else setCollapsed(true);
  };

  // =========================
  // MOBILE: header + drawer
  // =========================
  if (isMobile) {
    return (
      <div className="sticky top-0 z-50 w-full shrink-0 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="h-14 px-3 flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-200">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>

            <SheetContent
              side="left"
              className="p-0 w-72 bg-slate-900 text-slate-100 border-white/10"
            >
              <SheetHeader className="p-5 border-b border-white/10">
                <SheetTitle className="text-slate-100">{title}</SheetTitle>
                <p className="text-xs text-slate-400">Hub CRM</p>
                <p className="text-xs text-slate-400">Panel administrativo</p>
              </SheetHeader>

              <NavLinks
                menu={menu}
                pathname={pathname}
                onNavigate={onNavigate}
                activeGroupKey={activeGroupKey}
              />
              <UserBox user={user} onNavigate={onNavigate} />
            </SheetContent>
          </Sheet>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{title}</p>
            <p className="text-[11px] text-slate-400 truncate">{pathname}</p>
          </div>
          <NotificationsButton />
        </div>
      </div>
    );
  }

  // =========================
  // DESKTOP: sidebar colapsable
  // =========================
  if (collapsed) {
    const iconItems = menu.flatMap((section) => section.items);
    const homeActive = pathname === HOME_ITEM.to || pathname.startsWith(HOME_ITEM.to + "/");

    return (
      <aside className="h-svh w-20 bg-slate-900 text-slate-100 flex flex-col min-h-0 border-r border-white/10 transition-all duration-300">
        <div className="p-3 border-b border-white/10 flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(false)}
            className="text-slate-400 hover:text-white hover:bg-white/10"
            title="Abrir sidebar"
          >
            <ChevronLeft className="w-5 h-5 rotate-180" />
          </Button>
        </div>

        <TooltipProvider delay={0}>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 p-2">
            {/* HOME */}
            <CollapsedNavIcon
              href={HOME_ITEM.to}
              label={HOME_ITEM.label}
              active={homeActive}
            >
              {HOME_ITEM.icon ? <HOME_ITEM.icon className="w-5 h-5" /> : null}
            </CollapsedNavIcon>

            {/* Icon-only */}
            {iconItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <CollapsedNavIcon
                  key={item.to}
                  href={item.to}
                  label={item.label}
                  active={active}
                >
                  {Icon ? <Icon className="w-5 h-5" /> : null}
                </CollapsedNavIcon>
              );
            })}
          </div>
          <div className="shrink-0 px-2 pb-2">
            <NotificationsButton collapsed />
          </div>
        </TooltipProvider>
        <UserBox user={user} collapsed />
      </aside>
    );
  }

  // Expanded
  return (
    <aside className="h-svh w-72 bg-slate-900 text-slate-100 flex flex-col min-h-0 border-r border-white/10 transition-all duration-300">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">{title}</h2>
          <p className="text-xs text-slate-400">Hub CRM</p>
          <p className="text-xs text-slate-400">Panel administrativo</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(true)}
          className="text-slate-400 hover:text-white hover:bg-white/10 flex-shrink-0"
          title="Cerrar sidebar"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      <NavLinks
        menu={menu}
        pathname={pathname}
        onNavigate={onNavigate}
        activeGroupKey={activeGroupKey}
      />
      <div className="shrink-0 px-3 pb-3">
        <NotificationsButton />
      </div>
      <UserBox user={user} onNavigate={onNavigate} />
    </aside>
  );
}
