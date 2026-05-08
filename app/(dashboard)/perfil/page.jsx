import { redirect } from "next/navigation";

import ProfilePage from "@/components/profile/ProfilePage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <ProfilePage user={user} />;
}
