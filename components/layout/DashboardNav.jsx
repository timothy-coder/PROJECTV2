"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Menu, ChevronLeft } from "lucide-react";

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
      <Accordion type="single" value={openGroupKey} onValueChange={(value) => setOpenGroupKey(value || "")} className="px-2 pb-4">
        {menu.map((section) => (
          <AccordionItem key={section.key} value={section.key} className="border-white/10">
            <AccordionTrigger className="px-3 py-2 text-slate-300 hover:text-white">
              {section.label}
            </AccordionTrigger>

            <AccordionContent className="space-y-1 px-1 pb-2">
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
            </SheetContent>
          </Sheet>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{title}</p>
            <p className="text-[11px] text-slate-400 truncate">{pathname}</p>
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // DESKTOP: sidebar colapsable
  // =========================
  if (collapsed) {
    const iconItems = menu.flatMap((section) => section.items);

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

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 p-2">
          {/* HOME */}
          <Link
            href={HOME_ITEM.to}
            title={HOME_ITEM.label}
            className={[
              "flex items-center justify-center p-3 rounded-lg text-sm transition",
              pathname === HOME_ITEM.to || pathname.startsWith(HOME_ITEM.to + "/")
                ? "bg-indigo-600/20 border border-indigo-500/30 text-white"
                : "hover:bg-white/5 text-slate-200",
            ].join(" ")}
          >
            {HOME_ITEM.icon ? <HOME_ITEM.icon className="w-5 h-5" /> : null}
          </Link>

          {/* Icon-only */}
          {iconItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                href={item.to}
                title={item.label}
                className={[
                  "flex items-center justify-center p-3 rounded-lg text-sm transition",
                  active
                    ? "bg-indigo-600/20 border border-indigo-500/30 text-white"
                    : "hover:bg-white/5 text-slate-200",
                ].join(" ")}
              >
                {Icon ? <Icon className="w-5 h-5" /> : null}
              </Link>
            );
          })}
        </div>
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
        onNavigate={() => {}}
        activeGroupKey={activeGroupKey}
      />
    </aside>
  );
}
