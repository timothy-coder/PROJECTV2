import PostventaReportsDashboard from "@/components/reportes/PostventaReportsDashboard";
import SalesReportsDashboard from "@/components/reportes/SalesReportsDashboard";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export const dynamic = "force-dynamic";

function canSalesHome(permissions) {
  return (
    hasPerm(permissions, ["home", "ventasview"]) ||
    hasPerm(permissions, ["home", "ventasviewall"]) ||
    hasPerm(permissions, ["home", "ventas"]) ||
    hasPerm(permissions, ["home", "viewall"])
  );
}

function canPostventaHome(permissions) {
  return (
    hasPerm(permissions, ["home", "posventaview"]) ||
    hasPerm(permissions, ["home", "posventaviewall"]) ||
    hasPerm(permissions, ["home", "posventa"]) ||
    hasPerm(permissions, ["home", "viewall"])
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const permissions = user?.permissions || {};
  const showSales = canSalesHome(permissions);
  const showPostventa = canPostventaHome(permissions);

  if (!showSales && !showPostventa) {
    return (
      <div className="min-h-full bg-slate-50 p-4 text-sm font-bold text-slate-700">
        No tienes permisos para ver dashboards en Home.
      </div>
    );
  }

  return (
    <main className="min-w-0 bg-slate-50">
      {showSales ? (
        <section id="home-ventas">
          {showPostventa ? (
            <div className="sticky top-0 z-30 border-b border-violet-200 bg-slate-50/95 px-3 py-2 backdrop-blur">
              <h1 className="text-base font-bold leading-tight text-violet-700">Dashboard Ventas</h1>
              <p className="mt-0.5 text-xs font-medium text-violet-400">Home segun permisos de ventas</p>
            </div>
          ) : null}
          <SalesReportsDashboard />
        </section>
      ) : null}

      {showPostventa ? (
        <section id="home-posventa" className={showSales ? "mt-3 border-t border-violet-200" : ""}>
          {showSales ? (
            <div className="sticky top-0 z-30 border-b border-violet-200 bg-slate-50/95 px-3 py-2 backdrop-blur">
              <h1 className="text-base font-bold leading-tight text-violet-700">Dashboard Posventa</h1>
              <p className="mt-0.5 text-xs font-medium text-violet-400">Home segun permisos de posventa</p>
            </div>
          ) : null}
          <PostventaReportsDashboard />
        </section>
      ) : null}
    </main>
  );
}
