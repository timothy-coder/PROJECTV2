import SalesAgendaPage from "@/components/salesagenda/SalesAgendaPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <SalesAgendaPage userPermissions={user?.permissions || {}} />;
}
