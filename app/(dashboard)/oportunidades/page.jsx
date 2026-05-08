import OpportunitiesPage from "@/components/opportunities/OpportunitiesPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <OpportunitiesPage userPermissions={user?.permissions || {}} />;
}
