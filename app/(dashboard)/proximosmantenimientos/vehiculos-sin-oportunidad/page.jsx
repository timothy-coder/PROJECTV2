import VehiclesWithoutOpportunityPage from "@/components/postventa/VehiclesWithoutOpportunityPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <VehiclesWithoutOpportunityPage userPermissions={user?.permissions || {}} />;
}
