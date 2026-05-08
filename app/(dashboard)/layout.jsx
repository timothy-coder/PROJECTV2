import DashboardNav from "@/components/layout/DashboardNav";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

export default async function DashboardLayout({ children }) {
  const user = await getCurrentUser();

  return (
    <div className="h-svh w-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex h-full w-full flex-col md:flex-row">
        <DashboardNav title="Dashboard" user={user} />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-slate-50">
          <div className="min-h-full bg-slate-50">{children}</div>
        </main>
      </div>
    </div>
  );
}
