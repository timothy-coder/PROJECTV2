import GeneralConfigurationPage from "@/components/generalconfiguration/GeneralConfigurationPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return <GeneralConfigurationPage userPermissions={user?.permissions || {}} />;
}
