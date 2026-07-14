"use client";

import { useCallback, useMemo, useState } from "react";
import { Info } from "lucide-react";

import { ConfigurationTabs } from "@/components/generalconfiguration/ConfigurationTabs";
import { configurationTabs } from "@/components/generalconfiguration/config";
import { canViewTab } from "@/components/generalconfiguration/permissionUtils";
import { CentersTab } from "@/components/generalconfiguration/tabs/centers/CentersTab";
import { CurrencyTab } from "@/components/generalconfiguration/tabs/currency/CurrencyTab";
import { LinksTab } from "@/components/generalconfiguration/tabs/links/LinksTab";
import { FiscalPointTab } from "@/components/generalconfiguration/tabs/fiscal-point/FiscalPointTab";
import { MotivesTab } from "@/components/generalconfiguration/tabs/motives/MotivesTab";
import { OriginsTab } from "@/components/generalconfiguration/tabs/origins/OriginsTab";
import { PermissionProfilesTab } from "@/components/generalconfiguration/tabs/permission-profiles/PermissionProfilesTab";
import { PlaceholderTab } from "@/components/generalconfiguration/tabs/PlaceholderTab";
import { RatesTab } from "@/components/generalconfiguration/tabs/rates/RatesTab";
import { RolesTab } from "@/components/generalconfiguration/tabs/roles/RolesTab";
import { SuboriginsTab } from "@/components/generalconfiguration/tabs/suborigins/SuboriginsTab";
import { WorkshopsCountersTab } from "@/components/generalconfiguration/tabs/workshops-counters/WorkshopsCountersTab";

export default function GeneralConfigurationPage({ userPermissions }) {
  const visibleTabs = useMemo(
    () => configurationTabs.filter((tab) => canViewTab(userPermissions, tab)),
    [userPermissions]
  );
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id || "");

  const activeConfig =
    visibleTabs.find((tab) => tab.id === activeTab) || visibleTabs[0] || null;
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  if (!activeConfig) {
    return (
      <div className="rounded-lg bg-white p-6 text-slate-700">
        No tienes permisos para ver la configuracion del sistema.
      </div>
    );
  }

  return (
    <div className="min-w-0 bg-slate-50 p-2 text-slate-950 sm:rounded-lg sm:p-4">
      <section className="min-w-0 rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200 sm:p-4">
        <div className="mb-3 px-1 sm:hidden">
          <h1 className="text-base font-bold leading-tight text-violet-700">Configuracion general</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">Administra parametros del sistema</p>
        </div>
        <ConfigurationTabs
          tabs={visibleTabs}
          activeTab={activeConfig.id}
          onChange={handleTabChange}
        />

        <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
          {activeConfig.id === "centros" ? (
            <CentersTab
              tab={activeConfig}
              userPermissions={userPermissions}
            />
          ) : activeConfig.id === "talleres" ? (
            <WorkshopsCountersTab
              tab={activeConfig}
              userPermissions={userPermissions}
            />
          ) : activeConfig.id === "motivos" ? (
            <MotivesTab
              tab={activeConfig}
              userPermissions={userPermissions}
            />
          ) : activeConfig.id === "origenes" ? (
            <OriginsTab
              tab={activeConfig}
              userPermissions={userPermissions}
            />
          ) : activeConfig.id === "sub-origenes" ? (
            <SuboriginsTab
              tab={activeConfig}
              userPermissions={userPermissions}
            />
          ) : activeConfig.id === "moneda" ? (
            <CurrencyTab
              tab={activeConfig}
              userPermissions={userPermissions}
            />
          ) : activeConfig.id === "links" ? (
            <LinksTab
              tab={activeConfig}
              userPermissions={userPermissions}
            />
          ) : activeConfig.id === "roles" ? (
            <RolesTab
              tab={activeConfig}
              userPermissions={userPermissions}
            />
          ) : activeConfig.id === "perfiles-permisos" ? (
            <PermissionProfilesTab
              tab={activeConfig}
              userPermissions={userPermissions}
            />
          ) : activeConfig.id === "datos-fiscales-punto" ? (
            <FiscalPointTab
              tab={activeConfig}
              userPermissions={userPermissions}
            />
          ) : activeConfig.id === "mano-obra" || activeConfig.id === "panos" ? (
            <RatesTab
              tab={activeConfig}
              userPermissions={userPermissions}
            />
          ) : (
            <PlaceholderTab tab={activeConfig} />
          )}

          <div className="hidden rounded-lg border border-blue-200 bg-blue-50 px-4 py-4 text-blue-700 sm:block">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold">Informacion importante</p>
                <p className="mt-1 text-xs font-medium">
                  Los tabs y botones se muestran segun permisos. En pantallas pequenas, los tabs
                  mantienen scroll horizontal para no deformar el contenido.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
