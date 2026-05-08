import AccessoriesPage from "@/components/accessories/AccessoriesPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return <AccessoriesPage userPermissions={user?.permissions || {}} />;
}
