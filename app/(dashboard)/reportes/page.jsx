
import ReportsPage from "@/components/reports/ReportsPage";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasPerm(user?.permissions || {}, ["reportes", "view"])) {
    return <div className="p-4 text-sm font-bold text-slate-700">No tienes permiso para ver reportes.</div>;
  }
  return <ReportsPage userPermissions={user?.permissions || {}} />;

}
