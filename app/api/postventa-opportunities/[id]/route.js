import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { isActiveMaintenanceSubitem, loadMaintenanceSubitems, updateVehicleNextMaintenanceDate } from "@/lib/maintenanceNextVisit";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function permissionFromCode(code = "") {
  return String(code).startsWith("LDPV-") ? "leadspv" : "oportunidadespv";
}

function canSeeAll(user) {
  return Boolean(hasPerm(user.permissions, ["oportunidadespv", "viewall"]) || hasPerm(user.permissions, ["leadspv", "viewall"]));
}

function canView(user, permission) {
  return Boolean(hasPerm(user.permissions, [permission, "view"]) || hasPerm(user.permissions, [permission, "viewall"]));
}

function canEdit(user, permission) {
  return Boolean(hasPerm(user.permissions, [permission, "edit"]) || hasPerm(user.permissions, [permission, "viewall"]));
}

function canAssign(user, permission) {
  return Boolean(hasPerm(user.permissions, [permission, "asignar"]) || hasPerm(user.permissions, [permission, "viewall"]));
}

async function closedStageId(connection) {
  const [rows] = await connection.query(
    `SELECT id
     FROM configuracion_posventa_etapasconversion
     WHERE LOWER(nombre) IN ('cerrada', 'cerrado')
     ORDER BY CASE LOWER(nombre) WHEN 'cerrada' THEN 0 WHEN 'cerrado' THEN 1 ELSE 2 END
     LIMIT 1`
  );
  return rows[0]?.id || null;
}

async function stageIdByNames(connection, names) {
  const normalized = names.map((name) => String(name).toLowerCase());
  const [rows] = await connection.query(
    `SELECT id
     FROM configuracion_posventa_etapasconversion
     WHERE LOWER(nombre) IN (?)
     ORDER BY id ASC
     LIMIT 1`,
    [normalized]
  );
  return rows[0]?.id || null;
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

function numberValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dateTimeValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  const clean = String(value).trim();
  if (!clean) return null;
  return clean.length <= 10 ? `${clean} 00:00:00` : clean.replace("T", " ").slice(0, 19);
}

async function loadOpportunity(connection, id, user, canAll) {
  const [rows] = await connection.query(
    `SELECT o.id, o.cliente_id, o.vehiculo_id, o.origen_id, o.suborigen_id, o.etapasconversionpv_id,
            o.created_by, o.asignado_a, o.created_at, o.updated_at, o.oportunidad_id,
            CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente_nombre,
            c.nombre AS cliente_first_name, c.apellido AS cliente_last_name, c.email, c.celular, c.tipo_identificacion, c.identificacion_fiscal,
            v.placas, v.vin, v.marca_id, v.modelo_id, v.anio, v.color, v.kilometraje, v.fecha_ultima_visita, ma.name AS marca_nombre, mo.name AS modelo_nombre,
            og.name AS origen_nombre, so.name AS suborigen_nombre,
            e.nombre AS etapa_nombre, e.color AS etapa_color, e.descripcion AS etapa_temp, e.sort_order,
            cu.fullname AS creado_nombre, au.fullname AS asignado_nombre
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
     WHERE o.id=? ${canAll ? "" : "AND (o.created_by=? OR o.asignado_a=?)"} LIMIT 1`,
    canAll ? [id] : [id, user.id, user.id]
  );
  return rows[0] || null;
}

export async function GET(_request, { params }) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const { id: rawId } = await params;
    const id = Number(rawId);
    const canAll = canSeeAll(user);
    const opportunity = await loadOpportunity(connection, id, user, canAll);
    if (!opportunity) return NextResponse.json({ message: "No encontrada." }, { status: 404 });
    const permission = permissionFromCode(opportunity.oportunidad_id);
    if (!canView(user, permission)) return NextResponse.json({ message: "No tienes permiso para ver este registro." }, { status: 403 });

    const [stages] = await connection.query(
      `SELECT id,nombre,descripcion,color,sort_order
       FROM configuracion_posventa_etapasconversion
       WHERE is_active=1
       ORDER BY COALESCE(sort_order,id) ASC`
    );
    const [details] = await connection.query(
      `SELECT id, fecha_agenda, hora_agenda, oportunidad_id, created_at
       FROM posventa_oportunidades_detalles
       WHERE oportunidad_padre_id=?
       ORDER BY fecha_agenda DESC, hora_agenda DESC, created_at DESC, id DESC`,
      [id]
    );
    const [activities] = await connection.query(
      `SELECT a.id, a.etapasconversion_id, a.detalle, a.created_by, a.created_at, a.updated_at,
              e.nombre AS etapa_nombre, e.color AS etapa_color, u.fullname AS user_name
       FROM posventa_oportunidades_actividades a
       LEFT JOIN configuracion_posventa_etapasconversion e ON e.id=a.etapasconversion_id
       INNER JOIN administracion_usuarios u ON u.id=a.created_by
       WHERE a.oportunidad_id=?
       ORDER BY a.created_at DESC, a.id DESC`,
      [id]
    );
    const [appointments] = await connection.query(
      `SELECT pc.id, pc.centro_id, pc.taller_id, pc.asesor_id, pc.origen_id,
              pc.start_at, pc.end_at, pc.estado, pc.tipo_servicio, pc.nota_cliente, pc.nota_interna,
              cc.nombre AS centro_nombre, ct.nombre AS taller_nombre, asesor.fullname AS asesor_nombre
       FROM posventa_citas pc
       INNER JOIN configuracion_centros cc ON cc.id=pc.centro_id
       LEFT JOIN configuracion_talleres ct ON ct.id=pc.taller_id
       LEFT JOIN administracion_usuarios asesor ON asesor.id=pc.asesor_id
       WHERE pc.oportunidadespv_id=?
       ORDER BY pc.start_at DESC, pc.id DESC`,
      [id]
    );
    const [centers] = await connection.query(`SELECT id,nombre FROM configuracion_centros ORDER BY nombre ASC`);
    const [workshops] = await connection.query(`SELECT id,centro_id,nombre FROM configuracion_talleres ORDER BY nombre ASC`);
    const [origins] = await connection.query(`SELECT id,name FROM configuracion_origenes_citas WHERE is_active=1 ORDER BY name ASC`);
    const [users] = await connection.query(`SELECT id,fullname FROM administracion_usuarios WHERE is_active=1 ORDER BY fullname ASC`);
    const maintenanceSubitems = await loadMaintenanceSubitems(connection);
    const [closingOptions] = await connection.query(`SELECT id,detalle FROM configuracion_posventas_cierres_detalle ORDER BY id DESC`);
    const [brandRows] = await connection.query(`SELECT id,name FROM administracion_marcas ORDER BY name ASC`);
    const [modelRows] = await connection.query(`SELECT id,marca_id,clase_id,name FROM administracion_modelos ORDER BY name ASC`);
    const [classRows] = await connection.query(`SELECT id,name FROM administracion_clases ORDER BY name ASC`);
    const [closures] = await connection.query(
      `SELECT c.id, c.detalle, c.cierre_detalle_id, c.created_at, u.fullname AS user_name, cd.detalle AS motivo
       FROM posventa_oportunidades_cierres c
       INNER JOIN administracion_usuarios u ON u.id=c.created_by
       LEFT JOIN configuracion_posventas_cierres_detalle cd ON cd.id=c.cierre_detalle_id
       WHERE c.oportunidad_id=?
       ORDER BY c.created_at DESC, c.id DESC`,
      [id]
    );

    return NextResponse.json({
      currentUser: {
        id: user.id,
        fullname: user.fullname,
        canViewAll: canAll,
        canEditOpportunity: canEdit(user, permission),
        canCreateQuote: hasPerm(user.permissions, ["cotizacion", "create"]),
        canCreateAppointment: hasPerm(user.permissions, ["citas", "create"]),
      },
      opportunity: {
        id: opportunity.id,
        code: opportunity.oportunidad_id,
        clienteId: opportunity.cliente_id,
        clienteNombreRaw: opportunity.cliente_first_name || "",
        clienteApellido: opportunity.cliente_last_name || "",
        clienteNombre: opportunity.cliente_nombre.trim(),
        email: opportunity.email || "",
        celular: opportunity.celular || "",
        tipoIdentificacion: opportunity.tipo_identificacion || "",
        dni: opportunity.identificacion_fiscal || "",
        vehiculoId: opportunity.vehiculo_id,
        vehiculoNombre: [opportunity.marca_nombre, opportunity.modelo_nombre].filter(Boolean).join(" ") || opportunity.placas || opportunity.vin || "-",
        placa: opportunity.placas || "",
        vin: opportunity.vin || "",
        marcaId: opportunity.marca_id,
        modeloId: opportunity.modelo_id,
        anio: opportunity.anio || "",
        color: opportunity.color || "",
        kilometraje: opportunity.kilometraje || "",
        fechaUltimaVisita: datePart(opportunity.fecha_ultima_visita),
        origenId: opportunity.origen_id,
        origenNombre: opportunity.origen_nombre,
        suborigenNombre: opportunity.suborigen_nombre || "",
        etapaId: opportunity.etapasconversionpv_id,
        etapaNombre: opportunity.etapa_nombre,
        etapaColor: opportunity.etapa_color || "#2563eb",
        asignadoNombre: opportunity.asignado_nombre || "Sin asignar",
        creadoNombre: opportunity.creado_nombre,
        createdAt: opportunity.created_at,
        updatedAt: opportunity.updated_at,
      },
      stages: stages.map((row) => ({
        id: row.id,
        nombre: row.nombre,
        temp: Number(row.descripcion || 0),
        color: row.color || "#2563eb",
        sortOrder: row.sort_order || row.id,
      })),
      details: details.map((row) => ({
        id: row.id,
        fechaAgenda: datePart(row.fecha_agenda),
        horaAgenda: timePart(row.hora_agenda),
        code: row.oportunidad_id || "",
        createdAt: row.created_at,
      })),
      appointments: appointments.map((row) => ({
        id: row.id,
        centroId: row.centro_id,
        tallerId: row.taller_id,
        asesorId: row.asesor_id,
        origenId: row.origen_id,
        startDate: datePart(row.start_at),
        startTime: timePart(row.start_at),
        endDate: datePart(row.end_at),
        endTime: timePart(row.end_at),
        estado: row.estado,
        tipoServicio: row.tipo_servicio,
        notaCliente: row.nota_cliente || "",
        notaInterna: row.nota_interna || "",
        centroNombre: row.centro_nombre,
        tallerNombre: row.taller_nombre || "",
        asesorNombre: row.asesor_nombre || "Sin asesor",
      })),
      appointmentOptions: {
        centers: centers.map((row) => ({ id: row.id, nombre: row.nombre })),
        workshops: workshops.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
        origins: origins.map((row) => ({ id: row.id, name: row.name })),
        users: users.map((row) => ({ id: row.id, fullname: row.fullname })),
        maintenanceSubitems,
      },
      vehicleOptions: {
        marcas: brandRows.map((row) => ({ id: row.id, name: row.name })),
        modelos: modelRows.map((row) => ({ id: row.id, marcaId: row.marca_id, claseId: row.clase_id, name: row.name })),
        clases: classRows.map((row) => ({ id: row.id, name: row.name })),
      },
      closings: closingOptions.map((row) => ({ id: row.id, detalle: row.detalle || "" })),
      closures: closures.map((row) => ({
        id: row.id,
        detalle: row.detalle || "",
        motivo: row.motivo || "",
        cierreDetalleId: row.cierre_detalle_id,
        userName: row.user_name,
        createdAt: row.created_at,
      })),
      activities: activities.map((row) => ({
        id: row.id,
        etapaId: row.etapasconversion_id,
        etapaNombre: row.etapa_nombre || "",
        etapaColor: row.etapa_color || "#2563eb",
        detalle: row.detalle || "",
        userId: row.created_by,
        userName: row.user_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    console.error("Error loading postventa opportunity detail:", error);
    return NextResponse.json({ message: "No se pudo cargar el detalle de PostVenta." }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function POST(request, { params }) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const canAll = canSeeAll(user);
    const opportunity = await loadOpportunity(connection, id, user, canAll);
    if (!opportunity) return NextResponse.json({ message: "No encontrada." }, { status: 404 });
    const permission = permissionFromCode(opportunity.oportunidad_id);
    if (!canView(user, permission)) return NextResponse.json({ message: "No tienes permiso para editar este registro." }, { status: 403 });

    await connection.beginTransaction();
    if (body.action === "stage") {
      await connection.query(`UPDATE posventa_oportunidades SET etapasconversionpv_id=? WHERE id=?`, [Number(body.etapaId), id]);
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
         VALUES (?, ?, ?, ?)`,
        [id, Number(body.etapaId), body.detalle || "Cambio de etapa", user.id]
      );
    }
    if (body.action === "close") {
      const closeDetailId = body.cierreDetalleId ? Number(body.cierreDetalleId) : null;
      const closeDetail = String(body.detalle || "").trim();
      if (!closeDetailId && !closeDetail) {
        await connection.rollback();
        return NextResponse.json({ message: "Selecciona o escribe un motivo de cierre." }, { status: 400 });
      }
      const closeStageId = await closedStageId(connection);
      if (!closeStageId) {
        await connection.rollback();
        return NextResponse.json({ message: "No existe una etapa Cerrada/Cerrado configurada." }, { status: 400 });
      }
      await connection.query(`UPDATE posventa_oportunidades SET etapasconversionpv_id=? WHERE id=?`, [closeStageId, id]);
      await connection.query(
        `INSERT INTO posventa_oportunidades_cierres (oportunidad_id, detalle, cierre_detalle_id, created_by)
         VALUES (?, ?, ?, ?)`,
        [id, closeDetail || "Cierre registrado", closeDetailId, user.id]
      );
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
         VALUES (?, ?, ?, ?)`,
        [id, closeStageId, `Oportunidad cerrada: ${closeDetail || "Cierre registrado"}`, user.id]
      );
    }
    if (body.action === "activity") {
      const detalle = String(body.detalle || "").trim();
      if (!detalle) {
        await connection.rollback();
        return NextResponse.json({ message: "Escribe el detalle de la actividad." }, { status: 400 });
      }
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
         VALUES (?, ?, ?, ?)`,
        [id, opportunity.etapasconversionpv_id, detalle, user.id]
      );
    }
    if (body.action === "activity-update") {
      const detalle = String(body.detalle || "").trim();
      if (!body.activityId || !detalle) {
        await connection.rollback();
        return NextResponse.json({ message: "Completa la actividad." }, { status: 400 });
      }
      await connection.query(
        `UPDATE posventa_oportunidades_actividades
         SET detalle=?
         WHERE id=? AND oportunidad_id=?`,
        [detalle, Number(body.activityId), id]
      );
    }
    if (body.action === "client-update") {
      if (!canEdit(user, permission)) {
        await connection.rollback();
        return NextResponse.json({ message: "No tienes permiso para editar este registro." }, { status: 403 });
      }
      const nombre = String(body.nombre || "").trim();
      if (!nombre) {
        await connection.rollback();
        return NextResponse.json({ message: "El nombre del cliente es obligatorio." }, { status: 400 });
      }
      await connection.query(
        `UPDATE administracion_clientes
         SET nombre=?, apellido=?, email=?, celular=?, tipo_identificacion=?, identificacion_fiscal=?
         WHERE id=?`,
        [
          nombre,
          String(body.apellido || "").trim() || null,
          String(body.email || "").trim() || null,
          String(body.celular || "").trim() || null,
          String(body.tipoIdentificacion || "").trim() || null,
          String(body.identificacionFiscal || "").trim() || null,
          opportunity.cliente_id,
        ]
      );
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
         VALUES (?, ?, ?, ?)`,
        [id, opportunity.etapasconversionpv_id, "Datos del cliente actualizados", user.id]
      );
    }
    if (body.action === "vehicle-update") {
      if (!canEdit(user, permission)) {
        await connection.rollback();
        return NextResponse.json({ message: "No tienes permiso para editar este registro." }, { status: 403 });
      }
      const placas = String(body.placas || "").trim();
      if (!placas) {
        await connection.rollback();
        return NextResponse.json({ message: "La placa del vehiculo es obligatoria." }, { status: 400 });
      }
      await connection.query(
        `UPDATE administracion_vehiculos
         SET cliente_id=?, placas=?, vin=?, marca_id=?, modelo_id=?, anio=?, color=?, kilometraje=?, fecha_ultima_visita=?
         WHERE id=?`,
        [
          opportunity.cliente_id,
          placas,
          String(body.vin || "").trim() || null,
          body.marcaId ? Number(body.marcaId) : null,
          body.modeloId ? Number(body.modeloId) : null,
          body.anio ? Number(body.anio) : null,
          String(body.color || "").trim() || null,
          body.kilometraje ? Number(body.kilometraje) : null,
          body.fechaUltimaVisita || null,
          opportunity.vehiculo_id,
        ]
      );
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
         VALUES (?, ?, ?, ?)`,
        [id, opportunity.etapasconversionpv_id, "Datos del vehiculo actualizados", user.id]
      );
    }
    if (body.action === "agenda") {
      if (!body.fechaAgenda || !body.horaAgenda) {
        await connection.rollback();
        return NextResponse.json({ message: "Completa fecha y hora de agenda." }, { status: 400 });
      }
      await connection.query(
        `INSERT INTO posventa_oportunidades_detalles (oportunidad_padre_id, fecha_agenda, hora_agenda, oportunidad_id)
         VALUES (?, ?, ?, ?)`,
        [id, body.fechaAgenda, body.horaAgenda, opportunity.oportunidad_id]
      );
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
         VALUES (?, ?, ?, ?)`,
        [id, opportunity.etapasconversionpv_id, `Agenda registrada: ${body.fechaAgenda} ${body.horaAgenda}`, user.id]
      );
    }
    if (body.action === "maintenance") {
      const fechaVisita = dateTimeValue(body.fechaVisitaTaller ?? body.fechaVisita ?? body.fecha);
      const kilometraje = numberValue(body.kilometrajeTaller ?? body.kilometraje);
      const submantenimientoId = body.submantenimientoId ? Number(body.submantenimientoId) : null;
      if (!fechaVisita) {
        await connection.rollback();
        return NextResponse.json({ message: "La fecha de mantenimiento es obligatoria." }, { status: 400 });
      }
      if (kilometraje === null) {
        await connection.rollback();
        return NextResponse.json({ message: "El kilometraje de mantenimiento es obligatorio." }, { status: 400 });
      }
      if (!submantenimientoId) {
        await connection.rollback();
        return NextResponse.json({ message: "Selecciona el submantenimiento realizado." }, { status: 400 });
      }
      if (!(await isActiveMaintenanceSubitem(connection, submantenimientoId))) {
        await connection.rollback();
        return NextResponse.json({ message: "El submantenimiento seleccionado no es valido." }, { status: 400 });
      }
      const effectiveStageId = await stageIdByNames(connection, ["Cita efectiva"]);
      if (!effectiveStageId) {
        await connection.rollback();
        return NextResponse.json({ message: "No existe una etapa Cita efectiva configurada." }, { status: 400 });
      }
      await connection.query(
        `INSERT INTO administracion_vehiculos_historial_mantenimientos
         (vehiculo_id, fecha_visita_taller, kilometraje_taller, submantenimiento_id, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [opportunity.vehiculo_id, fechaVisita, kilometraje, submantenimientoId, user.id]
      );
      const nextDate = await updateVehicleNextMaintenanceDate(connection, opportunity.vehiculo_id);
      const maintenanceDate = datePart(fechaVisita);
      await connection.query(`UPDATE posventa_oportunidades SET etapasconversionpv_id=? WHERE id=?`, [effectiveStageId, id]);
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
         VALUES (?, ?, ?, ?)`,
        [id, effectiveStageId, `Cita efectiva: mantenimiento ${maintenanceDate} con KM ${kilometraje}. Proximo mantenimiento recalculado${nextDate ? `: ${nextDate}` : ""}`, user.id]
      );
    }
    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error saving postventa opportunity detail:", error);
    return NextResponse.json({ message: "No se pudo guardar el detalle de PostVenta." }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function PUT(request, { params }) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const canAll = canSeeAll(user);
    const opportunity = await loadOpportunity(connection, id, user, canAll);
    if (!opportunity) return NextResponse.json({ message: "No encontrada." }, { status: 404 });
    const permission = permissionFromCode(opportunity.oportunidad_id);
    const isAssign = body.action === "assign";
    if (isAssign ? !canAssign(user, permission) : !canEdit(user, permission)) {
      return NextResponse.json({ message: "No tienes permiso para realizar esta accion." }, { status: 403 });
    }

    await connection.beginTransaction();
    if (isAssign) {
      await connection.query(
        `UPDATE posventa_oportunidades SET asignado_a=? WHERE id=?`,
        [body.asignadoA ? Number(body.asignadoA) : null, id]
      );
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
         VALUES (?, ?, ?, ?)`,
        [id, opportunity.etapasconversionpv_id, body.asignadoA ? "Oportunidad asignada" : "Oportunidad sin asignar", user.id]
      );
    } else {
      const details = Array.isArray(body.details)
        ? body.details.filter((item) => item?.fechaAgenda && item?.horaAgenda)
        : body.fechaAgenda && body.horaAgenda ? [{ fechaAgenda: body.fechaAgenda, horaAgenda: body.horaAgenda }] : [];
      const activities = Array.isArray(body.activities)
        ? body.activities.map((item) => String(item?.detalle || "").trim()).filter(Boolean)
        : [];
      await connection.query(
        `UPDATE posventa_oportunidades
         SET origen_id=?, suborigen_id=?, etapasconversionpv_id=?, asignado_a=?
         WHERE id=?`,
        [
          Number(body.origenId || opportunity.origen_id),
          body.suborigenId ? Number(body.suborigenId) : null,
          Number(body.etapaId || opportunity.etapasconversionpv_id),
          body.asignadoA ? Number(body.asignadoA) : null,
          id,
        ]
      );
      for (const detail of details) {
        await connection.query(
          `INSERT INTO posventa_oportunidades_detalles (oportunidad_padre_id, fecha_agenda, hora_agenda, oportunidad_id)
           VALUES (?, ?, ?, ?)`,
          [id, detail.fechaAgenda, detail.horaAgenda, opportunity.oportunidad_id]
        );
      }
      for (const activity of activities) {
        await connection.query(
          `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
           VALUES (?, ?, ?, ?)`,
          [id, Number(body.etapaId || opportunity.etapasconversionpv_id), activity, user.id]
        );
      }
      await connection.query(
        `INSERT INTO posventa_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by)
         VALUES (?, ?, ?, ?)`,
        [id, Number(body.etapaId || opportunity.etapasconversionpv_id), "Oportunidad editada", user.id]
      );
    }
    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating postventa opportunity:", error);
    return NextResponse.json({ message: "No se pudo actualizar la oportunidad de PostVenta." }, { status: 500 });
  } finally {
    connection.release();
  }
}
