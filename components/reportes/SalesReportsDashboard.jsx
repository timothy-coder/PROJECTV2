"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

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

function filterRecords(records, filters, chartFilters) {
  return records.filter((record) => {
    const basic =
      (!filters.month || record.month === filters.month) &&
      (!filters.advisor || record.advisor === filters.advisor) &&
      (!filters.modelVersion || record.modelVersion === filters.modelVersion) &&
      (!filters.stage || record.stage === filters.stage);
    const chart = Object.entries(chartFilters).every(([field, value]) => !value || record[field] === value);
    return basic && chart;
  });
}

export default function SalesReportsDashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ month: "", advisor: "", modelVersion: "", stage: "" });
  const [chartFilters, setChartFilters] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
    setFilters({ month: "", advisor: "", modelVersion: "", stage: "" });
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
          <section className="mb-2 grid gap-2 rounded-sm bg-[#8798a3] p-3 md:grid-cols-[220px_220px_220px_170px_1fr_92px]">
            <FilterBox label="Fecha" value={filters.month} onChange={(value) => setFilters((current) => ({ ...current, month: value }))} options={[["", "Todas"], ...selectable.months.map((item) => [item, monthLabel(item)])]} />
            <FilterBox label="Asesor" value={filters.advisor} onChange={(value) => setFilters((current) => ({ ...current, advisor: value }))} options={[["", "Todas"], ...selectable.advisors.map((item) => [item, item])]} />
            <FilterBox label="Modelo / Version" value={filters.modelVersion} onChange={(value) => setFilters((current) => ({ ...current, modelVersion: value }))} options={[["", "Todas"], ...selectable.modelVersions.map((item) => [item, item])]} />
            <FilterBox label="Etapa" value={filters.stage} onChange={(value) => setFilters((current) => ({ ...current, stage: value }))} options={[["", "Todas"], ...selectable.stages.map((item) => [item, item])]} />
            <div className="flex items-end justify-end">
              <button type="button" className="inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-bold text-violet-700 shadow-sm hover:bg-violet-50" onClick={clearAll}>
                <RotateCcw className="size-4" /> Limpiar
              </button>
            </div>
            <div className="rounded-md bg-white p-2 text-center shadow-sm">
              <p className="text-[10px] font-bold text-slate-500">Uso Plataforma</p>
              <p className="text-2xl font-bold">{formatNumber(kpis.platformUse, 0)} %</p>
            </div>
          </section>

          {message ? <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</div> : null}
          {loading ? (
            <div className="flex h-[70svh] items-center justify-center rounded-md bg-white">
              <Loader2 className="mr-2 size-5 animate-spin text-violet-700" />
              <span className="font-semibold">Cargando reportes...</span>
            </div>
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
                <Panel title="Oportunidad por Modelo"><Donut data={charts.model} field="model" active={chartFilters.model} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Etapas"><StageBars data={charts.stage} active={chartFilters.stage} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Modelo por Asesor"><StackedAdvisor data={charts.advisorModel} models={charts.model.map((item) => item.name)} /></Panel>
                <Panel title="Tipo de Cliente"><Donut data={charts.clientType} field="clientType" active={chartFilters.clientType} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Motivo de Cierre"><ReasonBars data={charts.closureReason} active={chartFilters.closureReason} onSelect={toggleChartFilter} /></Panel>
              </section>

              <section className="mt-2 grid gap-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
                <Panel title="Prospectos por Dia y Asesor"><DayAdvisorLine data={charts.dayAdvisor} /></Panel>
                <Panel title="Origen con Campañas"><Donut data={charts.campaign} field="campaign" active={chartFilters.campaign} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Ciudad Origen"><Donut data={charts.city} field="city" active={chartFilters.city} onSelect={toggleChartFilter} /></Panel>
                <Panel title="Tipo de Combustible"><Donut data={charts.fuel} field="fuel" active={chartFilters.fuel} onSelect={toggleChartFilter} /></Panel>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function FilterBox({ label, value, onChange, options }) {
  return (
    <label className="rounded-md border border-slate-700/30 bg-white p-2 shadow-sm">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-full bg-slate-200 px-2 text-xs font-medium text-slate-700 outline-none">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue || "all"} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function Kpi({ title, value }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-[#6717f2] to-[#4b16df] px-2 py-1 text-center text-xs font-black text-white">{title}</div>
      <div className="flex h-14 items-center justify-center text-2xl font-bold">{value || "-"}</div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="min-h-[230px] overflow-hidden rounded-md border border-slate-400 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-[#6717f2] to-[#4b16df] px-2 py-1 text-right text-xs font-black text-white">{title}</div>
      <div className="h-[250px] p-2">{children}</div>
    </div>
  );
}

function Donut({ data, field, active, onSelect }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const denominator = total || 1;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="grid h-full grid-cols-[1fr_112px] items-center gap-2">
      <svg viewBox="0 0 160 160" className="h-full w-full">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="28" />
        {data.map((entry, index) => {
          const length = (entry.value / denominator) * circumference;
          const dashOffset = -offset;
          offset += length;
          return (
            <circle
              key={entry.name}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={COLORS[index % COLORS.length]}
              strokeWidth="28"
              strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              opacity={!active || active === entry.name ? 1 : 0.25}
              className="cursor-pointer"
              transform="rotate(-90 80 80)"
              onClick={() => onSelect(field, entry.name)}
            />
          );
        })}
        <circle cx="80" cy="80" r="34" fill="white" />
        <text x="80" y="78" textAnchor="middle" className="fill-slate-900 text-[18px] font-bold">{total}</text>
        <text x="80" y="94" textAnchor="middle" className="fill-slate-500 text-[8px]">Total</text>
      </svg>
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

function StageBars({ data, active, onSelect }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {data.map((entry, index) => (
        <button key={entry.name} type="button" className="grid grid-cols-[82px_1fr] items-center gap-2 text-left" onClick={() => onSelect("stage", entry.name)}>
          <span className="truncate text-[11px] text-slate-600">{entry.name}</span>
          <span className="relative h-7 bg-slate-100">
            <span className="flex h-full items-center justify-center text-xs font-bold text-white" style={{ width: `${Math.max(10, (entry.value / max) * 100)}%`, backgroundColor: STAGE_COLORS[index % STAGE_COLORS.length], opacity: !active || active === entry.name ? 1 : 0.3 }}>
              {entry.value}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function StackedAdvisor({ data, models }) {
  const max = Math.max(...data.map((row) => models.reduce((sum, model) => sum + Number(row[model] || 0), 0)), 1);
  return (
    <div className="flex h-full items-end justify-around gap-3 px-2 pt-4">
      {data.map((row) => {
        const total = models.reduce((sum, model) => sum + Number(row[model] || 0), 0);
        return (
          <div key={row.advisor} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <div className="flex w-10 flex-col justify-end overflow-hidden bg-slate-100" style={{ height: `${Math.max(8, (total / max) * 78)}%` }}>
              {models.slice(0, 5).map((model, index) => {
                const value = Number(row[model] || 0);
                if (!value) return null;
                return <div key={model} title={`${model}: ${value}`} style={{ height: `${(value / total) * 100}%`, backgroundColor: COLORS[index % COLORS.length] }} />;
              })}
            </div>
            <span className="mt-2 line-clamp-2 text-center text-[10px] leading-tight text-slate-600">{row.advisor}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReasonBars({ data, active, onSelect }) {
  return (
    <div className="space-y-2 pt-1">
      {data.map((item, index) => (
        <button key={item.name} type="button" className="block w-full text-left" onClick={() => onSelect("closureReason", item.name)}>
          <div className="mb-1 truncate text-xs font-bold text-slate-700">{item.name}</div>
          <div className="h-10 bg-slate-100">
            <div className="flex h-full items-center px-2 text-xs font-bold text-white" style={{ width: `${Math.max(8, (item.value / Math.max(...data.map((row) => row.value), 1)) * 100)}%`, backgroundColor: COLORS[index % COLORS.length], opacity: !active || active === item.name ? 1 : 0.3 }}>
              {item.value}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function DayAdvisorLine({ data }) {
  const advisors = data.length ? Object.keys(data[0]).filter((key) => key !== "day") : [];
  const width = 520;
  const height = 190;
  const pad = 24;
  const max = Math.max(...data.flatMap((row) => advisors.map((advisor) => Number(row[advisor] || 0))), 1);
  const xFor = (index) => data.length <= 1 ? pad : pad + (index * (width - pad * 2)) / (data.length - 1);
  const yFor = (value) => height - pad - (Number(value || 0) * (height - pad * 2)) / max;
  return (
    <div className="flex h-full flex-col">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-h-0 flex-1">
        {[0, 0.25, 0.5, 0.75, 1].map((step) => (
          <line key={step} x1={pad} x2={width - pad} y1={pad + step * (height - pad * 2)} y2={pad + step * (height - pad * 2)} stroke="#e2e8f0" strokeDasharray="4 4" />
        ))}
        {data.map((row, index) => (
          <text key={row.day} x={xFor(index)} y={height - 5} textAnchor="middle" className="fill-slate-500 text-[9px]">{row.day}</text>
        ))}
        {advisors.map((advisor, advisorIndex) => {
          const points = data.map((row, index) => `${xFor(index)},${yFor(row[advisor])}`).join(" ");
          return (
            <g key={advisor}>
              <polyline points={points} fill="none" stroke={COLORS[advisorIndex % COLORS.length]} strokeWidth="3" />
              {data.map((row, index) => (
                <g key={`${advisor}-${row.day}`}>
                  <circle cx={xFor(index)} cy={yFor(row[advisor])} r="4" fill={COLORS[advisorIndex % COLORS.length]} />
                  {row[advisor] ? <text x={xFor(index)} y={yFor(row[advisor]) - 8} textAnchor="middle" className="fill-slate-600 text-[10px]">{row[advisor]}</text> : null}
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-3 text-[10px]">
        {advisors.map((advisor, index) => (
          <span key={advisor} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{advisor}</span>
        ))}
      </div>
    </div>
  );
}
