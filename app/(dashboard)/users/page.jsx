import UsersPage from "@/components/users/UsersPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return <UsersPage userPermissions={user?.permissions || {}} />;
}
