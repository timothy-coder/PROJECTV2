import PostventaPanelPage from "@/components/postventa/PostventaPanelPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <PostventaPanelPage userPermissions={user?.permissions || {}} />;
}
