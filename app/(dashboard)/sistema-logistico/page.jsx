import SistemaLogisticoPage from "@/components/logistics/SistemaLogisticoPage";
import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

const MONTH_KEYS = Array.from({ length: 12 }, (_, index) => `m${index + 1}`);

function monthRef(offset) {
  const date = new Date();
  date.setMonth(date.getMonth() - offset);
  return {
    anio: date.getFullYear(),
    mes: date.getMonth() + 1,
  };
}

function diffDays(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  return Math.max(Math.floor((now.getTime() - date.getTime()) / 86400000), 0);
}

async function loadLogisticsRows() {
  const monthRefs = MONTH_KEYS.map((key, index) => ({ key, ...monthRef(index + 1) }));
  const [rows] = await pool.query(
    `SELECT p.id, p.numero_parte, p.descripcion, p.stock_total, p.stock_disponible, p.fecha_ingreso,
            v.anio, v.mes, COALESCE(SUM(v.cantidad), 0) AS cantidad
     FROM posventa_productos p
     LEFT JOIN posventa_productos_ventames v ON v.producto_id = p.id
     GROUP BY p.id, p.numero_parte, p.descripcion, p.stock_total, p.stock_disponible, p.fecha_ingreso, v.anio, v.mes
     ORDER BY p.numero_parte ASC`
  );
  const map = new Map();

  rows.forEach((row) => {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id,
        producto: [row.numero_parte, row.descripcion].filter(Boolean).join(" - "),
        stockActual: Number(row.stock_disponible ?? row.stock_total ?? 0),
        diasAlmacen: diffDays(row.fecha_ingreso),
        mesActual: new Date().getMonth() + 1,
        ...Object.fromEntries(MONTH_KEYS.map((key) => [key, 0])),
      });
    }

    const month = monthRefs.find((item) => Number(item.anio) === Number(row.anio) && Number(item.mes) === Number(row.mes));
    if (month) {
      const current = map.get(row.id);
      current[month.key] = Number(row.cantidad || 0);
    }
  });

  return Array.from(map.values());
}

export default async function Page() {
  const user = await getCurrentUser();

  if (!hasPerm(user?.permissions || {}, ["sistema_logistico", "view"])) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver Sistema Logistico.</div>;
  }

  const rows = await loadLogisticsRows();
  return <SistemaLogisticoPage initialRows={rows} />;
}
