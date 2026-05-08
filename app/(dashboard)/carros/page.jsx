import CarPricesPage from "@/components/carprices/CarPricesPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <CarPricesPage userPermissions={user?.permissions || {}} />;
}
