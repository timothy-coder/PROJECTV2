import SalesPanelPage from "@/components/salesagenda/SalesPanelPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <SalesPanelPage userPermissions={user?.permissions || {}} />;
}
