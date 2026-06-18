import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { PowerBiLinksSlider } from "@/components/home/PowerBiLinksSlider";

export const dynamic = "force-dynamic";

async function getPowerBiLinks() {
  try {
    const user = await getCurrentUser();
    const roleId = Number(user?.role?.id || 0);
    const [rows] = await pool.query(
      `SELECT l.id, l.link, l.is_for_desktop, l.is_for_mobile
       FROM configuracion_links l
       WHERE NOT EXISTS (
          SELECT 1 FROM configuracion_roles_links public_check WHERE public_check.link_id = l.id
       )
       OR EXISTS (
          SELECT 1 FROM configuracion_roles_links role_check WHERE role_check.link_id = l.id AND role_check.role_id = ?
       )
       ORDER BY l.id ASC`,
      [roleId]
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

      <div className="hidden md:block">
        <PowerBiLinksSlider links={desktopLinks} emptyText="No hay links configurados para desktop." />
      </div>

      <div className="md:hidden">
        <PowerBiLinksSlider links={mobileLinks} mobile emptyText="No hay links configurados para mobile." />
      </div>
    </div>
  );
}
