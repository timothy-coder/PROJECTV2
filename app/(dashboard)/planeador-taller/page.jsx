import WorkshopPlannerPage from "@/components/postventa/WorkshopPlannerPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <WorkshopPlannerPage userPermissions={user?.permissions || {}} currentUser={user || null} />;
}
