import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function configFromKind(kind) {
  return kind === "lead"
    ? { prefix: "LDPV", permission: "leadspv", label: "leads de PostVenta" }
    : { prefix: "OPPV", permission: "oportunidadespv", label: "oportunidades de PostVenta" };
}

function canSeeAll(user, permission) {
  return Boolean(hasPerm(user.permissions, [permission, "viewall"]) || hasPerm(user.permissions, ["oportunidadespv", "viewall"]) || hasPerm(user.permissions, ["leadspv", "viewall"]));
}

function canSeeAllClients(user) {
  return Boolean(hasPerm(user.permissions, ["clientes", "viewall"]));
}

function datePart(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  return String(value).slice(0, 10);
}

function timePart(value) {
  if (!value) return "";
  if (value instanceof Date) return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  return String(value).slice(11, 16) || String(value).slice(0, 5);
}

function intParam(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

async function nextCode(connection, prefix) {
  const year = new Date().getFullYear();
  const [rows] = await connection.query(
    `SELECT oportunidad_id FROM posventa_oportunidades WHERE oportunidad_id LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}-${year}-%`]
  );
  const last = Number(String(rows[0]?.oportunidad_id || "").split("-").pop() || 0);
  return `${prefix}-${year}-${String(last + 1).padStart(3, "0")}`;
}

async function stageIdByName(connection, name) {
  const [rows] = await connection.query(`SELECT id FROM configuracion_posventa_etapasconversion WHERE LOWER(nombre)=LOWER(?) LIMIT 1`, [name]);
  if (rows[0]) return rows[0].id;
  const [fallback] = await connection.query(`SELECT id FROM configuracion_posventa_etapasconversion WHERE is_active=1 ORDER BY COALESCE(sort_order,id) ASC LIMIT 1`);
  return fallback[0]?.id || null;
}

async function stageIdByNames(connection, names, { fallback = true } = {}) {
  const normalized = names.map((name) => String(name).toLowerCase());
  const [rows] = await connection.query(
    `SELECT id
     FROM configuracion_posventa_etapasconversion
     WHERE LOWER(nombre) IN (?)
     ORDER BY id ASC
     LIMIT 1`,
    [normalized]
  );
  if (rows[0]) return rows[0].id;
  return fallback ? stageIdByName(connection, names[0]) : null;
}

async function closedStageId(connection) {
  const [rows] = await connection.query(
    `SELECT id
     FROM configuracion_posventa_etapasconversion
     WHERE LOWER(nombre) IN ('cerrado', 'cerrada')
     ORDER BY CASE LOWER(nombre) WHEN 'cerrada' THEN 0 WHEN 'cerrado' THEN 1 ELSE 2 END
     LIMIT 1`
  );
  return rows[0]?.id || await stageIdByName(connection, "Cerrada");
}

async function ensureOverduePostventaAgendaNotifications({ user, config, canAll }) {
  const params = [`${config.prefix}-%`];
  const scopeSql = canAll ? "" : "AND (o.created_by = ? OR o.asignado_a = ?)";
  if (!canAll) params.push(user.id, user.id);

  const [rows] = await pool.query(
    `SELECT
        o.id,
        o.oportunidad_id,
        o.created_by,
        o.asignado_a,
        CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente_nombre,
        d.fecha_agenda,
        d.hora_agenda,
        e.nombre AS etapa_nombre
     FROM posventa_oportunidades o
     INNER JOIN administracion_clientes c ON c.id = o.cliente_id
     INNER JOIN configuracion_posventa_etapasconversion e ON e.id = o.etapasconversionpv_id
     INNER JOIN (
       SELECT *
       FROM (
         SELECT detail.*,
                ROW_NUMBER() OVER (
                  PARTITION BY detail.oportunidad_padre_id
                  ORDER BY detail.fecha_agenda DESC, detail.hora_agenda DESC, detail.created_at DESC, detail.id DESC
                ) AS rn
         FROM posventa_oportunidades_detalles detail
         WHERE detail.fecha_agenda IS NOT NULL AND detail.hora_agenda IS NOT NULL
       ) latest_detail
       WHERE latest_detail.rn = 1
     ) d ON d.oportunidad_padre_id = o.id
     WHERE o.oportunidad_id LIKE ?
       AND d.fecha_agenda IS NOT NULL
       AND d.hora_agenda IS NOT NULL
       AND TIMESTAMP(d.fecha_agenda, d.hora_agenda) < NOW()
       AND LOWER(COALESCE(e.nombre,'')) NOT LIKE '%cerrad%'
       ${scopeSql}
     LIMIT 200`,
    params
  );

  for (const row of rows) {
    const recipients = Array.from(new Set([row.created_by, row.asignado_a].filter(Boolean).map(Number)));
    if (!recipients.length) continue;

    const url = `/oportunidadespv/${row.id}`;
    const title = `Agenda vencida: ${row.oportunidad_id}`;
    const agendaText = `${datePart(row.fecha_agenda)} ${timePart(row.hora_agenda)}`.trim();
    const message = `La agenda de ${row.oportunidad_id} (${String(row.cliente_nombre || "").trim() || "cliente sin nombre"}) ya se vencio. Fecha agendada: ${agendaText}. Revisa la oportunidad de PostVenta.`;
    const [[existing]] = await pool.query(
      `SELECT id FROM notificaciones WHERE titulo = ? AND url = ? LIMIT 1`,
      [title, url]
    );

    let notificationId = existing?.id;
    if (!notificationId) {
      const [result] = await pool.query(
        `INSERT INTO notificaciones (titulo, mensaje, tipo, icono, url, created_by, created_at, updated_at)
         VALUES (
           ?, ?, 'warning', 'CalendarClock', ?,
           (SELECT id FROM administracion_usuarios WHERE username = 'admin' OR fullname = 'Super Administrador' ORDER BY CASE WHEN username = 'admin' THEN 0 ELSE 1 END, id ASC LIMIT 1),
           NOW(), NOW()
         )`,
        [title, message, url]
      );
      notificationId = result.insertId;
    }

    await pool.query(
      `INSERT IGNORE INTO notificacion_usuarios (notificacion_id, usuario_id) VALUES ?`,
      [recipients.map((recipientId) => [notificationId, recipientId])]
    );
  }
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const config = configFromKind(request.nextUrl.searchParams.get("kind"));
    if (!hasPerm(user.permissions, [config.permission, "view"]) && !hasPerm(user.permissions, [config.permission, "viewall"])) {
      return NextResponse.json({ message: `No tienes permiso para ver ${config.label}.` }, { status: 403 });
    }
    const canAll = canSeeAll(user, config.permission);
    await ensureOverduePostventaAgendaNotifications({ user, config, canAll });
    const searchParams = request.nextUrl.searchParams;
    const page = intParam(searchParams.get("page"), 1, 1, 999999);
    const limit = intParam(searchParams.get("limit"), 10, 1, 100);
    const offset = (page - 1) * limit;
    const query = String(searchParams.get("q") || "").trim();
    const stageId = String(searchParams.get("stageId") || "").trim();
    const clientId = String(searchParams.get("clientId") || "").trim();
    const originId = String(searchParams.get("originId") || "").trim();
    const assignedTo = String(searchParams.get("assignedTo") || "").trim();
    const createdBy = String(searchParams.get("createdBy") || "").trim();
    const vehicleModelId = String(searchParams.get("vehicleModelId") || "").trim();
    const time = String(searchParams.get("time") || "all").trim();
    const where = ["o.oportunidad_id LIKE ?"];
    const whereParams = [`${config.prefix}-%`];

    if (!canAll) {
      where.push("(o.created_by=? OR o.asignado_a=?)");
      whereParams.push(user.id, user.id);
    }

    if (query) {
      const like = `%${query}%`;
      where.push(`(o.oportunidad_id LIKE ?
        OR CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) LIKE ?
        OR v.placas LIKE ?
        OR v.vin LIKE ?
        OR ma.name LIKE ?
        OR mo.name LIKE ?)`);
      whereParams.push(like, like, like, like, like, like);
    }

    if (stageId) {
      where.push("o.etapasconversionpv_id = ?");
      whereParams.push(Number(stageId));
    }

    if (clientId) {
      where.push("o.cliente_id = ?");
      whereParams.push(Number(clientId));
    }

    if (originId) {
      where.push("o.origen_id = ?");
      whereParams.push(Number(originId));
    }

    if (assignedTo) {
      where.push("o.asignado_a = ?");
      whereParams.push(Number(assignedTo));
    }

    if (createdBy) {
      where.push("o.created_by = ?");
      whereParams.push(Number(createdBy));
    }

    if (vehicleModelId) {
      where.push("v.modelo_id = ?");
      whereParams.push(Number(vehicleModelId));
    }

    if (time === "day") {
      where.push("d.fecha_agenda = CURDATE()");
    } else if (time === "week") {
      where.push("YEARWEEK(d.fecha_agenda, 1) = YEARWEEK(CURDATE(), 1)");
    } else if (time === "month") {
      where.push("YEAR(d.fecha_agenda) = YEAR(CURDATE()) AND MONTH(d.fecha_agenda) = MONTH(CURDATE())");
    } else if (time === "late") {
      where.push("d.fecha_agenda IS NOT NULL AND d.hora_agenda IS NOT NULL AND TIMESTAMP(d.fecha_agenda, d.hora_agenda) < NOW()");
    } else if (time === "near") {
      where.push("d.fecha_agenda IS NOT NULL AND d.hora_agenda IS NOT NULL AND TIMESTAMPDIFF(MINUTE, NOW(), TIMESTAMP(d.fecha_agenda, d.hora_agenda)) BETWEEN 0 AND 14");
    } else if (time === "enough") {
      where.push("d.fecha_agenda IS NOT NULL AND d.hora_agenda IS NOT NULL AND TIMESTAMPDIFF(MINUTE, NOW(), TIMESTAMP(d.fecha_agenda, d.hora_agenda)) BETWEEN 15 AND 999999");
    }

    const fromSql = `
       FROM posventa_oportunidades o
       INNER JOIN administracion_clientes c ON c.id=o.cliente_id
       INNER JOIN administracion_vehiculos v ON v.id=o.vehiculo_id
       LEFT JOIN administracion_marcas ma ON ma.id=v.marca_id
       LEFT JOIN administracion_modelos mo ON mo.id=v.modelo_id
       INNER JOIN configuracion_origenes_citas og ON og.id=o.origen_id
       LEFT JOIN configuracion_suborigenes_citas so ON so.id=o.suborigen_id
       INNER JOIN configuracion_posventa_etapasconversion e ON e.id=o.etapasconversionpv_id
       INNER JOIN administracion_usuarios cu ON cu.id=o.created_by
       LEFT JOIN administracion_usuarios au ON au.id=o.asignado_a
       LEFT JOIN (
         SELECT *
         FROM (
           SELECT od.*,
                  ROW_NUMBER() OVER (
                    PARTITION BY od.oportunidad_padre_id
                    ORDER BY od.fecha_agenda DESC, od.hora_agenda DESC, od.created_at DESC, od.id DESC
                  ) AS rn
           FROM posventa_oportunidades_detalles od
         ) latest_detail
         WHERE latest_detail.rn=1
       ) d ON d.oportunidad_padre_id=o.id
       LEFT JOIN (
         SELECT *
         FROM (
           SELECT pc.*, ROW_NUMBER() OVER (PARTITION BY pc.oportunidadespv_id ORDER BY pc.start_at DESC, pc.id DESC) AS rn
           FROM posventa_citas pc
         ) latest_cita
         WHERE latest_cita.rn=1
       ) cita ON cita.oportunidadespv_id=o.id
       WHERE ${where.join(" AND ")}`;

    const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total ${fromSql}`, whereParams);
    const [rows] = await pool.query(
      `SELECT o.*, CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente_nombre,
              v.placas, v.vin, v.anio, ma.name AS marca_nombre, mo.name AS modelo_nombre,
              og.name AS origen_nombre, so.name AS suborigen_nombre,
              e.nombre AS etapa_nombre, e.color AS etapa_color, e.descripcion AS temperatura,
              cu.fullname AS creado_por_nombre, au.fullname AS asignado_a_nombre,
              d.fecha_agenda, d.hora_agenda,
              cita.id AS cita_id, cita.start_at AS cita_start_at, cita.estado AS cita_estado
       ${fromSql}
       ORDER BY CASE WHEN LOWER(e.nombre) LIKE '%cerrad%' THEN 1 ELSE 0 END ASC, o.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );
    const [stages] = await pool.query(`SELECT id,nombre,descripcion,color,sort_order FROM configuracion_posventa_etapasconversion WHERE is_active=1 ORDER BY COALESCE(sort_order,id) ASC`);
    const [origins] = await pool.query(`SELECT id,name FROM configuracion_origenes_citas WHERE is_active=1 ORDER BY name ASC`);
    const [suborigins] = await pool.query(`SELECT id,origen_id,name FROM configuracion_suborigenes_citas WHERE is_active=1 ORDER BY name ASC`);
    const [users] = await pool.query(`SELECT id,fullname FROM administracion_usuarios WHERE is_active=1 ORDER BY fullname ASC`);
    const scopeParams = [`${config.prefix}-%`];
    const scopeSql = canAll ? "" : "AND (o.created_by = ? OR o.asignado_a = ?)";
    if (!canAll) scopeParams.push(user.id, user.id);
    const [clients] = await pool.query(
      `SELECT DISTINCT c.id, CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS nombre, c.identificacion_fiscal AS documento
       FROM posventa_oportunidades o
       INNER JOIN administracion_clientes c ON c.id=o.cliente_id
       WHERE o.oportunidad_id LIKE ? ${scopeSql}
       ORDER BY nombre ASC`,
      scopeParams
    );
    const [vehicleModels] = await pool.query(
      `SELECT DISTINCT mo.id, mo.name, ma.name AS marca
       FROM posventa_oportunidades o
       INNER JOIN administracion_vehiculos v ON v.id=o.vehiculo_id
       LEFT JOIN administracion_modelos mo ON mo.id=v.modelo_id
       LEFT JOIN administracion_marcas ma ON ma.id=v.marca_id
       WHERE o.oportunidad_id LIKE ? ${scopeSql} AND mo.id IS NOT NULL
       ORDER BY ma.name ASC, mo.name ASC`,
      scopeParams
    );
    const [timeStates] = await pool.query(
      `SELECT id,nombre,estado,minutos_desde,minutos_hasta,color_hexadecimal,descripcion
       FROM configuracion_posventa_estados_tiempo
       WHERE activo=1
       ORDER BY minutos_desde ASC`
    );
    const now = new Date();
    return NextResponse.json({
      currentUser: { id: user.id, fullname: user.fullname, canViewAll: canAll },
      meta: {
        total: Number(countRow?.total || 0),
        page,
        limit,
        pages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / limit)),
      },
      opportunities: rows.map((row) => {
        const agendaDate = datePart(row.fecha_agenda);
        const agendaTime = timePart(row.hora_agenda);
        const agendaAt = agendaDate && agendaTime ? new Date(`${agendaDate}T${agendaTime}`) : null;
        const minutesUntilAgenda = agendaAt ? Math.round((agendaAt.getTime() - now.getTime()) / 60000) : null;
        const timeState = minutesUntilAgenda === null
          ? null
          : timeStates.find((state) => minutesUntilAgenda >= Number(state.minutos_desde) && minutesUntilAgenda <= Number(state.minutos_hasta));
        return {
          id: row.id,
          code: row.oportunidad_id,
          clienteId: row.cliente_id,
          clienteNombre: row.cliente_nombre.trim(),
          vehiculoId: row.vehiculo_id,
          vehiculoNombre: [row.modelo_nombre, row.marca_nombre].filter(Boolean).join(" - ") || row.placas || row.vin || "-",
          placa: row.placas || "",
          vin: row.vin || "",
          origenId: row.origen_id,
          origenNombre: row.origen_nombre,
          suborigenId: row.suborigen_id,
          suborigenNombre: row.suborigen_nombre || "",
          etapaId: row.etapasconversionpv_id,
          etapaNombre: row.etapa_nombre,
          etapaColor: row.etapa_color || "#2563eb",
          temperatura: Number(row.temperatura || 0),
          asignadoA: row.asignado_a,
          asignadoNombre: row.asignado_a_nombre || "Sin asignar",
          createdBy: row.created_by,
          creadoPorNombre: row.creado_por_nombre,
          agendaDate,
          agendaTime,
          citaId: row.cita_id || null,
          citaFecha: datePart(row.cita_start_at),
          citaHora: timePart(row.cita_start_at),
          citaEstado: row.cita_estado || "",
          minutesUntilAgenda,
          timeState: timeState ? {
            id: timeState.id,
            nombre: timeState.nombre,
            estado: timeState.estado,
            color: timeState.color_hexadecimal,
            descripcion: timeState.descripcion || "",
          } : null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }),
      options: {
        clients: clients.map((row) => ({ id: row.id, nombre: String(row.nombre || "").trim() || `Cliente ${row.id}`, documento: row.documento || "" })),
        stages: stages.map((row) => ({ id: row.id, nombre: row.nombre, descripcion: Number(row.descripcion || 0), color: row.color || "#2563eb", sortOrder: row.sort_order || row.id })),
        origins: origins.map((row) => ({ id: row.id, name: row.name })),
        suborigins: suborigins.map((row) => ({ id: row.id, origenId: row.origen_id, name: row.name })),
        users: users.map((row) => ({ id: row.id, fullname: row.fullname })),
        vehicleModels: vehicleModels.map((row) => ({ id: row.id, name: row.name, marca: row.marca || "" })),
        timeStates: timeStates.map((row) => ({ id: row.id, nombre: row.nombre, estado: row.estado, color: row.color_hexadecimal, descripcion: row.descripcion || "" })),
      },
    });
  } catch (error) {
    console.error("Error loading postventa opportunities:", error);
    return NextResponse.json({ message: "No se pudieron cargar oportunidades de PostVenta." }, { status: 500 });
  }
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const body = await request.json();
    const config = configFromKind(body.kind || request.nextUrl.searchParams.get("kind"));
    if (!hasPerm(user.permissions, [config.permission, "create"])) {
      return NextResponse.json({ message: `No tienes permiso para crear ${config.label}.` }, { status: 403 });
    }
    const details = Array.isArray(body.details)
      ? body.details.filter((item) => item?.fechaAgenda && item?.horaAgenda)
      : body.fechaAgenda && body.horaAgenda ? [{ fechaAgenda: body.fechaAgenda, horaAgenda: body.horaAgenda }] : [];
    const closePayload = body.close?.enabled ? body.close : null;
    if (!body.clienteId || !body.vehiculoId || !body.origenId || (!details.length && !closePayload)) {
      return NextResponse.json({ message: "Completa cliente, vehiculo, origen y agenda." }, { status: 400 });
    }
    if (!canSeeAllClients(user)) {
      const [clientRows] = await connection.query(
        `SELECT id FROM administracion_clientes WHERE id = ? AND created_by = ? LIMIT 1`,
        [Number(body.clienteId), user.id]
      );
      if (!clientRows.length) {
        return NextResponse.json({ message: "No tienes permiso para usar este cliente." }, { status: 403 });
      }
    }
    const canAll = canSeeAll(user, config.permission);
    const assignedTo = canAll ? (body.asignadoA ? Number(body.asignadoA) : null) : user.id;
    const stageId = closePayload
      ? await closedStageId(connection)
      : await stageIdByNames(connection, ["En Atención", "En Atencion"]);
    await connection.beginTransaction();
    const code = await nextCode(connection, config.prefix);
    const [result] = await connection.query(
      `INSERT INTO posventa_oportunidades (cliente_id, vehiculo_id, origen_id, suborigen_id, detalle, etapasconversionpv_id, created_by, asignado_a, oportunidad_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(body.clienteId), Number(body.vehiculoId), Number(body.origenId), body.suborigenId ? Number(body.suborigenId) : null, body.detalle || null, stageId, user.id, assignedTo, code]
    );
    for (const detail of details) {
      await connection.query(
        `INSERT INTO posventa_oportunidades_detalles (oportunidad_padre_id, fecha_agenda, hora_agenda, oportunidad_id) VALUES (?, ?, ?, ?)`,
        [result.insertId, detail.fechaAgenda, detail.horaAgenda, code]
      );
    }
    const activities = Array.isArray(body.activities)
      ? body.activities.map((item) => String(item?.detalle || "").trim()).filter(Boolean)
      : body.detalle ? [String(body.detalle).trim()] : [];
    for (const activity of activities) {
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by) VALUES (?, ?, ?, ?)`,
        [result.insertId, stageId, activity, user.id]
      );
    }
    if (closePayload) {
      const closeDetailId = closePayload.cierreDetalleId ? Number(closePayload.cierreDetalleId) : null;
      const closeDetail = String(closePayload.detalle || "").trim() || "Cierre registrado";
      await connection.query(
        `INSERT INTO posventa_oportunidades_cierres (oportunidad_id, detalle, cierre_detalle_id, created_by)
         VALUES (?, ?, ?, ?)`,
        [result.insertId, closeDetail, closeDetailId, user.id]
      );
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
         VALUES (?, ?, ?, ?)`,
        [result.insertId, stageId, `Oportunidad cerrada: ${closeDetail}`, user.id]
      );
    }
    await connection.commit();
    return NextResponse.json({ ok: true, id: result.insertId, code }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating postventa opportunity:", error);
    return NextResponse.json({ message: "No se pudo crear la oportunidad de PostVenta." }, { status: 500 });
  } finally {
    connection.release();
  }
}
