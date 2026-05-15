import SistemaLogisticoPage from "@/components/logistics/SistemaLogisticoPage";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  if (!hasPerm(user?.permissions || {}, ["sistema_logistico", "view"])) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver Sistema Logistico.</div>;
  }

  return <SistemaLogisticoPage />;
}
