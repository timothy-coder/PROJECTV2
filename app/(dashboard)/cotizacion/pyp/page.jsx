import PostventaQuotesPage from "@/components/postventaquotes/PostventaQuotesPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function PypQuotesPage() {
  const user = await getCurrentUser();
  return <PostventaQuotesPage tipo="pyp" userPermissions={user?.permissions || {}} />;
}
