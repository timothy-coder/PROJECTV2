import ConfigInventoryPage from "@/components/configinventory/ConfigInventoryPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return <ConfigInventoryPage userPermissions={user?.permissions || {}} />;
}
