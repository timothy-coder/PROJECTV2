import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";

function isClosed(stage) {
  return String(stage || "").toLowerCase().includes("cerrad");
}

function canSeeAll(user, permission = "oportunidades") {
  return Boolean(
    hasPerm(user.permissions, [permission, "viewall"]) ||
    hasPerm(user.permissions, ["oportunidades", "viewall"]) ||
    hasPerm(user.permissions, ["agenda", "viewall"]) ||
    hasPerm(user.permissions, ["configuracion", "viewall"])
  );
}

function canSeeAllClients(user) {
  return Boolean(hasPerm(user.permissions, ["clientes", "viewall"]));
}

function datePart(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function timePart(value) {
  if (!value) return "";
  return String(value).slice(0, 8);
}

function normalizeStageName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function configFromKind(kind) {
  return kind === "lead"
    ? { prefix: "LD", listPrefixes: ["LD", "LF"], permission: "leads", label: "leads" }
    : { prefix: "OPO", listPrefixes: ["OPO"], permission: "oportunidades", label: "oportunidades" };
}

async function nextCode(connection, prefix) {
  const year = new Date().getFullYear();
  const [rows] = await connection.query(`SELECT oportunidad_id FROM ventas_oportunidades WHERE oportunidad_id LIKE ? ORDER BY id DESC LIMIT 1`, [`${prefix}-${year}-%`]);
  const last = Number(String(rows[0]?.oportunidad_id || "").split("-").pop() || 0);
  return `${prefix}-${year}-${String(last + 1).padStart(3, "0")}`;
}

async function getStageId(connection, name, fallback = true) {
  const [rows] = await connection.query(`SELECT id FROM ventas_etapasconversion WHERE LOWER(nombre)=LOWER(?) LIMIT 1`, [name]);
  if (rows[0]) return rows[0].id;
  if (!fallback) return null;
  const [fallbackRows] = await connection.query(`SELECT id FROM ventas_etapasconversion ORDER BY COALESCE(sort_order, id) ASC LIMIT 1`);
  return fallbackRows[0]?.id || null;
}

async function isAdvisorUser(connection, userId) {
  if (!userId) return true;
  const [rows] = await connection.query(
    `SELECT u.id
     FROM administracion_usuarios u
     INNER JOIN configuracion_roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.is_active = 1 AND LOWER(TRIM(r.name)) = 'asesor'
     LIMIT 1`,
    [Number(userId)]
  );
  return rows.length > 0;
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const config = configFromKind(request.nextUrl.searchParams.get("kind"));
    if (!hasPerm(user.permissions, [config.permission, "view"]) && !hasPerm(user.permissions, [config.permission, "viewall"])) {
      return NextResponse.json({ message: `No tienes permiso para ver ${config.label}.` }, { status: 403 });
    }
    const canViewAll = canSeeAll(user, config.permission);
    const canViewAllClients = canSeeAllClients(user);
    const prefixFilters = config.listPrefixes.map((prefix) => `${prefix}-%`);
    const prefixWhere = prefixFilters.map(() => "o.oportunidad_id LIKE ?").join(" OR ");
    const [opportunityRows] = await pool.query(
      `SELECT o.id, o.oportunidad_id, o.cliente_id, o.origen_id, o.suborigen_id, o.etapasconversion_id,
              o.created_by, o.asignado_a, o.created_at, o.updated_at,
              CONCAT(COALESCE(c.nombre,''), ' ', COALESCE(c.apellido,'')) AS cliente_nombre,
              c.identificacion_fiscal AS cliente_documento,
              oc.name AS origen_nombre, so.name AS suborigen_nombre,
              e.nombre AS etapa_nombre, e.descripcion AS etapa_temperatura, e.color AS etapa_color, e.sort_order AS etapa_orden,
              cu.fullname AS creado_por_nombre, au.fullname AS asignado_a_nombre
       FROM ventas_oportunidades o
       INNER JOIN administracion_clientes c ON c.id = o.cliente_id
       INNER JOIN configuracion_origenes_citas oc ON oc.id = o.origen_id
       LEFT JOIN configuracion_suborigenes_citas so ON so.id = o.suborigen_id
       INNER JOIN ventas_etapasconversion e ON e.id = o.etapasconversion_id
       INNER JOIN administracion_usuarios cu ON cu.id = o.created_by
       LEFT JOIN administracion_usuarios au ON au.id = o.asignado_a
       WHERE (${prefixWhere})
       ${canViewAll ? "" : "AND (o.created_by = ? OR o.asignado_a = ?)"}
       ORDER BY CASE WHEN LOWER(e.nombre) LIKE '%cerrad%' THEN 1 ELSE 0 END ASC, o.updated_at DESC`,
      canViewAll ? prefixFilters : [...prefixFilters, user.id, user.id]
    );
    const ids = opportunityRows.map((row) => row.id);
    let detailRows = [];
    let activityRows = [];
    let closureRows = [];
    let quoteModelRows = [];
    let latestQuoteModelRows = [];
    if (ids.length) {
      const [details] = await pool.query(`SELECT * FROM ventas_oportunidades_detalles WHERE oportunidad_padre_id IN (?) ORDER BY created_at ASC`, [ids]);
      const [activities] = await pool.query(
        `SELECT a.*, e.nombre AS etapa_nombre, u.fullname AS created_by_nombre
         FROM ventas_oportunidades_actividades a
         LEFT JOIN ventas_etapasconversion e ON e.id = a.etapasconversion_id
         INNER JOIN administracion_usuarios u ON u.id = a.created_by
         WHERE a.oportunidad_id IN (?) ORDER BY a.created_at ASC`,
        [ids]
      );
      const [closures] = await pool.query(
        `SELECT c.oportunidad_id, c.detalle, c.cierre_detalle_id, c.created_at, cd.detalle AS clasificacion
         FROM ventas_oportunidades_cierres c
         LEFT JOIN configuracion_ventas_cierres_detalle cd ON cd.id = c.cierre_detalle_id
         WHERE c.oportunidad_id IN (?)
         ORDER BY c.created_at ASC`,
        [ids]
      );
      const [quoteModels] = await pool.query(
        `SELECT DISTINCT q.oportunidad_id, p.modelo_id, mo.name AS modelo_nombre
         FROM ventas_cotizaciones q
         INNER JOIN ventas_precios p ON p.id = q.precio_id
         INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id
         WHERE q.oportunidad_id IN (?)
         ORDER BY mo.name ASC`,
        [ids]
      );
      const [latestQuoteModels] = await pool.query(
        `SELECT q.oportunidad_id, p.modelo_id, mo.name AS modelo_nombre
         FROM ventas_cotizaciones q
         INNER JOIN (
           SELECT oportunidad_id, MAX(id) AS id
           FROM ventas_cotizaciones
           WHERE oportunidad_id IN (?)
           GROUP BY oportunidad_id
         ) latest ON latest.id = q.id
         INNER JOIN ventas_precios p ON p.id = q.precio_id
         INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id`,
        [ids]
      );
      detailRows = details;
      activityRows = activities;
      closureRows = closures;
      quoteModelRows = quoteModels;
      latestQuoteModelRows = latestQuoteModels;
    }
    const [clients] = await pool.query(
      `SELECT id, CONCAT(COALESCE(nombre,''), ' ', COALESCE(apellido,'')) AS nombre, identificacion_fiscal
       FROM administracion_clientes
       ${canViewAllClients ? "" : "WHERE created_by = ?"}
       ORDER BY nombre ASC
       LIMIT 1000`,
      canViewAllClients ? [] : [user.id]
    );
    const [origins] = await pool.query(`SELECT id, name FROM configuracion_origenes_citas WHERE is_active=1 ORDER BY name ASC`);
    const [suborigins] = await pool.query(`SELECT id, origen_id, name FROM configuracion_suborigenes_citas WHERE is_active=1 ORDER BY name ASC`);
    const [stages] = await pool.query(`SELECT id, nombre, descripcion, color, sort_order FROM ventas_etapasconversion WHERE is_active=1 ORDER BY COALESCE(sort_order,id) ASC`);
    const [users] = await pool.query(
      `SELECT u.id, u.fullname
       FROM administracion_usuarios u
       INNER JOIN configuracion_roles r ON r.id = u.role_id
       WHERE u.is_active=1 AND LOWER(TRIM(r.name)) = 'asesor'
       ORDER BY u.fullname ASC`
    );
    const [timeStates] = await pool.query(
      `SELECT id, nombre, estado, minutos_desde, minutos_hasta, color_hexadecimal, descripcion
       FROM ventas_configuracion_estados_tiempo
       WHERE activo = 1
       ORDER BY minutos_desde ASC`
    );
    const [closureReasons] = await pool.query(`SELECT id, detalle FROM configuracion_ventas_cierres_detalle ORDER BY detalle ASC`);
    const quoteModelOptions = Array.from(
      new Map(
        quoteModelRows
          .filter((row) => row.modelo_id)
          .map((row) => [Number(row.modelo_id), { id: Number(row.modelo_id), name: row.modelo_nombre || `Modelo ${row.modelo_id}` }])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name));
    const stageTemps = stages.map((stage) => ({ id: stage.id, temp: Number(stage.descripcion || 0), order: Number(stage.sort_order || stage.id) }));
    const now = new Date();
    return NextResponse.json({
      currentUser: { id: user.id, fullname: user.fullname, canViewAll },
      opportunities: opportunityRows.map((row) => {
        const details = detailRows.filter((detail) => detail.oportunidad_padre_id === row.id);
        const activities = activityRows.filter((activity) => activity.oportunidad_id === row.id);
        const closures = closureRows.filter((closure) => closure.oportunidad_id === row.id);
        const quoteModels = quoteModelRows.filter((quoteModel) => quoteModel.oportunidad_id === row.id);
        const latestQuoteModel = latestQuoteModelRows.find((quoteModel) => quoteModel.oportunidad_id === row.id);
        const currentOrder = Number(row.etapa_orden || row.etapasconversion_id);
        const temperature = stageTemps.filter((stage) => stage.order <= currentOrder).reduce((sum, stage) => sum + stage.temp, 0);
        const lastDetail = details.at(-1);
        const lastActivity = activities.at(-1);
        const lastClosure = closures.at(-1);
        const agendaDate = datePart(lastDetail?.fecha_agenda);
        const agendaTime = timePart(lastDetail?.hora_agenda);
        const agendaAt = agendaDate && agendaTime ? new Date(`${agendaDate}T${agendaTime}`) : null;
        const minutesUntilAgenda = agendaAt ? Math.round((agendaAt.getTime() - now.getTime()) / 60000) : null;
        const normalizedStage = normalizeStageName(row.etapa_nombre);
        const stageUsesTimeState = !["cerrada", "cerrado", "venta facturada"].includes(normalizedStage);
        const isClosedStage = ["cerrada", "cerrado"].includes(normalizedStage);
        const listDetail = isClosedStage
          ? (lastClosure?.clasificacion || lastClosure?.detalle || lastActivity?.detalle || "-")
          : (lastActivity?.detalle || "-");
        const timeState = stageUsesTimeState && minutesUntilAgenda !== null
          ? timeStates.find((state) => minutesUntilAgenda >= Number(state.minutos_desde) && minutesUntilAgenda <= Number(state.minutos_hasta))
          : null;
        return {
          id: row.id,
          code: row.oportunidad_id,
          clienteId: row.cliente_id,
          clienteNombre: row.cliente_nombre.trim(),
          clienteDocumento: row.cliente_documento || "",
          origenId: row.origen_id,
          origenNombre: row.origen_nombre,
          suborigenId: row.suborigen_id,
          suborigenNombre: row.suborigen_nombre || "",
          etapaId: row.etapasconversion_id,
          etapaNombre: row.etapa_nombre,
          etapaColor: row.etapa_color || "#2563eb",
          createdBy: row.created_by,
          creadoPorNombre: row.creado_por_nombre,
          asignadoA: row.asignado_a,
          asignadoANombre: row.asignado_a_nombre || "No asignado",
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          nextAgenda: lastDetail ? `${agendaDate} ${agendaTime}`.trim() : "",
          minutesUntilAgenda,
          timeState: timeState ? {
            id: timeState.id,
            nombre: timeState.nombre,
            estado: timeState.estado,
            color: timeState.color_hexadecimal,
            descripcion: timeState.descripcion || "",
          } : null,
          closureReasonIds: closures.map((closure) => closure.cierre_detalle_id).filter(Boolean).map(Number),
          closureReasons: closures.map((closure) => closure.clasificacion || closure.detalle || "").filter(Boolean),
          quoteModelIds: quoteModels.map((quoteModel) => quoteModel.modelo_id).filter(Boolean).map(Number),
          quoteModels: quoteModels.map((quoteModel) => quoteModel.modelo_nombre || "").filter(Boolean),
          latestQuoteModelId: latestQuoteModel?.modelo_id || null,
          latestQuoteModelName: latestQuoteModel?.modelo_nombre || "",
          detail: listDetail,
          temperature,
          details: details.map((detail) => ({ id: detail.id, fechaAgenda: datePart(detail.fecha_agenda), horaAgenda: timePart(detail.hora_agenda), createdAt: detail.created_at })),
          activities: activities.map((activity) => ({ id: activity.id, detalle: activity.detalle || "", etapaNombre: activity.etapa_nombre || "", createdByNombre: activity.created_by_nombre, createdAt: activity.created_at })),
        };
      }),
      options: {
        clients: clients.map((row) => ({ id: row.id, nombre: row.nombre.trim(), documento: row.identificacion_fiscal || "" })),
        origins: origins.map((row) => ({ id: row.id, name: row.name })),
        suborigins: suborigins.map((row) => ({ id: row.id, origenId: row.origen_id, name: row.name })),
        stages: stages.map((row) => ({ id: row.id, nombre: row.nombre, descripcion: Number(row.descripcion || 0), color: row.color || "#2563eb", sortOrder: row.sort_order || row.id })),
        users: users.map((row) => ({ id: row.id, fullname: row.fullname })),
        closureReasons: closureReasons.map((row) => ({ id: row.id, detalle: row.detalle || "" })),
        quoteModels: quoteModelOptions,
      },
    });
  } catch (error) {
    console.error("Error loading opportunities:", error);
    return NextResponse.json({ message: "No se pudieron cargar oportunidades." }, { status: 500 });
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
    const canViewAll = canSeeAll(user, config.permission);
    const canViewAllClients = canSeeAllClients(user);
    const clienteId = Number(body.clienteId);
    if (!clienteId || !body.origenId) return NextResponse.json({ message: "Completa cliente y origen." }, { status: 400 });
    if (!canViewAllClients) {
      const [clientRows] = await connection.query(
        `SELECT id FROM administracion_clientes WHERE id = ? AND created_by = ? LIMIT 1`,
        [clienteId, user.id]
      );
      if (!clientRows.length) {
        return NextResponse.json({ message: "No tienes permiso para usar este cliente." }, { status: 403 });
      }
    }
    const [openRows] = await connection.query(
      `SELECT o.id, o.oportunidad_id, e.nombre AS etapa_nombre
       FROM ventas_oportunidades o INNER JOIN ventas_etapasconversion e ON e.id=o.etapasconversion_id
       WHERE o.cliente_id=? ORDER BY o.id DESC`,
      [clienteId]
    );
    const open = openRows.find((row) => !isClosed(row.etapa_nombre));
    if (open) return NextResponse.json({ code: "OPEN_OPPORTUNITY", message: "El cliente tiene una oportunidad abierta.", opportunity: open }, { status: 409 });
    const assignedTo = canViewAll ? (body.asignadoA ? Number(body.asignadoA) : null) : user.id;
    if (assignedTo && !(await isAdvisorUser(connection, assignedTo))) {
      return NextResponse.json({ message: "Solo se puede asignar a usuarios con rol Asesor." }, { status: 400 });
    }
    const stageId = canViewAll ? await getStageId(connection, assignedTo ? "Asignado" : "Nuevo") : await getStageId(connection, "Asignado");
    await connection.beginTransaction();
    const code = await nextCode(connection, config.prefix);
    const [result] = await connection.query(
      `INSERT INTO ventas_oportunidades (cliente_id, origen_id, suborigen_id, etapasconversion_id, created_by, asignado_a, oportunidad_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clienteId, Number(body.origenId), body.suborigenId ? Number(body.suborigenId) : null, stageId, user.id, assignedTo, code]
    );
    const id = result.insertId;
    const detail = body.detail;
    if (detail?.fechaAgenda && detail?.horaAgenda) {
      await connection.query(`INSERT INTO ventas_oportunidades_detalles (oportunidad_padre_id, fecha_agenda, hora_agenda, oportunidad_id) VALUES (?, ?, ?, ?)`, [id, detail.fechaAgenda, detail.horaAgenda, code]);
    }
    for (const activity of body.activities || []) {
      if (activity.detalle) await connection.query(`INSERT INTO ventas_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by) VALUES (?, ?, ?, ?)`, [id, stageId, activity.detalle, user.id]);
    }
    await connection.commit();
    return NextResponse.json({ ok: true, id, code }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating opportunity:", error);
    return NextResponse.json({ message: "No se pudo crear la oportunidad." }, { status: 500 });
  } finally {
    connection.release();
  }
}
