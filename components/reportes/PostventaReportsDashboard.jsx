"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Expand, Loader2, RotateCcw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/generalconfiguration/SearchableSelect";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const COLORS = ["#188ff2", "#df3f4f", "#1429a6", "#ec6a2e", "#8b0fa8", "#d83eb5", "#6e48c7", "#1ea34a", "#e4bd00", "#0f766e"];
const STAGE_COLORS = ["#ee6b2f", "#209947", "#e3bb00", "#d9435d", "#7148c7", "#188ff2", "#8b0fa8"];
const EMPTY = "(En blanco)";

function clean(value, fallback = EMPTY) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function hasRealValue(value) {
  const text = String(value ?? "").trim();
  return Boolean(text && text !== EMPTY);
}

function readDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value) {
  const date = readDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(value) {
  return dateKey(value).slice(0, 7);
}

function monthLabel(key) {
  if (!key) return "Todas";
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("es-PE", { year: "numeric", month: "long" });
}

function yearKey(value) {
  return dateKey(value).slice(0, 4);
}

function dayNumber(key) {
  return String(Number(String(key || "").slice(8, 10)) || "");
}

function dateFromKey(key) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function dateKeyFromParts(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function workdayWeight(date) {
  const day = date.getDay();
  if (day >= 1 && day <= 5) return 1;
  if (day === 6) return 0.5;
  return 0;
}

function laborableDaysBetween(startKey, endKey) {
  const start = dateFromKey(startKey);
  const end = dateFromKey(endKey);
  if (!start || !end || start > end) return 0;
  let total = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    total += workdayWeight(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

function dateRangeForContext(filters, records) {
  if (filters.dateLevel === "day" && filters.dateValue) return { start: filters.dateValue, end: filters.dateValue };
  if (filters.dateLevel === "month" && filters.dateValue) {
    const [year, month] = filters.dateValue.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return { start: dateKeyFromParts(year, month, 1), end: dateKeyFromParts(year, month, lastDay) };
  }
  if (filters.dateLevel === "year" && filters.dateValue) return { start: `${filters.dateValue}-01-01`, end: `${filters.dateValue}-12-31` };
  const days = records.map((item) => item.day).filter(Boolean).sort();
  if (!days.length) return { start: "", end: "" };
  return { start: days[0], end: days[days.length - 1] };
}

function todayKey() {
  const today = new Date();
  return dateKeyFromParts(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

function minDateKey(a, b) {
  if (!a) return b || "";
  if (!b) return a || "";
  return a <= b ? a : b;
}

function laborableDaysForContext(filters, records) {
  const range = dateRangeForContext(filters, records);
  if (!range.start || !range.end) return 0;
  return laborableDaysBetween(range.start, range.end);
}

function elapsedLaborableDaysForContext(filters, records) {
  const range = dateRangeForContext(filters, records);
  if (!range.start || !range.end) return 0;
  const elapsedEnd = minDateKey(range.end, todayKey());
  if (elapsedEnd < range.start) return 0;
  return laborableDaysBetween(range.start, elapsedEnd);
}

function monthNameFromNumber(month) {
  return new Date(2026, Number(month) - 1, 1).toLocaleDateString("es-PE", { month: "long" });
}

function moneyNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, decimals = 0) {
  return Number(value || 0).toLocaleString("es-PE", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function uniqueCount(values) {
  return new Set(values.filter((value) => value !== null && value !== undefined && String(value).trim() !== "")).size;
}

function latestRow(rows, field) {
  return [...rows].sort((a, b) => (readDate(b[field])?.getTime() || 0) - (readDate(a[field])?.getTime() || 0))[0] || rows[0] || {};
}

function daysBetween(startValue, endValue) {
  const start = readDate(startValue);
  const end = readDate(endValue);
  if (!start || !end) return null;
  return Math.max(0, (end.getTime() - start.getTime()) / 86400000);
}

function avg(values) {
  const valid = values.filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + Number(value), 0) / valid.length;
}

function isEffectiveAppointment(value) {
  const status = String(value || "").toLowerCase().trim();
  return ["finalizada", "finalizado", "cita efectiva", "efectiva", "orden creada", "realizada", "realizado", "atendida", "atendido", "completada", "completado"].includes(status);
}

function isRescheduledAppointment(value) {
  return String(value || "").toLowerCase().includes("reprogram");
}

function platformUseScore(record) {
  const required = [
    record.code,
    record.client,
    record.clientType,
    record.vehicle,
    record.stage,
    record.origin,
    record.advisor,
    record.createdAt,
  ];
  return required.every((value) => clean(value, "") !== "") ? 1 : 0;
}

function groupCount(records, key, limit = 10) {
  const map = new Map();
  records.forEach((record) => {
    const label = clean(typeof key === "function" ? key(record) : record[key]);
    if (!hasRealValue(label)) return;
    map.set(label, (map.get(label) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function uniqueRows(rows, keyGetter) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyGetter(row);
    if (key && !map.has(key)) map.set(key, row);
  });
  return Array.from(map.values());
}

function buildRecords(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = row.oportunidadpv_db_id || row.codigooportunidadpv;
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  return Array.from(groups.entries()).map(([id, group]) => {
    const base = latestRow(group, "fechaactualizacionoportunidadpv");
    const quoteRows = uniqueRows(group, (row) => row.cotizacion_id);
    const citaRows = uniqueRows(group, (row) => row.cita_id);
    const viewRows = uniqueRows(group, (row) => row.cotizacion_vista_id);
    const close = latestRow(group.filter((row) => row.cierre_created_at), "cierre_created_at");
    const effectiveCitaRows = citaRows.filter((row) => isEffectiveAppointment(row.cita_estado));
    const reprogrammedCitaRows = citaRows.filter((row) => isRescheduledAppointment(row.cita_estado));
    const vehicle = [base.vehiculo_marca, base.vehiculo_modelo].map((item) => clean(item, "")).filter(Boolean).join(" ") || EMPTY;
    const plate = clean(base.vehiculo_placa || base.vehiculo_vin, "");
    const center = clean(base.cotizacion_centro || base.cita_centro || base.cita_taller || base.cotizacion_taller || base.cotizacion_mostrador);

    return {
      id,
      code: clean(base.codigooportunidadpv),
      createdAt: base.fechacreacionoportunidadpv,
      day: dateKey(base.fechacreacionoportunidadpv),
      month: monthKey(base.fechacreacionoportunidadpv),
      year: yearKey(base.fechacreacionoportunidadpv),
      advisor: clean(base.usuario_asignado_nombre || base.cita_asesor_nombre || base.cotizacion_usuario_nombre || base.usuario_asignado_username, "Sin asesor"),
      client: clean(base.nombreapellidocliente),
      clientType: clean(base.tipoidentificacioncliente),
      model: clean(base.vehiculo_modelo),
      vehicle,
      vehicleDetail: plate ? `${vehicle} / ${plate}` : vehicle,
      stage: clean(base.etapa_nombre),
      origin: clean(base.suborigen_nombre || base.origen_nombre),
      center,
      service: clean(base.cita_tipo_servicio || base.cotizacion_tipo || base.producto_descripcion),
      quoteCount: quoteRows.length,
      quoteTotal: quoteRows.reduce((sum, row) => sum + moneyNumber(row.cotizacion_monto_total), 0),
      productCount: uniqueCount(group.map((row) => row.cotizacion_producto_id)),
      appointmentCount: citaRows.length,
      reprogramCount: reprogrammedCitaRows.length,
      effectiveAppointmentCount: effectiveCitaRows.length,
      daysToAppointments: citaRows.map((row) => daysBetween(base.fechacreacionoportunidadpv, row.cita_start_at || row.cita_created_at)),
      daysToEffectiveAppointments: effectiveCitaRows.map((row) => daysBetween(base.fechacreacionoportunidadpv, row.cita_start_at || row.cita_created_at)),
      viewCount: viewRows.length,
      virtualQuoteCount: quoteRows.filter((row) => clean(row.cotizacion_public_token, "") !== "").length,
      closureReason: clean(close.cierre_detalle || base.cierre_detalle),
      closedAt: close.cierre_created_at,
      daysToClose: daysBetween(base.fechacreacionoportunidadpv, close.cierre_created_at),
      followUp: Boolean(base.fecha_agenda || base.hora_agenda || base.ultima_actividad_created_at),
    };
  });
}

function filterRecords(records, filters, chartFilters) {
  return records.filter((record) => {
    const matchesDate =
      !filters.dateValue ||
      (filters.dateLevel === "year" && record.year === filters.dateValue) ||
      (filters.dateLevel === "month" && record.month === filters.dateValue) ||
      (filters.dateLevel === "day" && record.day === filters.dateValue);
    const matchesVehicle =
      !filters.vehicleValue ||
      (filters.vehicleLevel === "brand" && record.vehicle.toLowerCase().startsWith(filters.vehicleValue.toLowerCase())) ||
      (filters.vehicleLevel === "vehicle" && record.vehicle === filters.vehicleValue);
    const basic =
      matchesDate &&
      (!filters.advisor || record.advisor === filters.advisor) &&
      matchesVehicle &&
      (!filters.stage || record.stage === filters.stage);
    const chart = Object.entries(chartFilters).every(([field, value]) => !value || record[field] === value);
    return basic && chart;
  });
}

function lineByDay(records) {
  const days = Array.from(new Set(records.map((item) => item.day).filter(Boolean))).sort();
  return days.map((day) => ({ day: day.slice(5), value: records.filter((item) => item.day === day).length }));
}

function buildDateTree(records) {
  const years = new Map();
  records.forEach((record) => {
    if (!record.year || !record.month || !record.day) return;
    if (!years.has(record.year)) years.set(record.year, new Map());
    const months = years.get(record.year);
    const month = record.month.slice(5, 7);
    if (!months.has(month)) months.set(month, new Set());
    months.get(month).add(record.day);
  });
  return Array.from(years.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([year, months]) => ({
    year,
    months: Array.from(months.entries()).sort((a, b) => Number(a[0]) - Number(b[0])).map(([month, days]) => ({
      month,
      key: `${year}-${month}`,
      label: monthNameFromNumber(month),
      days: Array.from(days).sort().map((day) => ({ key: day, label: dayNumber(day) })),
    })),
  }));
}

function buildVehicleTree(records) {
  const map = new Map();
  records.forEach((record) => {
    const brand = clean(record.vehicle.split(" ")[0], "Sin marca");
    if (!map.has(brand)) map.set(brand, new Set());
    map.get(brand).add(record.vehicle);
  });
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([brand, vehicles]) => ({
    brand,
    vehicles: Array.from(vehicles).sort().map((vehicle) => ({ key: vehicle, label: vehicle })),
  }));
}

export default function PostventaReportsDashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ dateLevel: "", dateValue: "", advisor: "", vehicleLevel: "", vehicleValue: "", stage: "" });
  const [chartFilters, setChartFilters] = useState({});
  const [focusChart, setFocusChart] = useState(null);
  const [vehiclesWithoutOpportunity, setVehiclesWithoutOpportunity] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/powerbi/posventa/data?limit=100000")
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || "No se pudo cargar la data.");
        return payload;
      })
      .then((payload) => {
        if (!cancelled) setRows(Array.isArray(payload) ? payload : []);
      })
      .catch((error) => {
        if (!cancelled) setMessage(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/powerbi/posventa/vehiculos-sin-oportunidad/data?withMeta=1&page=1&limit=1")
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || "No se pudo cargar vehiculos sin oportunidad.");
        return payload;
      })
      .then((payload) => {
        if (!cancelled) setVehiclesWithoutOpportunity(Number(payload?.meta?.total || 0));
      })
      .catch(() => {
        if (!cancelled) setVehiclesWithoutOpportunity(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const records = useMemo(() => buildRecords(rows), [rows]);
  const filteredRecords = useMemo(() => filterRecords(records, filters, chartFilters), [records, filters, chartFilters]);
  const reportRecords = useMemo(() => filteredRecords.filter((record) => hasRealValue(record.code)), [filteredRecords]);
  const selectable = useMemo(() => ({
    months: Array.from(new Set(records.map((item) => item.month).filter(Boolean))).sort().reverse(),
    advisors: groupCount(records, "advisor", 100).map((item) => item.name).sort((a, b) => a.localeCompare(b)),
    vehicles: groupCount(records, "vehicle", 100).map((item) => item.name).sort((a, b) => a.localeCompare(b)),
    stages: groupCount(records, "stage", 100).map((item) => item.name),
  }), [records]);
  const dateTree = useMemo(() => buildDateTree(records), [records]);
  const vehicleTree = useMemo(() => buildVehicleTree(records), [records]);

  const kpis = useMemo(() => {
    const prospectDays = laborableDaysForContext(filters, reportRecords) || 1;
    const elapsedProspectDays = elapsedLaborableDaysForContext(filters, reportRecords) || 1;
    const appointmentDays = reportRecords.flatMap((item) => item.daysToAppointments || []);
    const effectiveAppointmentDays = reportRecords.flatMap((item) => item.daysToEffectiveAppointments || []);
    const platformBase = reportRecords.length;
    const scheduledOpportunityCount = reportRecords.filter((item) => Number(item.appointmentCount || 0) > 0).length;
    const notCompletedAppointmentCount = reportRecords.filter((item) => Number(item.appointmentCount || 0) > 0 && Number(item.effectiveAppointmentCount || 0) === 0).length;
    return {
      opportunities: reportRecords.length,
      managed: reportRecords.filter((item) => item.followUp || item.quoteCount || item.appointmentCount || item.closedAt).length,
      projected: (reportRecords.length / elapsedProspectDays) * prospectDays,
      quotes: reportRecords.reduce((sum, item) => sum + item.quoteCount, 0),
      quoted: reportRecords.reduce((sum, item) => sum + item.quoteTotal, 0),
      reprogrammed: reportRecords.reduce((sum, item) => sum + item.reprogramCount, 0),
      appointments: reportRecords.reduce((sum, item) => sum + item.appointmentCount, 0),
      notCompletedAppointments: notCompletedAppointmentCount,
      notCompletedAppointmentsPercent: scheduledOpportunityCount ? (notCompletedAppointmentCount / scheduledOpportunityCount) * 100 : 0,
      daysAppointment: avg(appointmentDays),
      effectiveAppointments: reportRecords.reduce((sum, item) => sum + item.effectiveAppointmentCount, 0),
      daysEffective: avg(effectiveAppointmentDays),
      products: reportRecords.reduce((sum, item) => sum + item.productCount, 0),
      views: reportRecords.reduce((sum, item) => sum + item.viewCount, 0),
      virtualQuotes: reportRecords.reduce((sum, item) => sum + item.virtualQuoteCount, 0),
      followUp: reportRecords.filter((item) => item.followUp).length,
      closed: reportRecords.filter((item) => item.closedAt).length,
      daysClose: avg(reportRecords.map((item) => item.daysToClose)),
      withoutOpportunity: vehiclesWithoutOpportunity,
      platformUse: platformBase ? (reportRecords.reduce((sum, item) => sum + platformUseScore(item), 0) / platformBase) * 100 : 0,
    };
  }, [reportRecords, filters, vehiclesWithoutOpportunity]);

  const charts = useMemo(() => ({
    model: groupCount(reportRecords, "model", 8),
    stage: groupCount(reportRecords, "stage", 8),
    advisor: groupCount(reportRecords, "advisor", 8),
    vehicle: groupCount(reportRecords, "vehicle", 8),
    service: groupCount(reportRecords, "service", 8),
    center: groupCount(reportRecords, "center", 8),
    origin: groupCount(reportRecords, "origin", 8),
    clientType: groupCount(reportRecords, "clientType", 8),
    closureReason: groupCount(reportRecords, "closureReason", 6),
    days: lineByDay(reportRecords),
  }), [reportRecords]);

  function toggleChartFilter(field, value) {
    setChartFilters((current) => ({ ...current, [field]: current[field] === value ? "" : value }));
  }

  function clearAll() {
    setFilters({ dateLevel: "", dateValue: "", advisor: "", vehicleLevel: "", vehicleValue: "", stage: "" });
    setChartFilters({});
  }

  return (
    <div className="min-h-full bg-[#e9eef2] text-slate-950">
      <div className="min-h-[calc(100svh-1rem)]">
        <main className="min-w-0 p-2">
          <Card className="relative z-40 mb-2 overflow-visible gap-2 bg-[#8798a3] p-3 py-3">
          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[240px_190px_230px_150px_1fr_92px]">
            <DateTreeFilter valueLevel={filters.dateLevel} value={filters.dateValue} tree={dateTree} onChange={(dateLevel, dateValue) => setFilters((current) => ({ ...current, dateLevel, dateValue }))} />
            <FilterBox label="Asesor" value={filters.advisor} onChange={(value) => setFilters((current) => ({ ...current, advisor: value }))} options={[["", "Todas"], ...selectable.advisors.map((item) => [item, item])]} />
            <VehicleTreeFilter valueLevel={filters.vehicleLevel} value={filters.vehicleValue} tree={vehicleTree} onChange={(vehicleLevel, vehicleValue) => setFilters((current) => ({ ...current, vehicleLevel, vehicleValue }))} />
            <FilterBox label="Etapa" value={filters.stage} onChange={(value) => setFilters((current) => ({ ...current, stage: value }))} options={[["", "Todas"], ...selectable.stages.map((item) => [item, item])]} />
            <div className="flex items-end justify-end">
              <Button type="button" variant="outline" size="lg" className="h-9 w-full bg-white text-violet-700 shadow-sm hover:bg-violet-50 sm:w-auto" onClick={clearAll}>
                <RotateCcw className="size-4" /> Limpiar
              </Button>
            </div>
            <div className="rounded-md bg-white p-2 text-center shadow-sm">
              <p className="text-[10px] font-bold text-slate-500">Uso Plataforma</p>
              <p className="text-2xl font-bold">{formatNumber(kpis.platformUse, 0)} %</p>
            </div>
          </section>
          </Card>

          {message ? <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</div> : null}
          {loading ? (
            <ReportsLoadingState />
          ) : (
            <>
              <section className="mb-2 grid grid-cols-2 gap-1.5 md:grid-cols-6 xl:grid-cols-12">
                <Kpi title="Oportunidades" value={formatNumber(kpis.opportunities)} />
                <Kpi title="Gestionadas" value={formatNumber(kpis.managed)} />
                <Kpi title="Proyectado" value={formatNumber(kpis.projected)} />
                <Kpi title="Cotizaciones" value={formatNumber(kpis.quotes)} />
                <Kpi title="Reprogramaciones" value={formatNumber(kpis.reprogrammed)} />
                <Kpi title="Agendamientos" value={formatNumber(kpis.appointments)} />
                <Kpi title="No concretaron" value={`${formatNumber(kpis.notCompletedAppointments)} / ${formatNumber(kpis.notCompletedAppointmentsPercent, 1)}%`} />
                <Kpi title="Días Agendamiento" value={formatNumber(kpis.daysAppointment, 1)} />
                <Kpi title="Efectiva" value={`${formatNumber(kpis.effectiveAppointments)} / ${formatNumber(kpis.daysEffective, 1)} d`} />
                <Kpi title="Cant Coti Virtuales" value={formatNumber(kpis.virtualQuotes)} />
                <Kpi title="Total Vistas" value={formatNumber(kpis.views)} />
                <Kpi title="Seguimiento" value={formatNumber(kpis.followUp)} />
              </section>

              <section className="grid gap-2 xl:grid-cols-[1fr_1fr_1fr_1fr]">
                <Panel title="Oportunidad por Modelo" summary={chartSummary(charts.model, "modelo")} onFocus={() => setFocusChart("model")}><Donut data={charts.model} field="model" active={chartFilters.model} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Etapas" summary={chartSummary(charts.stage, "etapa")} onFocus={() => setFocusChart("stage")}><StageFunnel data={charts.stage} active={chartFilters.stage} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Asesor" summary={chartSummary(charts.advisor, "asesor")} onFocus={() => setFocusChart("advisor")}><BarList data={charts.advisor} field="advisor" active={chartFilters.advisor} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Tipo de Servicio" summary={chartSummary(charts.service, "servicio")} onFocus={() => setFocusChart("service")}><Donut data={charts.service} field="service" active={chartFilters.service} onSelect={toggleChartFilter} /></Panel>
              </section>

              <section className="mt-2 grid gap-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
                <Panel title="Oportunidades por Dia" summary={lineSummary(charts.days)} onFocus={() => setFocusChart("days")}><LineChart data={charts.days} /></Panel>
                <Panel title="Centro / Taller" summary={chartSummary(charts.center, "centro")} onFocus={() => setFocusChart("center")}><Donut data={charts.center} field="center" active={chartFilters.center} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Origen" summary={chartSummary(charts.origin, "origen")} onFocus={() => setFocusChart("origin")}><Donut data={charts.origin} field="origin" active={chartFilters.origin} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Tipo de Cliente" summary={chartSummary(charts.clientType, "tipo")} onFocus={() => setFocusChart("clientType")}><Donut data={charts.clientType} field="clientType" active={chartFilters.clientType} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Motivo de Cierre" summary={chartSummary(charts.closureReason, "motivo")} onFocus={() => setFocusChart("closureReason")}><BarList data={charts.closureReason} field="closureReason" active={chartFilters.closureReason} onSelect={toggleChartFilter} /></Panel>
              </section>
              <FocusChartDialog chartKey={focusChart} charts={charts} chartFilters={chartFilters} onClose={() => setFocusChart(null)} onSelect={toggleChartFilter} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ReportsLoadingState() {
  const letters = "HUBCRM".split("");
  return (
    <Card className="flex h-[70svh] items-center justify-center overflow-hidden bg-gradient-to-b from-[#4c16f2] to-[#7b16f2]">
      <div className="text-center">
        <div className="mb-5 flex items-center justify-center gap-2 text-white">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm font-black uppercase tracking-[0.28em] text-white/85">Cargando reportes</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-5xl font-black sm:text-6xl">
          {letters.map((letter, index) => (
            <span
              key={letter}
              className={`inline-block ${index < 3 ? "text-white" : "text-slate-300"}`}
              style={{
                animation: "hubcrm-wave 2.8s ease-in-out infinite",
                animationDelay: `${index * 0.2}s`,
              }}
            >
              {letter}
            </span>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold text-white/65">Preparando indicadores y graficos</p>
      </div>
      <style jsx>{`
        @keyframes hubcrm-wave {
          0% {
            transform: translateY(12px);
          }
          50% {
            transform: translateY(-12px);
          }
          100% {
            transform: translateY(12px);
          }
        }
      `}</style>
    </Card>
  );
}

function FilterBox({ label, value, onChange, options }) {
  const normalizedOptions = options.map(([optionValue, optionLabel]) => ({
    value: optionValue || "",
    label: optionLabel || "Todas",
  }));
  return (
    <div className="rounded-md border border-slate-700/30 bg-white p-2 shadow-sm">
      <Label className="mb-1 block text-sm font-bold text-slate-900">{label}</Label>
      <SearchableSelect
        value={value || ""}
        options={normalizedOptions}
        placeholder="Todas"
        searchPlaceholder={`Buscar ${label.toLowerCase()}...`}
        emptyText="Sin resultados"
        className="h-8 bg-slate-100 text-xs font-medium text-slate-700"
        onChange={onChange}
      />
    </div>
  );
}

function TreeFilterShell({ label, display, children, onClear }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-50 rounded-md border border-slate-700/30 bg-white p-2 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Label className="block text-sm font-bold text-slate-900">{label}</Label>
        <button type="button" className="text-[10px] font-bold text-slate-500 hover:text-violet-700" onClick={onClear}>Limpiar</button>
      </div>
      <button type="button" className="flex h-8 w-full items-center justify-between bg-slate-100 px-2 text-left text-xs font-medium text-slate-700" onClick={() => setOpen((current) => !current)}>
        <span className="truncate">{display}</span>
        <ChevronDown className={`size-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="absolute left-2 right-2 top-[68px] z-[999] max-h-72 overflow-auto rounded-md border border-slate-300 bg-[#d2d2d2] p-2 text-xs shadow-xl">{children}</div> : null}
    </div>
  );
}

function DateTreeFilter({ valueLevel, value, tree, onChange }) {
  const [openYears, setOpenYears] = useState({});
  const [openMonths, setOpenMonths] = useState({});
  return (
    <TreeFilterShell label="Fecha" display={dateTreeDisplay(valueLevel, value)} onClear={() => onChange("", "")}>
      {tree.map((year) => (
        <div key={year.year} className="space-y-1">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setOpenYears((current) => ({ ...current, [year.year]: !(current[year.year] ?? true) }))}>{(openYears[year.year] ?? true) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}</button>
            <button type="button" className="inline-flex items-center gap-2" onClick={() => onChange("year", year.year)}><span className={`size-3 border ${valueLevel === "year" && value === year.year ? "bg-slate-700" : "bg-transparent"}`} /><span className="font-semibold">{year.year}</span></button>
          </div>
          {(openYears[year.year] ?? true) ? (
            <div className="ml-5 space-y-1">
              {year.months.map((month) => (
                <div key={month.key}>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setOpenMonths((current) => ({ ...current, [month.key]: !(current[month.key] ?? true) }))}>{(openMonths[month.key] ?? true) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}</button>
                    <button type="button" className="inline-flex items-center gap-2" onClick={() => onChange("month", month.key)}><span className={`size-3 border ${valueLevel === "month" && value === month.key ? "bg-slate-700" : "bg-transparent"}`} /><span>{month.label}</span></button>
                  </div>
                  {(openMonths[month.key] ?? true) ? <div className="ml-8 grid gap-1">{month.days.map((day) => <button key={day.key} type="button" className="inline-flex items-center gap-2 text-left" onClick={() => onChange("day", day.key)}><span className={`size-3 border ${valueLevel === "day" && value === day.key ? "bg-slate-700" : "bg-transparent"}`} /><span>{day.label}</span></button>)}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </TreeFilterShell>
  );
}

function VehicleTreeFilter({ valueLevel, value, tree, onChange }) {
  const [openBrands, setOpenBrands] = useState({});
  return (
    <TreeFilterShell label="Vehiculo" display={value || "Todos"} onClear={() => onChange("", "")}>
      {tree.map((brand) => (
        <div key={brand.brand} className="space-y-1">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setOpenBrands((current) => ({ ...current, [brand.brand]: !(current[brand.brand] ?? true) }))}>{(openBrands[brand.brand] ?? true) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}</button>
            <button type="button" className="inline-flex min-w-0 items-center gap-2" onClick={() => onChange("brand", brand.brand)}><span className={`size-3 shrink-0 border ${valueLevel === "brand" && value === brand.brand ? "bg-slate-700" : "bg-transparent"}`} /><span className="truncate font-semibold">{brand.brand}</span></button>
          </div>
          {(openBrands[brand.brand] ?? true) ? <div className="ml-8 grid gap-1">{brand.vehicles.map((vehicle) => <button key={vehicle.key} type="button" className="inline-flex min-w-0 items-center gap-2 text-left" onClick={() => onChange("vehicle", vehicle.key)}><span className={`size-3 shrink-0 border ${valueLevel === "vehicle" && value === vehicle.key ? "bg-slate-700" : "bg-transparent"}`} /><span className="truncate">{vehicle.label}</span></button>)}</div> : null}
        </div>
      ))}
    </TreeFilterShell>
  );
}

function dateTreeDisplay(level, value) {
  if (!value) return "Todas";
  if (level === "year") return `${value} (Año)`;
  if (level === "month") return monthLabel(value);
  if (level === "day") return value.split("-").reverse().join("/");
  return "Todas";
}

function Kpi({ title, value }) {
  return (
    <Card className="gap-0 overflow-hidden bg-white py-0 shadow-sm">
      <div className="bg-gradient-to-r from-[#6717f2] to-[#4b16df] px-2 py-1 text-center text-xs font-black text-white">{title}</div>
      <CardContent className="flex h-14 items-center justify-center px-2 text-xl font-bold md:text-2xl">{value || "-"}</CardContent>
    </Card>
  );
}

function Panel({ title, children, summary, onFocus }) {
  return (
    <Card className="min-h-[270px] gap-0 overflow-hidden bg-white py-0 shadow-sm ring-slate-400">
      <CardHeader className="grid grid-cols-[1fr_auto] items-center bg-gradient-to-r from-[#6717f2] to-[#4b16df] px-2 py-1">
        <CardTitle className="text-right text-xs font-black text-white">{title}</CardTitle>
        {onFocus ? <button type="button" className="ml-2 inline-flex size-5 items-center justify-center rounded-sm bg-white/15 text-white hover:bg-white/25" title="Modo enfoque" onClick={onFocus}><Expand className="size-3.5" /></button> : null}
      </CardHeader>
      <CardContent className="p-2">
        <div className="h-[220px]">{children}</div>
        <p className="mt-2 line-clamp-2 border-t border-slate-100 pt-2 text-[10px] font-semibold leading-tight text-slate-600">{summary || "Sin datos suficientes para resumir."}</p>
      </CardContent>
    </Card>
  );
}

function chartSummary(data, label) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const top = data[0];
  if (!top || !total) return "Sin registros para este grafico.";
  return `Mayor ${label}: ${top.name} con ${top.value} (${formatNumber((Number(top.value || 0) / total) * 100, 1)}% de ${total}).`;
}

function lineSummary(data) {
  if (!data.length) return "Sin registros por dia.";
  const top = [...data].sort((a, b) => Number(b.value || 0) - Number(a.value || 0))[0];
  return top?.value ? `Dia con mas oportunidades: ${top.day} (${top.value}).` : "Sin registros por dia.";
}

function FocusChartDialog({ chartKey, charts, chartFilters, onClose, onSelect }) {
  if (!chartKey) return null;
  const config = {
    model: { title: "Oportunidad por Modelo", summary: chartSummary(charts.model, "modelo"), content: <Donut data={charts.model} field="model" active={chartFilters.model} onSelect={onSelect} /> },
    stage: { title: "Etapas", summary: chartSummary(charts.stage, "etapa"), content: <StageFunnel data={charts.stage} active={chartFilters.stage} onSelect={onSelect} /> },
    advisor: { title: "Asesor", summary: chartSummary(charts.advisor, "asesor"), content: <BarList data={charts.advisor} field="advisor" active={chartFilters.advisor} onSelect={onSelect} /> },
    vehicle: { title: "Vehiculo", summary: chartSummary(charts.vehicle, "vehiculo"), content: <Donut data={charts.vehicle} field="vehicle" active={chartFilters.vehicle} onSelect={onSelect} /> },
    service: { title: "Tipo de Servicio", summary: chartSummary(charts.service, "servicio"), content: <Donut data={charts.service} field="service" active={chartFilters.service} onSelect={onSelect} /> },
    days: { title: "Oportunidades por Dia", summary: lineSummary(charts.days), content: <LineChart data={charts.days} /> },
    center: { title: "Centro / Taller", summary: chartSummary(charts.center, "centro"), content: <Donut data={charts.center} field="center" active={chartFilters.center} onSelect={onSelect} /> },
    origin: { title: "Origen", summary: chartSummary(charts.origin, "origen"), content: <Donut data={charts.origin} field="origin" active={chartFilters.origin} onSelect={onSelect} /> },
    clientType: { title: "Tipo de Cliente", summary: chartSummary(charts.clientType, "tipo"), content: <Donut data={charts.clientType} field="clientType" active={chartFilters.clientType} onSelect={onSelect} /> },
    closureReason: { title: "Motivo de Cierre", summary: chartSummary(charts.closureReason, "motivo"), content: <BarList data={charts.closureReason} field="closureReason" active={chartFilters.closureReason} onSelect={onSelect} /> },
  }[chartKey];
  if (!config) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-[min(96vw,1180px)] overflow-hidden bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-slate-200 px-5 py-4">
          <DialogTitle className="text-base font-bold text-violet-700">{config.title}</DialogTitle>
          <DialogDescription>{config.summary}</DialogDescription>
        </DialogHeader>
        <div className="h-[min(72svh,680px)] p-4">{config.content}</div>
      </DialogContent>
    </Dialog>
  );
}

function BarList({ data, field, active, onSelect }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 14, bottom: 8, left: 2 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={[0, max]} hide />
        <YAxis type="category" dataKey="name" width={94} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} onClick={(entry) => onSelect(field, entry.name)}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} opacity={!active || active === entry.name ? 1 : 0.28} className="cursor-pointer" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function StageFunnel({ data, active, onSelect, field = "stage" }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const percentData = data.map((item, index) => ({
    ...item,
    color: STAGE_COLORS[index % STAGE_COLORS.length],
    percent: total ? (Number(item.value || 0) / total) * 100 : 0,
    centerLabel: `${formatNumber(item.value)} - ${formatNumber(total ? (Number(item.value || 0) / total) * 100 : 0, 1)}%`,
  }));
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_150px] items-center gap-2">
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart margin={{ top: 10, right: 4, bottom: 10, left: 4 }}>
          <Tooltip
            itemSorter={() => 0}
            formatter={(value, name, item) => [
              `${formatNumber(item?.payload?.value)} de ${formatNumber(total)} / ${formatNumber(value, 1)}%`,
              "Etapa",
            ]}
          />
          <Funnel dataKey="percent" data={percentData} nameKey="name" isAnimationActive onClick={(entry) => onSelect(field, entry.name)}>
            <LabelList content={<StageCenterLabel />} />
            {percentData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} opacity={!active || active === entry.name ? 1 : 0.3} className="cursor-pointer" />
            ))}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
      <div className="max-h-full space-y-1 overflow-auto pr-1 text-[10px] leading-tight">
        {percentData.map((item) => {
          const selected = !active || active === item.name;
          return (
            <button
              key={item.name}
              type="button"
              className={`flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left transition hover:bg-slate-50 ${selected ? "opacity-100" : "opacity-40"}`}
              onClick={() => onSelect(field, item.name)}
              title={item.name}
            >
              <span className="mt-0.5 size-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="min-w-0 flex-1">
                <span className="block whitespace-normal break-words font-black text-slate-700">{item.name}</span>
                <span className="block font-bold text-slate-500">{formatNumber(item.value)} - {formatNumber(item.percent, 1)}%</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StageCenterLabel(props) {
  const box = props.viewBox || {};
  const x = Number(props.x ?? box.x ?? 0);
  const y = Number(props.y ?? box.y ?? 0);
  const width = Number(props.width ?? box.width ?? 0);
  const height = Number(props.height ?? box.height ?? 0);
  const payload = props.payload || {};
  const cx = x + width / 2;
  const cy = y + height / 2;
  const compact = height < 54;

  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={compact ? 9 : 11} fontWeight={800} pointerEvents="none">
      <tspan>{payload.centerLabel}</tspan>
    </text>
  );
}

function Donut({ data, field, active, onSelect }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="grid h-full grid-cols-[1fr_112px] items-center gap-2">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip formatter={(value) => [value, "Total"]} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="48%"
            outerRadius="76%"
            paddingAngle={1}
            onClick={(entry) => onSelect(field, entry.name)}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} opacity={!active || active === entry.name ? 1 : 0.25} className="cursor-pointer" />
            ))}
          </Pie>
          <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900 text-[18px] font-bold">{total}</text>
          <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[8px]">Total</text>
        </PieChart>
      </ResponsiveContainer>
      <div className="max-h-full space-y-1 overflow-y-auto pr-1">
        {data.map((entry, index) => (
          <button key={entry.name} type="button" className="grid w-full grid-cols-[10px_1fr_auto] items-center gap-1 text-left text-[10px]" onClick={() => onSelect(field, entry.name)}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length], opacity: !active || active === entry.name ? 1 : 0.25 }} />
            <span className="truncate">{entry.name}</span>
            <span className="font-bold">{entry.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsLineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#188ff2" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
