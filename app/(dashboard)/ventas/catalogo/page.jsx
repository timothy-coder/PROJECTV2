import CatalogPage from "@/components/catalog/CatalogPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <CatalogPage userPermissions={user?.permissions || {}} />;
}
