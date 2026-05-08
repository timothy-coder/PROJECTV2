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

function datePart(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function timePart(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
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

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const config = configFromKind(request.nextUrl.searchParams.get("kind"));
    if (!hasPerm(user.permissions, [config.permission, "view"]) && !hasPerm(user.permissions, [config.permission, "viewall"])) {
      return NextResponse.json({ message: `No tienes permiso para ver ${config.label}.` }, { status: 403 });
    }
    const canAll = canSeeAll(user, config.permission);
    const [rows] = await pool.query(
      `SELECT o.*, CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente_nombre,
              v.placas, v.vin, v.anio, ma.name AS marca_nombre, mo.name AS modelo_nombre,
              og.name AS origen_nombre, so.name AS suborigen_nombre,
              e.nombre AS etapa_nombre, e.color AS etapa_color, e.descripcion AS temperatura,
              cu.fullname AS creado_por_nombre, au.fullname AS asignado_a_nombre,
              d.fecha_agenda, d.hora_agenda
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
         SELECT od.*
         FROM posventa_oportunidades_detalles od
         INNER JOIN (SELECT oportunidad_padre_id, MAX(id) AS max_id FROM posventa_oportunidades_detalles GROUP BY oportunidad_padre_id) x ON x.max_id=od.id
       ) d ON d.oportunidad_padre_id=o.id
       WHERE o.oportunidad_id LIKE ?
       ${canAll ? "" : "AND (o.created_by=? OR o.asignado_a=?)"}
       ORDER BY o.updated_at DESC`,
      canAll ? [`${config.prefix}-%`] : [`${config.prefix}-%`, user.id, user.id]
    );
    const [stages] = await pool.query(`SELECT id,nombre,descripcion,color,sort_order FROM configuracion_posventa_etapasconversion WHERE is_active=1 ORDER BY COALESCE(sort_order,id) ASC`);
    const [origins] = await pool.query(`SELECT id,name FROM configuracion_origenes_citas WHERE is_active=1 ORDER BY name ASC`);
    const [suborigins] = await pool.query(`SELECT id,origen_id,name FROM configuracion_suborigenes_citas WHERE is_active=1 ORDER BY name ASC`);
    const [users] = await pool.query(`SELECT id,fullname FROM administracion_usuarios WHERE is_active=1 ORDER BY fullname ASC`);
    return NextResponse.json({
      currentUser: { id: user.id, fullname: user.fullname, canViewAll: canAll },
      opportunities: rows.map((row) => ({
        id: row.id,
        code: row.oportunidad_id,
        clienteId: row.cliente_id,
        clienteNombre: row.cliente_nombre.trim(),
        vehiculoId: row.vehiculo_id,
        vehiculoNombre: [row.modelo_nombre, row.marca_nombre].filter(Boolean).join(" - ") || row.placas || row.vin || "-",
        placa: row.placas || "",
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
        detalle: row.detalle || "",
        agendaDate: datePart(row.fecha_agenda),
        agendaTime: timePart(row.hora_agenda),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      options: {
        stages: stages.map((row) => ({ id: row.id, nombre: row.nombre, descripcion: Number(row.descripcion || 0), color: row.color || "#2563eb", sortOrder: row.sort_order || row.id })),
        origins: origins.map((row) => ({ id: row.id, name: row.name })),
        suborigins: suborigins.map((row) => ({ id: row.id, origenId: row.origen_id, name: row.name })),
        users: users.map((row) => ({ id: row.id, fullname: row.fullname })),
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
    if (!body.clienteId || !body.vehiculoId || !body.origenId || !body.fechaAgenda || !body.horaAgenda) {
      return NextResponse.json({ message: "Completa cliente, vehiculo, origen y agenda." }, { status: 400 });
    }
    const canAll = canSeeAll(user, config.permission);
    const assignedTo = canAll ? (body.asignadoA ? Number(body.asignadoA) : null) : user.id;
    const stageId = Number(body.etapaId) || await stageIdByName(connection, assignedTo ? "En Atención" : "Nuevo");
    await connection.beginTransaction();
    const code = await nextCode(connection, config.prefix);
    const [result] = await connection.query(
      `INSERT INTO posventa_oportunidades (cliente_id, vehiculo_id, origen_id, suborigen_id, detalle, etapasconversionpv_id, created_by, asignado_a, oportunidad_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(body.clienteId), Number(body.vehiculoId), Number(body.origenId), body.suborigenId ? Number(body.suborigenId) : null, body.detalle || null, stageId, user.id, assignedTo, code]
    );
    await connection.query(
      `INSERT INTO posventa_oportunidades_detalles (oportunidad_padre_id, fecha_agenda, hora_agenda, oportunidad_id) VALUES (?, ?, ?, ?)`,
      [result.insertId, body.fechaAgenda, body.horaAgenda, code]
    );
    if (body.detalle) {
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by) VALUES (?, ?, ?, ?)`,
        [result.insertId, stageId, body.detalle, user.id]
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
