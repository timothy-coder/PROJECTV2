import ClientsPage from "@/components/clients/ClientsPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return <ClientsPage userPermissions={user?.permissions || {}} />;
}
