import FordLeadDetailPage from "@/components/fordleads/FordLeadDetailPage";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page({ params }) {
  const user = await getCurrentUser();
  const permissions = user?.permissions || {};

  if (!hasPerm(permissions, ["leads_ford", "view"])) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver Leads Ford.</div>;
  }

  const { id } = await params;
  return <FordLeadDetailPage id={id} />;
}
