import PointOfSalePage from "@/components/pointofsale/PointOfSalePage";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function Page({ searchParams }) {
  const user = await getCurrentUser();
  const resolvedSearchParams = await searchParams;

  if (!hasPerm(user?.permissions || {}, ["puntoventa", "view"])) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver Punto de Venta.</div>;
  }

  return (
    <PointOfSalePage
      userPermissions={user?.permissions || {}}
      initialQuoteId={resolvedSearchParams?.cotizacionId || resolvedSearchParams?.puntoventaCotizacion || ""}
      initialMode={resolvedSearchParams?.modo || ""}
    />
  );
}
