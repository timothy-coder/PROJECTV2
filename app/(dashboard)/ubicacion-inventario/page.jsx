import PostInventoryPage from "@/components/postinventory/PostInventoryPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page() {
  const user = await getCurrentUser();

  return (
    <PostInventoryPage
      userPermissions={user?.permissions || {}}
      fixedView="locations"
      title="Ubicacion inventario"
      subtitle="Gestion de lotes por anaquel, nivel y posicion"
    />
  );
}
