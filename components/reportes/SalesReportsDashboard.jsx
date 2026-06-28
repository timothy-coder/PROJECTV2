"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Expand, Loader2, RotateCcw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Line,
  LineChart,
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
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es-PE", { year: "numeric", month: "long" });
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
  if (filters.dateLevel === "day" && filters.dateValue) {
    return { start: filters.dateValue, end: filters.dateValue };
  }
  if (filters.dateLevel === "month" && filters.dateValue) {
    const [year, month] = filters.dateValue.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return { start: dateKeyFromParts(year, month, 1), end: dateKeyFromParts(year, month, lastDay) };
  }
  if (filters.dateLevel === "year" && filters.dateValue) {
    return { start: `${filters.dateValue}-01-01`, end: `${filters.dateValue}-12-31` };
  }
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

function daysBetween(startValue, endValue) {
  const start = readDate(startValue);
  const end = readDate(endValue);
  if (!start || !end) return null;
  return Math.max(0, (end.getTime() - start.getTime()) / 86400000);
}

function clean(value, fallback = EMPTY) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function hasRealValue(value) {
  const text = String(value ?? "").trim();
  return Boolean(text) && text !== EMPTY && text.toLowerCase() !== "(en blanco)";
}

function isClosedStage(value) {
  return String(value || "").trim().toLowerCase() === "cerrada";
}

function uniqueCount(values) {
  return new Set(values.filter((value) => value !== null && value !== undefined && String(value).trim() !== "")).size;
}

function countVisitQuoteTokens(rows) {
  return uniqueCount(rows.map((row) => row.tokenvistacotizacion));
}

function pickFirstValue(...values) {
  return values.find((value) => hasRealValue(value)) ?? "";
}

function uniqueRows(rows, keyGetter) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyGetter(row);
    if (key && !map.has(key)) map.set(key, row);
  });
  return Array.from(map.values());
}

function latestRow(rows, dateField) {
  return [...rows].sort((a, b) => (readDate(b[dateField])?.getTime() || 0) - (readDate(a[dateField])?.getTime() || 0))[0] || rows[0] || {};
}

function moneyNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, decimals = 0) {
  const number = Number(value || 0);
  return number.toLocaleString("es-PE", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function buildOpportunityRecords(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = row.oportunidad_db_id || row.codigodeoportunidad;
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  return Array.from(groups.entries()).map(([id, group]) => {
    const base = latestRow(group, "fechacreacionoportunidad");
    const quoteRows = uniqueRows(group, (row) => row.cotizacion_id);
    const reserveRows = uniqueRows(group, (row) => row.reserva_id);
    const latestQuote = latestRow(quoteRows.length ? quoteRows : group, "fechacreaciocotizacion");
    const firstReserve = latestRow(reserveRows.length ? reserveRows : group.filter((row) => row.reserva_detalle_created_at), "reserva_detalle_created_at");
    const closure = latestRow(group.filter((row) => row.fechacreacioncierre), "fechacreacioncierre");
    const viewsByQuote = uniqueRows(group.filter((row) => row.cotizacion_id), (row) => row.cotizacion_id);
    const totalViews = viewsByQuote.reduce((sum, row) => sum + moneyNumber(row.cotizacion_vistas_totales), 0);
    const modelName = clean(latestQuote.modelo_catalogo || latestQuote.modelo_historial);
    const version = clean(latestQuote.version, "");
    const closureReason = clean(closure.motivocierreoportunidad || closure.cierreoportunidaddetalle || base.motivocierreoportunidad);
    const platformFields = [
      base.codigodeoportunidad,
      base.nombreapelidocomlpetoclietne,
      base.fechanacimeintolceitne,
      base.ocupacioncleitne,
      base.nombredepar,
      base.nombreprovi,
      pickFirstValue(latestQuote["añocarro"], latestQuote["aÃ±ocarro"]),
      latestQuote.fechacreaciocotizacion,
      base.tipopersona || latestQuote.tipopersona,
      latestQuote.preciocatalogo,
      latestQuote.version,
      latestQuote.estadocotizacion,
      base.nombreditri,
      closure.motivocierreoportunidad || closure.cierreoportunidaddetalle || base.motivocierreoportunidad,
    ];
    return {
      id,
      code: clean(base.codigodeoportunidad),
      createdAt: base.fechacreacionoportunidad,
      day: dateKey(base.fechacreacionoportunidad),
      month: monthKey(base.fechacreacionoportunidad),
      year: yearKey(base.fechacreacionoportunidad),
      advisor: clean(base.usuarionombreasignadoaoportunidad || base.usuarioasignadoaoportunidad, "Sin asesor"),
      advisorColor: base.colorusuarioasignadoaoportunidad || "",
      creator: clean(base.usuarionombrecreadoroportunidad || base.usuariocreadoroportunidad, "Sin creador"),
      client: clean(base.nombreapelidocomlpetoclietne),
      clientType: clean(base.tipopersona || base.tipoidentifcaion),
      model: modelName,
      modelVersion: [modelName, version].filter((item) => item && item !== EMPTY).join(" / ") || EMPTY,
      stage: clean(base.etapanombre),
      stageColor: base.coloretapa || "",
      stageValue: moneyNumber(base.valoretapa),
      origin: clean(base.origennombre),
      suborigin: clean(base.suboigennombre),
      campaign: clean(base.suboigennombre || base.origennombre),
      city: clean(base.nombreditri || base.nombreprovi || base.nombredepar),
      fuel: clean(latestQuote.combnuistilbe),
      closureReason,
      quoteCount: uniqueCount(group.map((row) => row.cotizacion_id)),
      reservationCount: uniqueCount(group.map((row) => row.reserva_id)),
      virtualQuoteCount: countVisitQuoteTokens(group),
      totalViews,
      followUp: Boolean(base.fecha_agenda || base.hora_agenda),
      daysToReservation: daysBetween(base.fechacreacionoportunidad, firstReserve.reserva_detalle_created_at),
      daysToClose: daysBetween(base.fechacreacionoportunidad, closure.fechacreacioncierre),
      daysToInvoice: daysBetween(base.fechacreacionoportunidad, latestQuote.evento_fecha_facturacion),
      platformUseScore: platformFields.every(hasRealValue) ? 1 : 0,
    };
  });
}

function groupCount(records, key, limit = 10) {
  const map = new Map();
  records.forEach((record) => {
    const value = typeof key === "function" ? key(record) : record[key];
    if (!hasRealValue(value)) return;
    const label = clean(value);
    map.set(label, (map.get(label) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function avg(values) {
  const valid = values.filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + Number(value), 0) / valid.length;
}

function stackByAdvisorAndModel(records) {
  const topModels = groupCount(records, "model", 5).map((item) => item.name);
  const advisors = groupCount(records, "advisor", 6).map((item) => item.name);
  return advisors.map((advisor) => {
    const row = { advisor };
    topModels.forEach((model) => {
      row[model] = records.filter((item) => item.advisor === advisor && item.model === model).length;
    });
    return row;
  });
}

function lineByDayAndAdvisor(records) {
  const advisors = groupCount(records, "advisor", 3).map((item) => item.name);
  const days = Array.from(new Set(records.map((item) => item.day).filter(Boolean))).sort();
  return days.map((day) => {
    const row = { day: dayNumber(day), fullDay: day };
    advisors.forEach((advisor) => {
      row[advisor] = records.filter((item) => item.day === day && item.advisor === advisor).length;
    });
    return row;
  });
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
  return Array.from(years.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, months]) => ({
      year,
      months: Array.from(months.entries())
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([month, days]) => ({
          month,
          key: `${year}-${month}`,
          label: monthNameFromNumber(month),
          days: Array.from(days).sort().map((day) => ({ key: day, label: dayNumber(day) })),
        })),
    }));
}

function buildModelTree(records) {
  const map = new Map();
  records.forEach((record) => {
    if (!hasRealValue(record.model)) return;
    if (!map.has(record.model)) map.set(record.model, new Set());
    if (hasRealValue(record.modelVersion)) map.get(record.model).add(record.modelVersion);
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([model, versions]) => ({
      model,
      versions: Array.from(versions).sort().map((version) => ({ key: version, label: version.replace(`${model} / `, "") || version })),
    }));
}

function filterRecords(records, filters, chartFilters) {
  return records.filter((record) => {
    const code = String(record.code || "").trim().toUpperCase();
    const matchesDate =
      !filters.dateValue ||
      (filters.dateLevel === "year" && record.year === filters.dateValue) ||
      (filters.dateLevel === "month" && record.month === filters.dateValue) ||
      (filters.dateLevel === "day" && record.day === filters.dateValue);
    const matchesModel =
      !filters.modelValue ||
      (filters.modelLevel === "model" && record.model === filters.modelValue) ||
      (filters.modelLevel === "version" && record.modelVersion === filters.modelValue);
    const basic =
      matchesDate &&
      (!filters.advisor || record.advisor === filters.advisor) &&
      (!filters.codeType || code.startsWith(filters.codeType)) &&
      matchesModel &&
      (!filters.stage || record.stage === filters.stage);
    const chart = Object.entries(chartFilters).every(([field, value]) => !value || record[field] === value);
    return basic && chart;
  });
}

export default function SalesReportsDashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ dateLevel: "", dateValue: "", advisor: "", modelLevel: "", modelValue: "", stage: "", codeType: "" });
  const [chartFilters, setChartFilters] = useState({});
  const [focusChart, setFocusChart] = useState(null);
  const [blankModelOpen, setBlankModelOpen] = useState(false);
  const [blankCityOpen, setBlankCityOpen] = useState(false);
  const [blankFuelOpen, setBlankFuelOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/powerbi/data?limit=100000")
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

  const records = useMemo(() => buildOpportunityRecords(rows), [rows]);
  const filteredRecords = useMemo(() => filterRecords(records, filters, chartFilters), [records, filters, chartFilters]);
  const countedRecords = useMemo(() => filteredRecords.filter((record) => hasRealValue(record.model)), [filteredRecords]);
  const selectable = useMemo(() => ({
    months: Array.from(new Set(records.map((item) => item.month).filter(Boolean))).sort().reverse(),
    advisors: groupCount(records, "advisor", 100).map((item) => item.name).sort((a, b) => a.localeCompare(b)),
    modelVersions: groupCount(records, "modelVersion", 100).map((item) => item.name).sort((a, b) => a.localeCompare(b)),
    stages: groupCount(records, "stage", 100).map((item) => item.name),
  }), [records]);
  const availableCodeTypes = useMemo(() => {
    const prefixes = new Set();
    records.forEach((record) => {
      const code = String(record.code || "").trim().toUpperCase();
      if (code.startsWith("OPO")) prefixes.add("OPO");
      if (code.startsWith("LD")) prefixes.add("LD");
      if (code.startsWith("LF")) prefixes.add("LF");
    });
    return ["OPO", "LD", "LF"].filter((prefix) => prefixes.has(prefix));
  }, [records]);
  const dateTree = useMemo(() => buildDateTree(records), [records]);
  const modelTree = useMemo(() => buildModelTree(records), [records]);

  const kpis = useMemo(() => {
    const prospectDays = laborableDaysForContext(filters, countedRecords) || 1;
    const elapsedProspectDays = elapsedLaborableDaysForContext(filters, countedRecords) || 1;
    const quoteCount = countedRecords.reduce((sum, item) => sum + item.quoteCount, 0);
    const virtualQuotes = countedRecords.reduce((sum, item) => sum + item.virtualQuoteCount, 0);
    const platformBase = filteredRecords.length;
    return {
      prospects: countedRecords.length,
      prospectsPerDay: countedRecords.length / prospectDays,
      projected: (countedRecords.length / elapsedProspectDays) * prospectDays,
      quotes: quoteCount,
      reservations: countedRecords.reduce((sum, item) => sum + item.reservationCount, 0),
      daysReserve: avg(countedRecords.map((item) => item.daysToReservation)),
      daysClose: avg(countedRecords.map((item) => item.daysToClose)),
      daysFact: avg(countedRecords.map((item) => item.daysToInvoice)),
      virtualQuotes,
      totalViews: countedRecords.reduce((sum, item) => sum + item.totalViews, 0),
      followUp: countedRecords.filter((item) => item.followUp && !isClosedStage(item.stage)).length,
      platformUse: platformBase ? (filteredRecords.reduce((sum, item) => sum + item.platformUseScore, 0) / platformBase) * 100 : 0,
    };
  }, [countedRecords, filteredRecords, filters]);

  const charts = useMemo(() => ({
    model: groupCount(countedRecords, "model", 8),
    stage: groupCount(countedRecords, "stage", 8),
    advisorModel: stackByAdvisorAndModel(countedRecords),
    clientType: groupCount(countedRecords, "clientType", 8),
    closureReason: groupCount(countedRecords, "closureReason", 6),
    dayAdvisor: lineByDayAndAdvisor(countedRecords),
    campaign: groupCount(countedRecords, "campaign", 8),
    city: groupCount(countedRecords, "city", 8),
    fuel: groupCount(countedRecords, "fuel", 6),
  }), [countedRecords]);
  const advisorColors = useMemo(() => {
    const map = {};
    countedRecords.forEach((record) => {
      if (hasRealValue(record.advisor) && record.advisorColor && !map[record.advisor]) map[record.advisor] = record.advisorColor;
    });
    return map;
  }, [countedRecords]);
  const blankModelRecords = useMemo(() => filteredRecords.filter((record) => !hasRealValue(record.model)), [filteredRecords]);
  const blankCityRecords = useMemo(() => countedRecords.filter((record) => !hasRealValue(record.city)), [countedRecords]);
  const blankFuelRecords = useMemo(() => countedRecords.filter((record) => !hasRealValue(record.fuel)), [countedRecords]);

  function toggleChartFilter(field, value) {
    setChartFilters((current) => ({ ...current, [field]: current[field] === value ? "" : value }));
  }

  function toggleAdvisorFilter(advisor) {
    setFilters((current) => ({ ...current, advisor: current.advisor === advisor ? "" : advisor }));
  }

  function clearAll() {
    setFilters({ dateLevel: "", dateValue: "", advisor: "", modelLevel: "", modelValue: "", stage: "", codeType: "" });
    setChartFilters({});
  }

  return (
    <div className="min-h-full bg-[#e9eef2] text-slate-950">
      <div className="min-h-[calc(100svh-1rem)]">
        <main className="min-w-0 p-2">
          <Card className="relative z-40 mb-2 overflow-visible gap-2 bg-[#8798a3] p-3 py-3">
          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[240px_190px_230px_150px_180px_1fr_92px]">
            <DateTreeFilter
              valueLevel={filters.dateLevel}
              value={filters.dateValue}
              tree={dateTree}
              onChange={(dateLevel, dateValue) => setFilters((current) => ({ ...current, dateLevel, dateValue }))}
            />
            <CommandFilterBox
              label="Asesor"
              value={filters.advisor}
              onChange={(value) => setFilters((current) => ({ ...current, advisor: value }))}
              options={[{ value: "", label: "Todos" }, ...selectable.advisors.map((item) => ({ value: item, label: item }))]}
              placeholder="Todos"
              searchPlaceholder="Buscar asesor..."
            />
            <ModelTreeFilter
              valueLevel={filters.modelLevel}
              value={filters.modelValue}
              tree={modelTree}
              onChange={(modelLevel, modelValue) => setFilters((current) => ({ ...current, modelLevel, modelValue }))}
            />
            <CommandFilterBox
              label="Etapa"
              value={filters.stage}
              onChange={(value) => setFilters((current) => ({ ...current, stage: value }))}
              options={[{ value: "", label: "Todas" }, ...selectable.stages.map((item) => ({ value: item, label: item }))]}
              placeholder="Todas"
              searchPlaceholder="Buscar etapa..."
            />
            <CodeTypeFilter value={filters.codeType} available={availableCodeTypes} onChange={(value) => setFilters((current) => ({ ...current, codeType: value }))} />
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
              <section className="mb-2 grid grid-cols-2 gap-1.5 md:grid-cols-6 xl:grid-cols-11">
                <Kpi title="Prospectos" value={formatNumber(kpis.prospects)} />
                <Kpi title="Pros/Día" value={formatNumber(kpis.prospectsPerDay, 1)} />
                <Kpi title="Proyectado" value={formatNumber(kpis.projected)} />
                <Kpi title="Cotizaciones" value={formatNumber(kpis.quotes)} />
                <Kpi title="Reservas" value={formatNumber(kpis.reservations)} />
                <Kpi title="Días Reserva" value={formatNumber(kpis.daysReserve, 1)} />
                <Kpi title="Días Cierre" value={formatNumber(kpis.daysClose, 1)} />
                <Kpi title="Días Fact" value={formatNumber(kpis.daysFact, 1)} />
                <Kpi title="Cant Coti Virtuales" value={formatNumber(kpis.virtualQuotes)} />
                <Kpi title="Total Vistas" value={formatNumber(kpis.totalViews)} />
                <Kpi title="Seguimiento" value={formatNumber(kpis.followUp)} />
              </section>

              <section className="grid gap-2 xl:grid-cols-[1.25fr_1fr_1fr_1fr_.78fr]">
                <Panel
                  title="Oportunidad por Modelo"
                  summary={modelChartSummary(charts.model, blankModelRecords.length)}
                  onFocus={() => setFocusChart("model")}
                  alertCount={blankModelRecords.length}
                  onAlert={() => setBlankModelOpen(true)}
                >
                  <Donut data={charts.model} field="model" active={chartFilters.model} onSelect={toggleChartFilter} />
                </Panel>
                <Panel title="Etapas" summary={chartSummary(charts.stage, "etapa")} onFocus={() => setFocusChart("stage")}><StageFunnel data={charts.stage} active={chartFilters.stage} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Modelo por Asesor" summary={stackSummary(charts.advisorModel)} onFocus={() => setFocusChart("advisorModel")}><StackedAdvisor data={charts.advisorModel} models={charts.model.map((item) => item.name)} /></Panel>
                <Panel title="Tipo de Cliente" summary={chartSummary(charts.clientType, "tipo")} onFocus={() => setFocusChart("clientType")}><Donut data={charts.clientType} field="clientType" active={chartFilters.clientType} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Motivo de Cierre" summary={chartSummary(charts.closureReason, "motivo")} onFocus={() => setFocusChart("closureReason")}><ReasonBars data={charts.closureReason} active={chartFilters.closureReason} onSelect={toggleChartFilter} /></Panel>
              </section>

              <section className="mt-2 grid gap-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
                <Panel title="Prospectos por Día y Asesor" summary={lineSummary(charts.dayAdvisor)} onFocus={() => setFocusChart("dayAdvisor")}><DayAdvisorLine data={charts.dayAdvisor} advisorColors={advisorColors} activeAdvisor={filters.advisor} onSelectAdvisor={toggleAdvisorFilter} /></Panel>
                <Panel title="Origen con Campañas" summary={chartSummary(charts.campaign, "origen")} onFocus={() => setFocusChart("campaign")}><Donut data={charts.campaign} field="campaign" active={chartFilters.campaign} onSelect={toggleChartFilter} /></Panel>
                <Panel
                  title="Ciudad Origen"
                  summary={cityChartSummary(charts.city, blankCityRecords.length)}
                  onFocus={() => setFocusChart("city")}
                  alertCount={blankCityRecords.length}
                  onAlert={() => setBlankCityOpen(true)}
                >
                  <Donut data={charts.city} field="city" active={chartFilters.city} onSelect={toggleChartFilter} />
                </Panel>
                <Panel
                  title="Tipo de Combustible"
                  summary={blankAwareChartSummary(charts.fuel, "combustible", blankFuelRecords.length, "cotizaciones tienen combustible en blanco y no se cuentan en el gráfico.")}
                  onFocus={() => setFocusChart("fuel")}
                  alertCount={blankFuelRecords.length}
                  onAlert={() => setBlankFuelOpen(true)}
                >
                  <Donut data={charts.fuel} field="fuel" active={chartFilters.fuel} onSelect={toggleChartFilter} />
                </Panel>
              </section>
              <FocusChartDialog
                chartKey={focusChart}
                charts={charts}
                chartFilters={chartFilters}
                activeAdvisor={filters.advisor}
                advisorColors={advisorColors}
                onClose={() => setFocusChart(null)}
                onSelect={toggleChartFilter}
                onSelectAdvisor={toggleAdvisorFilter}
              />
              <BlankModelDialog open={blankModelOpen} records={blankModelRecords} onClose={() => setBlankModelOpen(false)} />
              <BlankCityDialog open={blankCityOpen} records={blankCityRecords} onClose={() => setBlankCityOpen(false)} />
              <BlankFieldDialog
                open={blankFuelOpen}
                records={blankFuelRecords}
                title="Cotizaciones sin tipo de combustible"
                description="Estos registros no se cuentan en el gráfico de combustible. Corrige el combustible en el precio o cotización asociada."
                emptyText="No hay cotizaciones con combustible en blanco."
                onClose={() => setBlankFuelOpen(false)}
              />
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
        <p className="mt-4 text-xs font-semibold text-white/65">Preparando indicadores y gráficos</p>
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

function CommandFilterBox({ label, value, onChange, options, placeholder, searchPlaceholder }) {
  return (
    <div className="rounded-md border border-slate-700/30 bg-white p-2 shadow-sm">
      <Label className="mb-1 block text-sm font-bold text-slate-900">{label}</Label>
      <SearchableSelect
        value={value || ""}
        options={options}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyText="Sin resultados"
        className="h-8 bg-slate-100 text-xs text-slate-700"
        onChange={onChange}
      />
    </div>
  );
}

function CodeTypeFilter({ value, available, onChange }) {
  const options = [
    { value: "", label: "Todos" },
    ...[
      { value: "OPO", label: "OP" },
      { value: "LD", label: "LD" },
      { value: "LF", label: "LF" },
    ].filter((option) => available.includes(option.value)),
  ];
  return (
    <div className="flex min-w-0 items-end">
      <div className="flex h-10 w-full min-w-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.label}
              type="button"
              className={`h-8 min-w-0 flex-1 rounded-md px-2 text-xs font-black transition ${active ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
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
      {open ? (
        <div className="absolute left-2 right-2 top-[68px] z-[999] max-h-72 overflow-auto rounded-md border border-slate-300 bg-[#d2d2d2] p-2 text-xs shadow-xl">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function DateTreeFilter({ valueLevel, value, tree, onChange }) {
  const [openYears, setOpenYears] = useState({});
  const [openMonths, setOpenMonths] = useState({});
  const display = dateTreeDisplay(valueLevel, value);
  return (
    <TreeFilterShell label="Fecha" display={display} onClear={() => onChange("", "")}>
      {tree.map((year) => (
        <div key={year.year} className="space-y-1">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setOpenYears((current) => ({ ...current, [year.year]: !(current[year.year] ?? true) }))}>
              {(openYears[year.year] ?? true) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
            <button type="button" className="inline-flex items-center gap-2" onClick={() => onChange("year", year.year)}>
              <span className={`size-3 border ${valueLevel === "year" && value === year.year ? "bg-slate-700" : "bg-transparent"}`} />
              <span className="font-semibold">{year.year}</span>
            </button>
          </div>
          {(openYears[year.year] ?? true) ? (
            <div className="ml-5 space-y-1">
              {year.months.map((month) => (
                <div key={month.key}>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setOpenMonths((current) => ({ ...current, [month.key]: !(current[month.key] ?? true) }))}>
                      {(openMonths[month.key] ?? true) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                    </button>
                    <button type="button" className="inline-flex items-center gap-2" onClick={() => onChange("month", month.key)}>
                      <span className={`size-3 border ${valueLevel === "month" && value === month.key ? "bg-slate-700" : "bg-transparent"}`} />
                      <span>{month.label}</span>
                    </button>
                  </div>
                  {(openMonths[month.key] ?? true) ? (
                    <div className="ml-8 grid gap-1">
                      {month.days.map((day) => (
                        <button key={day.key} type="button" className="inline-flex items-center gap-2 text-left" onClick={() => onChange("day", day.key)}>
                          <span className={`size-3 border ${valueLevel === "day" && value === day.key ? "bg-slate-700" : "bg-transparent"}`} />
                          <span>{day.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </TreeFilterShell>
  );
}

function ModelTreeFilter({ valueLevel, value, tree, onChange }) {
  const [openModels, setOpenModels] = useState({});
  const display = !value ? "Todas" : valueLevel === "model" ? value : value;
  return (
    <TreeFilterShell label="Modelo / Versión" display={display} onClear={() => onChange("", "")}>
      {tree.map((model) => (
        <div key={model.model} className="space-y-1">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setOpenModels((current) => ({ ...current, [model.model]: !(current[model.model] ?? true) }))}>
              {(openModels[model.model] ?? true) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
            <button type="button" className="inline-flex min-w-0 items-center gap-2" onClick={() => onChange("model", model.model)}>
              <span className={`size-3 shrink-0 border ${valueLevel === "model" && value === model.model ? "bg-slate-700" : "bg-transparent"}`} />
              <span className="truncate font-semibold">{model.model}</span>
            </button>
          </div>
          {(openModels[model.model] ?? true) ? (
            <div className="ml-8 grid gap-1">
              {model.versions.map((version) => (
                <button key={version.key} type="button" className="inline-flex min-w-0 items-center gap-2 text-left" onClick={() => onChange("version", version.key)}>
                  <span className={`size-3 shrink-0 border ${valueLevel === "version" && value === version.key ? "bg-slate-700" : "bg-transparent"}`} />
                  <span className="truncate">{version.label}</span>
                </button>
              ))}
            </div>
          ) : null}
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
      <CardContent className="flex h-14 items-center justify-center px-2 text-xl font-bold sm:text-2xl">{value || "-"}</CardContent>
    </Card>
  );
}

function Panel({ title, children, summary, onFocus, alertCount = 0, onAlert }) {
  return (
    <Card className={`min-h-[270px] gap-0 overflow-visible bg-white py-0 shadow-sm ring-slate-400 ${alertCount ? "ring-2 ring-red-300" : ""}`}>
      <CardHeader className="grid grid-cols-[1fr_auto] items-center bg-gradient-to-r from-[#6717f2] to-[#4b16df] px-2 py-1">
        <CardTitle className="text-right text-xs font-black text-white">{title}</CardTitle>
        <div className="ml-2 flex items-center gap-1">
          {alertCount ? (
            <button
              type="button"
              className="inline-flex h-5 items-center gap-1 rounded-sm bg-red-500 px-1.5 text-[10px] font-black text-white hover:bg-red-600"
              title="Modelos en blanco"
              onClick={onAlert}
            >
              <AlertTriangle className="size-3" />
              {alertCount}
            </button>
          ) : null}
          {onFocus ? (
            <button type="button" className="inline-flex size-5 items-center justify-center rounded-sm bg-white/15 text-white hover:bg-white/25" title="Modo enfoque" onClick={onFocus}>
              <Expand className="size-3.5" />
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <div className="h-[220px]">{children}</div>
        <p className="mt-2 line-clamp-2 border-t border-slate-100 pt-2 text-[10px] font-black leading-tight text-slate-700">{summary || "Sin datos suficientes para resumir."}</p>
      </CardContent>
    </Card>
  );
}

function FocusChartDialog({ chartKey, charts, chartFilters, activeAdvisor, advisorColors, onClose, onSelect, onSelectAdvisor }) {
  if (!chartKey) return null;
  const config = {
    model: {
      title: "Oportunidad por Modelo",
      summary: chartSummary(charts.model, "modelo"),
      content: <Donut data={charts.model} field="model" active={chartFilters.model} onSelect={onSelect} />,
    },
    stage: {
      title: "Etapas",
      summary: chartSummary(charts.stage, "etapa"),
      content: <StageFunnel data={charts.stage} active={chartFilters.stage} onSelect={onSelect} />,
    },
    advisorModel: {
      title: "Modelo por Asesor",
      summary: stackSummary(charts.advisorModel),
      content: <StackedAdvisor data={charts.advisorModel} models={charts.model.map((item) => item.name)} />,
    },
    clientType: {
      title: "Tipo de Cliente",
      summary: chartSummary(charts.clientType, "tipo"),
      content: <Donut data={charts.clientType} field="clientType" active={chartFilters.clientType} onSelect={onSelect} />,
    },
    closureReason: {
      title: "Motivo de Cierre",
      summary: chartSummary(charts.closureReason, "motivo"),
      content: <ReasonBars data={charts.closureReason} active={chartFilters.closureReason} onSelect={onSelect} />,
    },
    dayAdvisor: {
      title: "Prospectos por Día y Asesor",
      summary: lineSummary(charts.dayAdvisor),
      content: <DayAdvisorLine data={charts.dayAdvisor} advisorColors={advisorColors} activeAdvisor={activeAdvisor} onSelectAdvisor={onSelectAdvisor} />,
    },
    campaign: {
      title: "Origen con Campañas",
      summary: chartSummary(charts.campaign, "origen"),
      content: <Donut data={charts.campaign} field="campaign" active={chartFilters.campaign} onSelect={onSelect} />,
    },
    city: {
      title: "Ciudad Origen",
      summary: chartSummary(charts.city, "ciudad"),
      content: <Donut data={charts.city} field="city" active={chartFilters.city} onSelect={onSelect} />,
    },
    fuel: {
      title: "Tipo de Combustible",
      summary: chartSummary(charts.fuel, "combustible"),
      content: <Donut data={charts.fuel} field="fuel" active={chartFilters.fuel} onSelect={onSelect} />,
    },
  }[chartKey];
  if (!config) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-[min(96vw,1180px)] overflow-hidden bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-slate-200 px-5 py-4">
          <DialogTitle className="text-base font-bold text-violet-700">{config.title}</DialogTitle>
          <DialogDescription>{config.summary}</DialogDescription>
        </DialogHeader>
        <div className="h-[min(72svh,680px)] p-4">
          {config.content}
        </div>
      </DialogContent>
    </Dialog>
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

function chartSummary(data, label) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const top = data[0];
  if (!top || !total) return "Sin registros para este gráfico.";
  const percent = (Number(top.value || 0) / total) * 100;
  return `Mayor ${label}: ${top.name} con ${top.value} (${formatNumber(percent, 1)}% de ${total}).`;
}

function modelChartSummary(data, blankCount) {
  const base = chartSummary(data, "modelo");
  if (!blankCount) return base;
  return `${base} Alerta: ${blankCount} oportunidades tienen modelo en blanco y no se cuentan en el gráfico.`;
}

function cityChartSummary(data, blankCount) {
  const base = chartSummary(data, "ciudad");
  if (!blankCount) return base;
  return `${base} Alerta: ${blankCount} clientes tienen ciudad pendiente de actualizar.`;
}

function blankAwareChartSummary(data, label, blankCount, message) {
  const base = chartSummary(data, label);
  if (!blankCount) return base;
  return `${base} Alerta: ${blankCount} ${message}`;
}

function BlankModelDialog({ open, records, onClose }) {
  if (!open) return null;
  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-[min(96vw,980px)] overflow-hidden bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-red-200 bg-red-50 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-700">
            <AlertTriangle className="size-4" />
            Oportunidades con modelo en blanco
          </DialogTitle>
          <DialogDescription className="text-red-700">
            Estos registros no se cuentan en el gráfico de modelos. Corrige la cotización o el precio asociado a la oportunidad.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[72svh] overflow-auto p-3">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-white text-slate-500">
              <tr>
                <th className="border-b px-3 py-2">Codigo</th>
                <th className="border-b px-3 py-2">Cliente</th>
                <th className="border-b px-3 py-2">Asesor</th>
                <th className="border-b px-3 py-2">Etapa</th>
                <th className="border-b px-3 py-2">Fecha</th>
                <th className="border-b px-3 py-2 text-right">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id} className="bg-red-50/35 text-slate-800">
                  <td className="px-3 py-2 font-bold text-red-700">{record.code}</td>
                  <td className="px-3 py-2">{record.client}</td>
                  <td className="px-3 py-2">{record.advisor}</td>
                  <td className="px-3 py-2">{record.stage}</td>
                  <td className="px-3 py-2">{record.day ? record.day.split("-").reverse().join("/") : "-"}</td>
                  <td className="px-3 py-2 text-right">
                    <a className="font-bold text-violet-700 hover:underline" href={`/oportunidades/${record.id}`}>
                      Abrir
                    </a>
                  </td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center font-semibold text-slate-500">
                    No hay oportunidades con modelo en blanco.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BlankCityDialog({ open, records, onClose }) {
  if (!open) return null;
  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-[min(96vw,980px)] overflow-hidden bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-red-200 bg-red-50 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-700">
            <AlertTriangle className="size-4" />
            Clientes sin ciudad de origen
          </DialogTitle>
          <DialogDescription className="text-red-700">
            Estos clientes no se cuentan en el gráfico de ciudad. Actualiza departamento, provincia o distrito del cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[72svh] overflow-auto p-3">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-white text-slate-500">
              <tr>
                <th className="border-b px-3 py-2">Código</th>
                <th className="border-b px-3 py-2">Cliente</th>
                <th className="border-b px-3 py-2">Propietario</th>
                <th className="border-b px-3 py-2">Creador</th>
                <th className="border-b px-3 py-2">Etapa</th>
                <th className="border-b px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id} className="bg-red-50/35 text-slate-800">
                  <td className="px-3 py-2 font-bold text-red-700">{record.code}</td>
                  <td className="px-3 py-2">{record.client}</td>
                  <td className="px-3 py-2">{record.advisor}</td>
                  <td className="px-3 py-2">{record.creator}</td>
                  <td className="px-3 py-2">{record.stage}</td>
                  <td className="px-3 py-2 text-right">
                    <a className="font-bold text-violet-700 hover:underline" href={`/oportunidades/${record.id}`}>
                      Abrir
                    </a>
                  </td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center font-semibold text-slate-500">
                    No hay clientes con ciudad pendiente.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BlankFieldDialog({ open, records, title, description, emptyText, onClose }) {
  if (!open) return null;
  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[92svh] max-w-[min(96vw,980px)] overflow-hidden bg-white p-0 text-slate-950">
        <DialogHeader className="border-b border-red-200 bg-red-50 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-700">
            <AlertTriangle className="size-4" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-red-700">{description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[72svh] overflow-auto p-3">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-white text-slate-500">
              <tr>
                <th className="border-b px-3 py-2">Código</th>
                <th className="border-b px-3 py-2">Cliente</th>
                <th className="border-b px-3 py-2">Modelo</th>
                <th className="border-b px-3 py-2">Asesor</th>
                <th className="border-b px-3 py-2">Etapa</th>
                <th className="border-b px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id} className="bg-red-50/35 text-slate-800">
                  <td className="px-3 py-2 font-bold text-red-700">{record.code}</td>
                  <td className="px-3 py-2">{record.client}</td>
                  <td className="px-3 py-2">{record.modelVersion || record.model}</td>
                  <td className="px-3 py-2">{record.advisor}</td>
                  <td className="px-3 py-2">{record.stage}</td>
                  <td className="px-3 py-2 text-right">
                    <a className="font-bold text-violet-700 hover:underline" href={`/oportunidades/${record.id}`}>
                      Abrir
                    </a>
                  </td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center font-semibold text-slate-500">
                    {emptyText}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function stackSummary(data) {
  if (!data.length) return "Sin registros por asesor.";
  const totals = data.map((row) => ({
    name: row.advisor,
    value: Object.entries(row).filter(([key]) => key !== "advisor").reduce((sum, [, value]) => sum + Number(value || 0), 0),
  })).sort((a, b) => b.value - a.value);
  return totals[0]?.value ? `Asesor con más oportunidades: ${totals[0].name} (${totals[0].value}).` : "Sin registros por asesor.";
}

function lineSummary(data) {
  if (!data.length) return "Sin registros por día.";
  const totals = data.map((row) => ({
    name: row.day,
    value: Object.entries(row).filter(([key]) => key !== "day").reduce((sum, [, value]) => sum + Number(value || 0), 0),
  })).sort((a, b) => b.value - a.value);
  return totals[0]?.value ? `Día con más prospectos: ${totals[0].name} (${totals[0].value}).` : "Sin registros por día.";
}

function StageFunnel({ data, active, onSelect }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const percentData = data.map((item) => ({
    ...item,
    percent: total ? (Number(item.value || 0) / total) * 100 : 0,
    countLabel: `${formatNumber(item.value)} de ${formatNumber(total)}`,
    percentLabel: `${formatNumber(total ? (Number(item.value || 0) / total) * 100 : 0, 1)}%`,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <FunnelChart margin={{ top: 10, right: 8, bottom: 10, left: 8 }}>
        <Tooltip
          itemSorter={() => 0}
          formatter={(value, name, item) => [
            `${formatNumber(item?.payload?.value)} de ${formatNumber(total)} / ${formatNumber(value, 1)}%`,
            "Etapa",
          ]}
        />
        <Funnel dataKey="percent" data={percentData} nameKey="name" isAnimationActive onClick={(entry) => onSelect("stage", entry.name)}>
          <LabelList position="right" fill="#475569" stroke="none" dataKey="name" fontSize={11} />
          <LabelList content={<StageCenterLabel />} />
          {percentData.map((entry, index) => (
            <Cell key={entry.name} fill={STAGE_COLORS[index % STAGE_COLORS.length]} opacity={!active || active === entry.name ? 1 : 0.3} className="cursor-pointer" />
          ))}
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
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
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontWeight={800} pointerEvents="none">
      <tspan x={cx} dy={compact ? -3 : -7} fontSize={compact ? 9 : 11}>
        {payload.countLabel}
      </tspan>
      <tspan x={cx} dy={compact ? 10 : 14} fontSize={compact ? 9 : 11}>
        {payload.percentLabel}
      </tspan>
    </text>
  );
}

function StackedAdvisor({ data, models }) {
  const activeModels = models.slice(0, 5);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 24, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="advisor" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={42} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip
          allowEscapeViewBox={{ x: true, y: true }}
          content={<StackedAdvisorTooltip />}
          cursor={{ fill: "rgba(15, 23, 42, 0.06)" }}
          itemSorter={() => 0}
          offset={18}
          wrapperStyle={{ zIndex: 9999, pointerEvents: "none" }}
        />
        {activeModels.map((model, index) => (
          <Bar key={model} dataKey={model} stackId="modelos" fill={COLORS[index % COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function StackedAdvisorTooltip({ active, payload, label, coordinate }) {
  if (!active || !payload?.length) return null;
  const items = [...payload]
    .filter((item) => Number(item.value || 0) > 0)
    .reverse();
  const shiftLeft = Number(coordinate?.x || 0) > 160;
  return (
    <div
      className="w-52 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] shadow-lg"
      style={{ transform: shiftLeft ? "translate(-112%, -52%)" : "translate(10px, -52%)" }}
    >
      <p className="mb-1 truncate font-black text-slate-700">{label}</p>
      <div className="space-y-1">
        {items.map((item) => (
          <span key={item.dataKey} className="flex items-center gap-1 font-bold" style={{ color: item.color || item.fill }}>
            <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color || item.fill }} />
            <span className="truncate">{item.name}: {item.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ReasonBars({ data, active, onSelect }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, bottom: 8, left: 2 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={[0, max]} hide />
        <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11 }} />
        <Tooltip itemSorter={() => 0} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} onClick={(entry) => onSelect("closureReason", entry.name)}>
          {data.map((item, index) => (
            <Cell key={item.name} fill={COLORS[index % COLORS.length]} opacity={!active || active === item.name ? 1 : 0.3} className="cursor-pointer" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DayAdvisorLine({ data, advisorColors = {}, activeAdvisor, onSelectAdvisor }) {
  const advisors = data.length ? Object.keys(data[0]).filter((key) => key !== "day" && key !== "fullDay") : [];
  return (
    <div className="flex h-full flex-col">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip itemSorter={() => 0} labelFormatter={(label) => `Día ${label}`} />
          {advisors.map((advisor, index) => {
            const color = advisorColors[advisor] || COLORS[index % COLORS.length];
            return (
              <Line
                key={advisor}
                type="monotone"
                dataKey={advisor}
                stroke={color}
                strokeWidth={activeAdvisor === advisor ? 3.5 : 2.5}
                opacity={!activeAdvisor || activeAdvisor === advisor ? 1 : 0.25}
                dot={{ r: 2, strokeWidth: 0, fill: color }}
                activeDot={{ r: 2.5, strokeWidth: 0, fill: color }}
                className="cursor-pointer"
                onClick={() => onSelectAdvisor?.(advisor)}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 text-[10px]">
        {advisors.map((advisor, index) => (
          (() => {
            const color = advisorColors[advisor] || COLORS[index % COLORS.length];
            return (
          <button
            key={advisor}
            type="button"
            className={`inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-semibold ${activeAdvisor === advisor ? "bg-violet-100 text-violet-700" : "text-slate-600 hover:bg-slate-100"}`}
            onClick={() => onSelectAdvisor?.(advisor)}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, opacity: !activeAdvisor || activeAdvisor === advisor ? 1 : 0.25 }} />
            {advisor}
          </button>
            );
          })()
        ))}
      </div>
    </div>
  );
}
