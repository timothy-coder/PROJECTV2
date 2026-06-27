import NotificationsPage from "@/components/notifications/NotificationsPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  if (!user) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No autenticado.</div>;
  }

  return <NotificationsPage userPermissions={user.permissions || {}} />;
}
