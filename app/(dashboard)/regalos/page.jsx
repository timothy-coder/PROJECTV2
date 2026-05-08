import GiftsPage from "@/components/gifts/GiftsPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return <GiftsPage userPermissions={user?.permissions || {}} />;
}
