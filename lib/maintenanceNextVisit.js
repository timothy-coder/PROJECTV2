export function datePart(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function preventiveMaintenanceHistoryExists(alias = "h") {
  return `EXISTS (
    SELECT 1
    FROM posventa_submantenimiento sm
    WHERE sm.id = ${alias}.submantenimiento_id
      AND sm.is_active = 1
      AND LOWER(TRIM(sm.name)) REGEXP '^(1|2|3|4|5|6|7|8|9|10)[^[:alnum:]]*[[:space:]]*mantenimiento$'
  )`;
}

export async function loadPreventiveMaintenanceSubitems(connection) {
  const [rows] = await connection.query(
    `SELECT sm.id, sm.name, pm.name AS mantenimiento_name
     FROM posventa_submantenimiento sm
     LEFT JOIN posventa_mantenimiento pm ON pm.id = sm.posventamantenimiento_id
     WHERE sm.is_active = 1
       AND LOWER(TRIM(sm.name)) REGEXP '^(1|2|3|4|5|6|7|8|9|10)[^[:alnum:]]*[[:space:]]*mantenimiento$'
     ORDER BY CAST(LOWER(TRIM(sm.name)) AS UNSIGNED) ASC, sm.name ASC`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    mantenimientoName: row.mantenimiento_name || "",
  }));
}

export async function loadMaintenanceSubitems(connection) {
  const [rows] = await connection.query(
    `SELECT sm.id, sm.name, pm.name AS mantenimiento_name
     FROM posventa_submantenimiento sm
     LEFT JOIN posventa_mantenimiento pm ON pm.id = sm.posventamantenimiento_id
     WHERE sm.is_active = 1
     ORDER BY pm.name ASC, sm.name ASC`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    mantenimientoName: row.mantenimiento_name || "",
  }));
}

export async function isActiveMaintenanceSubitem(connection, submantenimientoId) {
  if (!submantenimientoId) return false;
  const [[row]] = await connection.query(
    `SELECT id
     FROM posventa_submantenimiento
     WHERE id = ? AND is_active = 1
     LIMIT 1`,
    [Number(submantenimientoId)]
  );
  return Boolean(row?.id);
}

export async function isPreventiveMaintenanceSubitem(connection, submantenimientoId) {
  if (!submantenimientoId) return false;
  const [[row]] = await connection.query(
    `SELECT sm.id
     FROM posventa_submantenimiento sm
     WHERE sm.id = ?
       AND sm.is_active = 1
       AND LOWER(TRIM(sm.name)) REGEXP '^(1|2|3|4|5|6|7|8|9|10)[^[:alnum:]]*[[:space:]]*mantenimiento$'
     LIMIT 1`,
    [Number(submantenimientoId)]
  );
  return Boolean(row?.id);
}

export function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
}

export function addDaysTrunc(date, days) {
  const n = Number(days);
  if (!Number.isFinite(n)) return null;
  const next = new Date(date);
  next.setDate(next.getDate() + Math.floor(n));
  return next;
}

export function daysBetween(from, to) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.ceil((end - start) / 86400000);
}

export function parseRanges(value) {
  try {
    if (!value) return [];
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const txt = String(value || "").trim();
    if (!txt) return [];
    return txt.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

export function yearMatches(year, ranges) {
  if (!year || !ranges.length) return true;
  return ranges.some((range) => {
    const [start, end] = String(range).split("-").map((item) => Number(String(item).trim()));
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return year >= start && year <= end;
  });
}

export function pickT1T2DistinctDay(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { t1: null, t2: null };

  const t1 = rows[0];
  const day1 = datePart(t1.fecha_visita_taller);

  let t2 = null;
  for (let index = 1; index < rows.length; index += 1) {
    if (datePart(rows[index].fecha_visita_taller) !== day1) {
      t2 = rows[index];
      break;
    }
  }
  return { t1, t2 };
}

export function pickProximo(today, candidates) {
  const valid = candidates.filter((candidate) => candidate?.date instanceof Date && !Number.isNaN(candidate.date.valueOf()));
  if (!valid.length) return { date: null, calculo: "" };

  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const withDay = valid.map((candidate) => ({
    ...candidate,
    day: new Date(candidate.date.getFullYear(), candidate.date.getMonth(), candidate.date.getDate()).getTime(),
  }));
  const expired = withDay.filter((candidate) => candidate.day < todayDay);

  if (expired.length) {
    expired.sort((a, b) => a.day - b.day);
    return { date: expired[0].date, calculo: expired[0].calculo };
  }

  withDay.sort((a, b) => a.day - b.day);
  return { date: withDay[0].date, calculo: withDay[0].calculo };
}

export function calculateNextMaintenanceDate(vehicle, history, today = new Date()) {
  const hasHistory = Array.isArray(history) && history.length > 0;
  const ranges = parseRanges(vehicle?.algoritmo_anios);
  const yearOk = yearMatches(Number(vehicle?.anio), ranges);
  const algoritmoMeses = vehicle?.algoritmo_meses != null ? Number(vehicle.algoritmo_meses) : 0;
  const algoritmoKm = vehicle?.algoritmo_km != null ? Number(vehicle.algoritmo_km) : 0;
  const hasAlgorithm = Boolean(yearOk && (algoritmoMeses > 0 || algoritmoKm > 0));

  if (!hasHistory || !hasAlgorithm) return { date: null, calculo: "" };

  const { t1, t2 } = pickT1T2DistinctDay(history);
  const v1 = t1?.fecha_visita_taller ? new Date(t1.fecha_visita_taller) : null;
  const v2 = t2?.fecha_visita_taller ? new Date(t2.fecha_visita_taller) : null;
  const k1 = t1?.kilometraje_taller != null ? Number(t1.kilometraje_taller) : null;
  const k2 = t2?.kilometraje_taller != null ? Number(t2.kilometraje_taller) : null;
  const baseForTime = v2 || v1;

  const nextByTime = algoritmoMeses > 0 && baseForTime ? addMonths(baseForTime, algoritmoMeses) : null;
  let nextByKm = null;

  if (algoritmoKm > 0 && v1 && v2 && k1 != null && k2 != null) {
    const diasEntre = daysBetween(v2, v1);
    const deltaKm = k1 - k2;

    if (diasEntre > 0 && deltaKm > 0) {
      const kmDiario = deltaKm / diasEntre;
      if (kmDiario > 0) nextByKm = addDaysTrunc(v2, algoritmoKm / kmDiario);
    }
  }

  return pickProximo(today, [
    { date: nextByTime, calculo: "Tiempo" },
    { date: nextByKm, calculo: "KM" },
  ]);
}

export async function updateVehicleNextMaintenanceDate(connection, vehicleId) {
  const [[vehicle]] = await connection.query(
    `SELECT v.id, v.anio, v.fecha_ultima_visita, av.kilometraje AS algoritmo_km, av.meses AS algoritmo_meses, av.anios AS algoritmo_anios
     FROM administracion_vehiculos v
     LEFT JOIN administracion_algoritmo_visita av ON av.marca_id=v.marca_id AND av.modelo_id=v.modelo_id
     WHERE v.id=? AND v.deleted_at IS NULL
     LIMIT 1`,
    [vehicleId]
  );

  if (!vehicle?.id) return null;

  const [history] = await connection.query(
    `SELECT id, fecha_visita_taller, kilometraje_taller
     FROM administracion_vehiculos_historial_mantenimientos h
     WHERE h.vehiculo_id=?
       AND ${preventiveMaintenanceHistoryExists("h")}
     ORDER BY fecha_visita_taller DESC, id DESC
     LIMIT 30`,
    [vehicle.id]
  );

  if (!history.length) {
    return vehicle.fecha_ultima_visita ? datePart(vehicle.fecha_ultima_visita) : null;
  }

  const next = calculateNextMaintenanceDate(vehicle, history);
  const nextDate = next.date ? datePart(next.date) : null;
  await connection.query(`UPDATE administracion_vehiculos SET fecha_ultima_visita=? WHERE id=?`, [nextDate, vehicle.id]);
  return nextDate;
}
