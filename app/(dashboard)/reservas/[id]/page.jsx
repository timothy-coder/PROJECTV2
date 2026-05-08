import ReservationDetailPage from "@/components/reservations/ReservationDetailPage";
import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { hasPerm } from "@/lib/permissions";

export default async function Page({ params }) {
  const user = await getCurrentUser();
  if (!hasPerm(user?.permissions || {}, ["reservas", "view"])) {
    return <div className="p-4 text-sm font-bold text-slate-700">No tienes permiso para ver reservas.</div>;
  }
  const { id } = await params;
  return <ReservationDetailPage id={id} />;
}
