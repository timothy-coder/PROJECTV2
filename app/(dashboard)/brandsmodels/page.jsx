import BrandsModelsPage from "@/components/brandsmodels/BrandsModelsPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return <BrandsModelsPage userPermissions={user?.permissions || {}} />;
}
