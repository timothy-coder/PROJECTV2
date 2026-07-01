import { HomeReportsTabs } from "@/components/home/HomeReportsTabs";
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

  return <HomeReportsTabs showSales={showSales} showPostventa={showPostventa} />;
}
