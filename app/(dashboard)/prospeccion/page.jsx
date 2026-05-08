import ProspeccionPage from "@/components/prospeccion/ProspeccionPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <ProspeccionPage userPermissions={user?.permissions || {}} />;
}
