import SalesSettingsPage from "@/components/salessettings/SalesSettingsPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <SalesSettingsPage scope="ventas" userPermissions={user?.permissions || {}} />;
}
