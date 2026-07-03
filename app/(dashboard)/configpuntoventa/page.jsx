import PointOfSaleConfigPage from "@/components/configinventory/PointOfSaleConfigPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return <PointOfSaleConfigPage userPermissions={user?.permissions || {}} />;
}
