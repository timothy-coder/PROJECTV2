import MaintenanceDuePage from "@/components/postventa/MaintenanceDuePage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <MaintenanceDuePage userPermissions={user?.permissions || {}} />;
}
