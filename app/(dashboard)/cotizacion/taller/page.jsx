import PostventaQuotesPage from "@/components/postventaquotes/PostventaQuotesPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function TallerQuotesRoute() {
  const user = await getCurrentUser();
  return <PostventaQuotesPage tipo="taller" userPermissions={user?.permissions || {}} />;
}
