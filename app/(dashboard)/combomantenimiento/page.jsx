import MaintenancePage from "@/components/maintenance/MaintenancePage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return <MaintenancePage userPermissions={user?.permissions || {}} />;
}
