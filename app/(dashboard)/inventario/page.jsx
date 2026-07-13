import PostInventoryPage from "@/components/postinventory/PostInventoryPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return <PostInventoryPage userPermissions={user?.permissions || {}} currentUserId={user?.id || null} />;
}
