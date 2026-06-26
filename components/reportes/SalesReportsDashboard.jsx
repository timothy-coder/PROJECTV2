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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

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

function uniqueCount(values) {
  return new Set(values.filter((value) => value !== null && value !== undefined && String(value).trim() !== "")).size;
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
    return {
      id,
      code: clean(base.codigodeoportunidad),
      createdAt: base.fechacreacionoportunidad,
      day: dateKey(base.fechacreacionoportunidad),
      month: monthKey(base.fechacreacionoportunidad),
      year: yearKey(base.fechacreacionoportunidad),
      advisor: clean(base.usuarionombreasignadoaoportunidad || base.usuarioasignadoaoportunidad, "Sin asesor"),
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
      closureReason: clean(closure.motivocierreoportunidad || closure.cierreoportunidaddetalle || base.motivocierreoportunidad),
      quoteCount: uniqueCount(group.map((row) => row.cotizacion_id)),
      reservationCount: uniqueCount(group.map((row) => row.reserva_id)),
      virtualQuoteCount: uniqueCount(group.map((row) => row.tokenvistacotizacion)),
      totalViews,
      followUp: Boolean(base.fecha_agenda || base.hora_agenda),
      daysToReservation: daysBetween(base.fechacreacionoportunidad, firstReserve.reserva_detalle_created_at || firstReserve.created_at),
      daysToClose: daysBetween(base.fechacreacionoportunidad, closure.fechacreacioncierre),
      daysToInvoice: daysBetween(base.fechacreacionoportunidad, latestQuote.evento_fecha_facturacion || latestQuote.historial_created_at_facturacion),
    };
  });
}

function groupCount(records, key, limit = 10) {
  const map = new Map();
  records.forEach((record) => {
    const value = typeof key === "function" ? key(record) : record[key];
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
    const row = { day: day.slice(5) };
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
    if (!map.has(record.model)) map.set(record.model, new Set());
    map.get(record.model).add(record.modelVersion);
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
  const [filters, setFilters] = useState({ dateLevel: "", dateValue: "", advisor: "", modelLevel: "", modelValue: "", stage: "" });
  const [chartFilters, setChartFilters] = useState({});
  const [focusChart, setFocusChart] = useState(null);

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
  const selectable = useMemo(() => ({
    months: Array.from(new Set(records.map((item) => item.month).filter(Boolean))).sort().reverse(),
    advisors: groupCount(records, "advisor", 100).map((item) => item.name).sort((a, b) => a.localeCompare(b)),
    modelVersions: groupCount(records, "modelVersion", 100).map((item) => item.name).sort((a, b) => a.localeCompare(b)),
    stages: groupCount(records, "stage", 100).map((item) => item.name),
  }), [records]);
  const dateTree = useMemo(() => buildDateTree(records), [records]);
  const modelTree = useMemo(() => buildModelTree(records), [records]);

  const kpis = useMemo(() => {
    const prospectDays = uniqueCount(filteredRecords.map((item) => item.day)) || 1;
    const quoteCount = filteredRecords.reduce((sum, item) => sum + item.quoteCount, 0);
    const virtualQuotes = filteredRecords.reduce((sum, item) => sum + item.virtualQuoteCount, 0);
    return {
      prospects: filteredRecords.length,
      prospectsPerDay: filteredRecords.length / prospectDays,
      projected: filteredRecords.reduce((sum, item) => sum + item.stageValue, 0),
      quotes: quoteCount,
      reservations: filteredRecords.reduce((sum, item) => sum + item.reservationCount, 0),
      daysReserve: avg(filteredRecords.map((item) => item.daysToReservation)),
      daysClose: avg(filteredRecords.map((item) => item.daysToClose)),
      daysFact: avg(filteredRecords.map((item) => item.daysToInvoice)),
      virtualQuotes,
      totalViews: filteredRecords.reduce((sum, item) => sum + item.totalViews, 0),
      followUp: filteredRecords.filter((item) => item.followUp).length,
      platformUse: quoteCount ? (virtualQuotes / quoteCount) * 100 : 0,
    };
  }, [filteredRecords]);

  const charts = useMemo(() => ({
    model: groupCount(filteredRecords, "model", 8),
    stage: groupCount(filteredRecords, "stage", 8),
    advisorModel: stackByAdvisorAndModel(filteredRecords),
    clientType: groupCount(filteredRecords, "clientType", 8),
    closureReason: groupCount(filteredRecords, "closureReason", 6),
    dayAdvisor: lineByDayAndAdvisor(filteredRecords),
    campaign: groupCount(filteredRecords, "campaign", 8),
    city: groupCount(filteredRecords, "city", 8),
    fuel: groupCount(filteredRecords, "fuel", 6),
  }), [filteredRecords]);

  function toggleChartFilter(field, value) {
    setChartFilters((current) => ({ ...current, [field]: current[field] === value ? "" : value }));
  }

  function clearAll() {
    setFilters({ dateLevel: "", dateValue: "", advisor: "", modelLevel: "", modelValue: "", stage: "" });
    setChartFilters({});
  }

  return (
    <div className="min-h-full bg-[#e9eef2] text-slate-950">
      <div className="grid min-h-[calc(100svh-1rem)] grid-cols-1 md:grid-cols-[86px_1fr]">
        <aside className="hidden bg-gradient-to-b from-[#4c16f2] to-[#7b16f2] md:flex md:flex-col md:items-center md:justify-between md:py-6">
          <div className="flex h-72 w-14 items-center justify-center rounded-md bg-[#211b1d] text-sm font-semibold text-white shadow-xl">
            <span className="-rotate-90">Gerencial</span>
          </div>
          <div className="text-center text-2xl font-black leading-5 text-white">Hub<br /><span className="text-slate-300">CRM</span></div>
        </aside>
        <main className="min-w-0 p-2">
          <Card className="relative z-40 mb-2 overflow-visible gap-2 bg-[#8798a3] p-3 py-3">
          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[260px_220px_260px_170px_1fr_92px]">
            <DateTreeFilter
              valueLevel={filters.dateLevel}
              value={filters.dateValue}
              tree={dateTree}
              onChange={(dateLevel, dateValue) => setFilters((current) => ({ ...current, dateLevel, dateValue }))}
            />
            <FilterBox label="Asesor" value={filters.advisor} onChange={(value) => setFilters((current) => ({ ...current, advisor: value }))} options={[["", "Todas"], ...selectable.advisors.map((item) => [item, item])]} />
            <ModelTreeFilter
              valueLevel={filters.modelLevel}
              value={filters.modelValue}
              tree={modelTree}
              onChange={(modelLevel, modelValue) => setFilters((current) => ({ ...current, modelLevel, modelValue }))}
            />
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
            <Card className="flex h-[70svh] items-center justify-center bg-white">
              <Loader2 className="mr-2 size-5 animate-spin text-violet-700" />
              <span className="font-semibold">Cargando reportes...</span>
              <Skeleton className="absolute mt-16 h-2 w-48" />
            </Card>
          ) : (
            <>
              <section className="mb-2 grid grid-cols-2 gap-1.5 md:grid-cols-6 xl:grid-cols-11">
                <Kpi title="Prospectos" value={formatNumber(kpis.prospects)} />
                <Kpi title="Pros/ Dia" value={formatNumber(kpis.prospectsPerDay, 1)} />
                <Kpi title="Proyectado" value={formatNumber(kpis.projected)} />
                <Kpi title="Cotizaciones" value={formatNumber(kpis.quotes)} />
                <Kpi title="Reservas" value={formatNumber(kpis.reservations)} />
                <Kpi title="Dias Reserva" value={formatNumber(kpis.daysReserve, 2)} />
                <Kpi title="Dias Cierre" value={formatNumber(kpis.daysClose, 2)} />
                <Kpi title="Dias Fact" value={formatNumber(kpis.daysFact, 2)} />
                <Kpi title="Cant Coti Virt" value={formatNumber(kpis.virtualQuotes)} />
                <Kpi title="Total Vistas" value={formatNumber(kpis.totalViews)} />
                <Kpi title="Seguimiento" value={formatNumber(kpis.followUp)} />
              </section>

              <section className="grid gap-2 xl:grid-cols-[1.25fr_1fr_1fr_1fr_.78fr]">
                <Panel title="Oportunidad por Modelo" summary={chartSummary(charts.model, "modelo")} onFocus={() => setFocusChart("model")}><Donut data={charts.model} field="model" active={chartFilters.model} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Etapas" summary={chartSummary(charts.stage, "etapa")} onFocus={() => setFocusChart("stage")}><StageFunnel data={charts.stage} active={chartFilters.stage} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Modelo por Asesor" summary={stackSummary(charts.advisorModel)} onFocus={() => setFocusChart("advisorModel")}><StackedAdvisor data={charts.advisorModel} models={charts.model.map((item) => item.name)} /></Panel>
                <Panel title="Tipo de Cliente" summary={chartSummary(charts.clientType, "tipo")} onFocus={() => setFocusChart("clientType")}><Donut data={charts.clientType} field="clientType" active={chartFilters.clientType} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Motivo de Cierre" summary={chartSummary(charts.closureReason, "motivo")} onFocus={() => setFocusChart("closureReason")}><ReasonBars data={charts.closureReason} active={chartFilters.closureReason} onSelect={toggleChartFilter} /></Panel>
              </section>

              <section className="mt-2 grid gap-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
                <Panel title="Prospectos por Dia y Asesor" summary={lineSummary(charts.dayAdvisor)} onFocus={() => setFocusChart("dayAdvisor")}><DayAdvisorLine data={charts.dayAdvisor} /></Panel>
                <Panel title="Origen con Campañas" summary={chartSummary(charts.campaign, "origen")} onFocus={() => setFocusChart("campaign")}><Donut data={charts.campaign} field="campaign" active={chartFilters.campaign} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Ciudad Origen" summary={chartSummary(charts.city, "ciudad")} onFocus={() => setFocusChart("city")}><Donut data={charts.city} field="city" active={chartFilters.city} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Tipo de Combustible" summary={chartSummary(charts.fuel, "combustible")} onFocus={() => setFocusChart("fuel")}><Donut data={charts.fuel} field="fuel" active={chartFilters.fuel} onSelect={toggleChartFilter} /></Panel>
              </section>
              <FocusChartDialog
                chartKey={focusChart}
                charts={charts}
                chartFilters={chartFilters}
                onClose={() => setFocusChart(null)}
                onSelect={toggleChartFilter}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function FilterBox({ label, value, onChange, options }) {
  const emptyValue = "Todos";
  return (
    <div className="rounded-md border border-slate-700/30 bg-white p-2 shadow-sm">
      <Label className="mb-1 block text-sm font-bold text-slate-900">{label}</Label>
      <Select value={value || emptyValue} onValueChange={(nextValue) => onChange(nextValue === emptyValue ? "" : nextValue)}>
        <SelectTrigger className="h-8 w-full bg-slate-100 text-xs font-medium text-slate-700">
          <SelectValue placeholder="Todas" />
        </SelectTrigger>
        <SelectContent align="start" className="max-h-72">
          {options.map(([optionValue, optionLabel]) => <SelectItem key={optionValue || emptyValue} value={optionValue || emptyValue}>{optionLabel || emptyValue}</SelectItem>)}
        </SelectContent>
      </Select>
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
    <TreeFilterShell label="Modelo / Version" display={display} onClear={() => onChange("", "")}>
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

function Panel({ title, children, summary, onFocus }) {
  return (
    <Card className="min-h-[270px] gap-0 overflow-hidden bg-white py-0 shadow-sm ring-slate-400">
      <CardHeader className="grid grid-cols-[1fr_auto] items-center bg-gradient-to-r from-[#6717f2] to-[#4b16df] px-2 py-1">
        <CardTitle className="text-right text-xs font-black text-white">{title}</CardTitle>
        {onFocus ? (
          <button type="button" className="ml-2 inline-flex size-5 items-center justify-center rounded-sm bg-white/15 text-white hover:bg-white/25" title="Modo enfoque" onClick={onFocus}>
            <Expand className="size-3.5" />
          </button>
        ) : null}
      </CardHeader>
      <CardContent className="p-2">
        <div className="h-[220px]">{children}</div>
        <p className="mt-2 line-clamp-2 border-t border-slate-100 pt-2 text-[10px] font-semibold leading-tight text-slate-600">{summary || "Sin datos suficientes para resumir."}</p>
      </CardContent>
    </Card>
  );
}

function FocusChartDialog({ chartKey, charts, chartFilters, onClose, onSelect }) {
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
      title: "Prospectos por Dia y Asesor",
      summary: lineSummary(charts.dayAdvisor),
      content: <DayAdvisorLine data={charts.dayAdvisor} />,
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
  if (!top || !total) return "Sin registros para este grafico.";
  const percent = (Number(top.value || 0) / total) * 100;
  return `Mayor ${label}: ${top.name} con ${top.value} (${formatNumber(percent, 1)}% de ${total}).`;
}

function stackSummary(data) {
  if (!data.length) return "Sin registros por asesor.";
  const totals = data.map((row) => ({
    name: row.advisor,
    value: Object.entries(row).filter(([key]) => key !== "advisor").reduce((sum, [, value]) => sum + Number(value || 0), 0),
  })).sort((a, b) => b.value - a.value);
  return totals[0]?.value ? `Asesor con mas oportunidades: ${totals[0].name} (${totals[0].value}).` : "Sin registros por asesor.";
}

function lineSummary(data) {
  if (!data.length) return "Sin registros por dia.";
  const totals = data.map((row) => ({
    name: row.day,
    value: Object.entries(row).filter(([key]) => key !== "day").reduce((sum, [, value]) => sum + Number(value || 0), 0),
  })).sort((a, b) => b.value - a.value);
  return totals[0]?.value ? `Dia con mas prospectos: ${totals[0].name} (${totals[0].value}).` : "Sin registros por dia.";
}

function StageFunnel({ data, active, onSelect }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <FunnelChart margin={{ top: 10, right: 8, bottom: 10, left: 8 }}>
        <Tooltip />
        <Funnel dataKey="value" data={data} nameKey="name" isAnimationActive onClick={(entry) => onSelect("stage", entry.name)}>
          <LabelList position="right" fill="#475569" stroke="none" dataKey="name" fontSize={11} />
          <LabelList position="center" fill="#ffffff" stroke="none" dataKey="value" fontSize={12} fontWeight={700} />
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={STAGE_COLORS[index % STAGE_COLORS.length]} opacity={!active || active === entry.name ? 1 : 0.3} className="cursor-pointer" />
          ))}
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
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
        <Tooltip />
        {activeModels.map((model, index) => (
          <Bar key={model} dataKey={model} stackId="modelos" fill={COLORS[index % COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
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
        <Tooltip />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} onClick={(entry) => onSelect("closureReason", entry.name)}>
          {data.map((item, index) => (
            <Cell key={item.name} fill={COLORS[index % COLORS.length]} opacity={!active || active === item.name ? 1 : 0.3} className="cursor-pointer" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DayAdvisorLine({ data }) {
  const advisors = data.length ? Object.keys(data[0]).filter((key) => key !== "day") : [];
  return (
    <div className="flex h-full flex-col">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          {advisors.map((advisor, index) => (
            <Line key={advisor} type="monotone" dataKey={advisor} stroke={COLORS[index % COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 text-[10px]">
        {advisors.map((advisor, index) => (
          <span key={advisor} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{advisor}</span>
        ))}
      </div>
    </div>
  );
}
