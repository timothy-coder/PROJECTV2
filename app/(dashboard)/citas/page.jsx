import PostventaAgendaPage from "@/components/postventa/PostventaAgendaPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();
  return <PostventaAgendaPage userPermissions={user?.permissions || {}} />;
}
