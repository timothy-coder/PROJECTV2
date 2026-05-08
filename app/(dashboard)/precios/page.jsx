import PricesPage from "@/components/prices/PricesPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return <PricesPage userPermissions={user?.permissions || {}} />;
}
