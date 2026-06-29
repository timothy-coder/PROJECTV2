import ReportDashboardPage from "@/components/reports/ReportDashboardPage";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  const permissions = user?.permissions || {};
  const canView =
    hasPerm(permissions, ["reportes", "view"]) &&
    hasPerm(permissions, ["home", "view"]) &&
    hasPerm(permissions, ["home", "posventa"]);

  if (!canView) {
    return <div className="p-4 text-sm font-bold text-slate-700">No tienes permiso para ver este dashboard.</div>;
  }

  return <ReportDashboardPage type="posventa" />;
}
