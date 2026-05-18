import FordLeadsPage from "@/components/fordleads/FordLeadsPage";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  const permissions = user?.permissions || {};

  if (!hasPerm(permissions, ["leads_ford", "view"])) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver Leads Ford.</div>;
  }

  return <FordLeadsPage userPermissions={permissions} />;
}
