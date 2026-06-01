import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getPowerBiLinks() {
  try {
    const [rows] = await pool.query(
      `SELECT id, link, is_for_desktop, is_for_mobile
       FROM configuracion_links
       ORDER BY id ASC`
    );
    return rows.map((row) => ({
      id: row.id,
      link: row.link,
      isForDesktop: Boolean(row.is_for_desktop),
      isForMobile: Boolean(row.is_for_mobile),
    }));
  } catch (error) {
    console.error("Error loading home Power BI links:", error);
    return [];
  }
}

export default async function HomePage() {
  const links = await getPowerBiLinks();
  const desktopLinks = links.filter((item) => item.isForDesktop);
  const mobileLinks = links.filter((item) => item.isForMobile);

  return (
    <div className="min-w-0 space-y-4 bg-[#5e17eb] p-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Panel de Control</h1>
      </div>

      <div className="hidden space-y-4 md:block">
        {desktopLinks.length ? (
          desktopLinks.map((item) => <PowerBiFrame key={item.id} item={item} />)
        ) : (
          <EmptyState text="No hay links configurados para desktop." />
        )}
      </div>

      <div className="space-y-4 md:hidden">
        {mobileLinks.length ? (
          mobileLinks.map((item) => <PowerBiFrame key={item.id} item={item} mobile />)
        ) : (
          <EmptyState text="No hay links configurados para mobile." />
        )}
      </div>
    </div>
  );
}

function PowerBiFrame({ item, mobile = false }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-sm">
      <iframe
        title={`Power BI ${item.id}`}
        src={item.link}
        className={mobile ? "h-[78vh] w-full border-0" : "h-[calc(100vh-150px)] min-h-[640px] w-full border-0"}
        allowFullScreen
      />
    </section>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-sm font-medium text-slate-400">
      {text}
    </div>
  );
}
