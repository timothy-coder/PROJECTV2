import PointOfSaleQuotesPage from "@/components/pointofsale/PointOfSaleQuotesPage";
import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { buildPointOfSaleQuoteScope, canViewPointOfSaleModule } from "@/lib/pointOfSaleScope";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function mapQuote(row) {
  return {
    id: Number(row.id),
    codigo: row.codigo || `#${row.id}`,
    puntoVentaCodigo: row.punto_venta_codigo || "",
    cliente: row.cliente_nombre || row.cliente_razon_social || "-",
    documento: row.cliente_documento || "",
    descripcion: `${Number(row.item_count || 0)} producto${Number(row.item_count || 0) === 1 ? "" : "s"}`,
    total: Number(row.total || 0),
    estado: row.estado || "cotizacion",
    creadoPor: row.creado_por || "-",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    itemCount: Number(row.item_count || 0),
    monedaCodigo: "S/",
    monedaSimbolo: "S/",
  };
}

async function loadQuotes(user) {
  const params = [];
  const where = [];
  const scope = buildPointOfSaleQuoteScope(user, { moduleKey: "puntoventa_cotizaciones", quoteAlias: "q" });
  if (scope.where) {
    where.push(scope.where);
    params.push(...scope.params);
  }

  const [rows] = await pool.query(
    `SELECT q.id, q.codigo, q.cliente_nombre, q.cliente_razon_social, q.cliente_documento,
            q.total, q.estado, q.created_by, q.created_at, q.updated_at,
            pv.codigo AS punto_venta_codigo,
            COALESCE(u.fullname, u.username) AS creado_por,
            COALESCE(items.item_count, 0) AS item_count
     FROM posventa_punto_venta_cotizaciones q
     LEFT JOIN configuracion_puntos_venta pv ON pv.id = q.punto_venta_id
     LEFT JOIN administracion_usuarios u ON u.id = q.created_by
     LEFT JOIN (
       SELECT cotizacion_id, COUNT(*) AS item_count
       FROM posventa_punto_venta_cotizacion_items
       GROUP BY cotizacion_id
     ) items ON items.cotizacion_id = q.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY q.id, pv.codigo, u.fullname, u.username, items.item_count
     ORDER BY q.created_at DESC, q.id DESC`,
    params
  );
  return rows.map(mapQuote);
}

export default async function Page() {
  const user = await getCurrentUser();

  if (!canViewPointOfSaleModule(user, "puntoventa_cotizaciones")) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver Cotizacion.</div>;
  }

  const quotes = await loadQuotes(user);
  return <PointOfSaleQuotesPage quotes={quotes} userPermissions={user?.permissions || {}} />;
}
