import PostventaOrderDetailPage from "@/components/postventa/PostventaOrderDetailPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page({ params }) {
  const { id } = await params;
  const user = await getCurrentUser();
  return <PostventaOrderDetailPage id={id} userPermissions={user?.permissions || {}} />;
}
