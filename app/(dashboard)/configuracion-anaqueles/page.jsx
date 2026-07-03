import WarehouseLocationsConfigPage from "@/components/configinventory/WarehouseLocationsConfigPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return <WarehouseLocationsConfigPage userPermissions={user?.permissions || {}} />;
}
