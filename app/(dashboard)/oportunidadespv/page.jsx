import PostventaOpportunitiesPage from "@/components/postventa/PostventaOpportunitiesPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <PostventaOpportunitiesPage userPermissions={user?.permissions || {}} />;
}
