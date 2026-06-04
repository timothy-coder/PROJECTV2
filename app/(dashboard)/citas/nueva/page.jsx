import NewAppointmentMockPage from "@/components/postventa/NewAppointmentMockPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <NewAppointmentMockPage userPermissions={user?.permissions || {}} />;
}
