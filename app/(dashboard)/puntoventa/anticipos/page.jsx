import { Banknote, CalendarClock, FileText, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { buildPointOfSaleQuoteScope, canViewPointOfSaleModule } from "@/lib/pointOfSaleScope";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

const money = (value) => `S/ ${Number(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "aplicado") return "bg-emerald-50 text-emerald-700";
  if (normalized === "cancelado") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function mapAdvance(row) {
  return {
    id: Number(row.id),
    codigo: `ANT-${String(row.id).padStart(6, "0")}`,
    cotizacionCodigo: row.cotizacion_codigo || "-",
    cliente: row.cliente_nombre || row.cliente_razon_social || "-",
    documento: row.cliente_documento || "-",
    monto: Number(row.monto || 0),
    saldo: Number(row.saldo_pendiente || 0),
    totalCotizacion: Number(row.total || 0),
    estado: row.estado || "pendiente",
    observacion: row.observacion || "",
    creadoPor: row.creado_por || "-",
    fecha: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

async function loadAdvances(user) {
  const params = [];
  const where = [];
  const scope = buildPointOfSaleQuoteScope(user, {
    moduleKey: "puntoventa_anticipos",
    quoteAlias: "q",
    createdColumn: "a.created_by",
    includeMovements: false,
  });
  if (scope.where) {
    where.push(scope.where);
    params.push(...scope.params);
  }

  const [rows] = await pool.query(
    `SELECT a.id, a.monto, a.saldo_pendiente, a.estado, a.observacion, a.created_at,
            q.codigo AS cotizacion_codigo, q.cliente_nombre, q.cliente_razon_social,
            q.cliente_documento, q.total,
            COALESCE(u.fullname, u.username) AS creado_por
     FROM posventa_punto_venta_anticipos a
     INNER JOIN posventa_punto_venta_cotizaciones q ON q.id = a.cotizacion_id
     LEFT JOIN administracion_usuarios u ON u.id = a.created_by
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY a.created_at DESC, a.id DESC`,
    params
  );
  return rows.map(mapAdvance);
}

export default async function Page() {
  const user = await getCurrentUser();

  if (!canViewPointOfSaleModule(user, "puntoventa_anticipos")) {
    return <div className="rounded-lg bg-white p-4 text-sm font-medium text-slate-700">No tienes permiso para ver Anticipos.</div>;
  }

  const advances = await loadAdvances(user);
  const pending = advances.filter((item) => item.estado === "pendiente").length;
  const registered = advances.length;
  const totalAmount = advances.reduce((sum, item) => sum + item.monto, 0);

  return (
    <main className="min-h-[calc(100svh-4rem)] bg-slate-50 p-3 text-slate-950 sm:p-4">
      <header className="mb-3 flex flex-col gap-3 border-b border-violet-200 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-base font-bold leading-tight text-violet-700">Anticipos</h1>
          <p className="mt-0.5 text-xs font-medium text-violet-400">Gestiona anticipos generados desde cotizaciones de punto de venta</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
          <Stat label="Pendientes" value={pending} tone="amber" icon={CalendarClock} />
          <Stat label="Registrados" value={registered} tone="emerald" icon={FileText} />
          <Stat label="Monto total" value={money(totalAmount)} tone="violet" icon={Banknote} />
        </div>
      </header>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="grid gap-3 border-b px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Listado de anticipos</h2>
            <p className="text-xs font-medium text-slate-400">Busca por codigo, cotizacion, cliente o documento</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Buscar anticipo..." className="h-10 bg-white pl-8 text-sm" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Codigo</th>
                <th className="px-4 py-3">Cotizacion</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Saldo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Creado por</th>
                <th className="px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {advances.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3 font-black text-violet-700">{item.codigo}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{item.cotizacionCodigo}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{item.cliente}</td>
                  <td className="px-4 py-3 text-slate-600">{item.documento}</td>
                  <td className="px-4 py-3 font-black text-emerald-700">{money(item.monto)}</td>
                  <td className="px-4 py-3 font-bold text-slate-700">{money(item.saldo)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(item.estado)}`}>{item.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.creadoPor}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(item.fecha)}</td>
                </tr>
              ))}
              {!advances.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <FileText className="mx-auto mb-2 size-7 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-500">No hay anticipos registrados.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, tone, icon: Icon }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${tones[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4" />
        <p className="text-[11px] font-bold">{label}</p>
      </div>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}
