import CapturedSalesLeadsPage from "@/components/salesleads/CapturedSalesLeadsPage";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  if (!hasPerm(user?.permissions || {}, ["mensajes", "view"])) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver leads capturados.</div>;
  }

  return <CapturedSalesLeadsPage />;
}
