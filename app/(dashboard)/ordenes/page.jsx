import PostventaOrdersPage from "@/components/postventa/PostventaOrdersPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <PostventaOrdersPage userPermissions={user?.permissions || {}} />;
}
