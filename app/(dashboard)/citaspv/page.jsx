import PostventaAppointmentsPage from "@/components/postventa/PostventaAppointmentsPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <PostventaAppointmentsPage userPermissions={user?.permissions || {}} />;
}
