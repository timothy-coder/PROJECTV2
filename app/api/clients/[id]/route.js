import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function normalizeClient(body) {
  return {
    idLead: String(body.idLead || "").trim() || null,
    nombre: String(body.nombre || "").trim() || null,
    apellido: String(body.apellido || "").trim() || null,
    email: String(body.email || "").trim() || null,
    celular: String(body.celular || "").trim() || null,
    tipoIdentificacion: body.tipoIdentificacion || null,
    identificacionFiscal: String(body.identificacionFiscal || "").trim() || null,
    fechaNacimiento: normalizeDateValue(body.fechaNacimiento),
    ocupacion: String(body.ocupacion || "").trim() || null,
    domicilio: String(body.domicilio || "").trim() || null,
    departamentoId: body.departamentoId ? Number(body.departamentoId) : null,
    provinciaId: body.provinciaId ? Number(body.provinciaId) : null,
    distritoId: body.distritoId ? Number(body.distritoId) : null,
    nombreConyugue: String(body.nombreConyugue || "").trim() || null,
    dniConyugue: String(body.dniConyugue || "").trim() || null,
    nombreComercial: String(body.nombreComercial || "").trim() || null,
    createdBy: body.createdBy ? Number(body.createdBy) : null,
  };
}

function normalizeDateValue(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return text;
}

function clientUpdateErrorMessage(error) {
  if (error?.code === "ER_DUP_ENTRY") return "El cliente ya existe. Hay un dato unico duplicado en la base de datos.";
  if (error?.code === "ER_DATA_TOO_LONG") return "Uno de los campos supera el largo permitido.";
  if (error?.code === "ER_TRUNCATED_WRONG_VALUE" || error?.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD") return "Hay un valor con formato invalido. Revisa la fecha de nacimiento.";
  if (error?.code === "ER_NO_REFERENCED_ROW_2") return "Departamento, provincia o distrito no existe en la base de datos.";
  if (error?.sqlMessage) return `No se pudo actualizar el cliente: ${error.sqlMessage}`;
  return "No se pudo actualizar el cliente.";
}

function duplicateReasons(payload, row) {
  const reasons = [];
  if (payload.identificacionFiscal && payload.identificacionFiscal === row.identificacion_fiscal) reasons.push(`documento ${payload.identificacionFiscal}`);
  if (payload.idLead && payload.idLead === row.id_lead) reasons.push(`ID Lead ${payload.idLead}`);
  if (payload.celular && payload.celular === row.celular) reasons.push(`celular ${payload.celular}`);
  if (payload.email && payload.email.toLowerCase() === String(row.email || "").toLowerCase()) reasons.push(`email ${payload.email}`);
  return reasons;
}

function formatDuplicateActivity(row) {
  if (!row?.activity_at) return "Sin oportunidades ni reservas registradas";
  const date = new Date(row.activity_at);
  const formatted = Number.isNaN(date.getTime())
    ? String(row.activity_at)
    : new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Lima",
      }).format(date);
  return `${row.activity_type || "Actividad"}: ${formatted}`;
}

async function findLastClientActivity(clientId) {
  const [rows] = await pool.query(
    `SELECT activity_type, activity_at
     FROM (
       SELECT 'Oportunidad' AS activity_type, o.created_at AS activity_at
       FROM ventas_oportunidades o
       WHERE o.cliente_id = ?
       UNION ALL
       SELECT 'Reserva' AS activity_type, r.created_at AS activity_at
       FROM ventas_reservas r
       INNER JOIN ventas_oportunidades o ON o.id = r.oportunidad_id
       WHERE o.cliente_id = ?
     ) activity
     WHERE activity_at IS NOT NULL
     ORDER BY activity_at DESC
     LIMIT 1`,
    [clientId, clientId]
  );
  return rows[0] || null;
}

async function findDuplicateClient(payload, excludeId) {
  const checks = [
    ["c.identificacion_fiscal = ?", payload.identificacionFiscal],
    ["c.id_lead = ?", payload.idLead],
    ["c.celular = ?", payload.celular],
    ["LOWER(c.email) = LOWER(?)", payload.email],
  ].filter(([, value]) => value);
  if (!checks.length) return null;

  const [rows] = await pool.query(
    `SELECT c.id, c.id_lead, c.nombre, c.apellido, c.email, c.celular, c.identificacion_fiscal,
            COALESCE(u.fullname, u.username, CONCAT('Usuario ', c.created_by)) AS created_by_name
     FROM administracion_clientes c
     LEFT JOIN administracion_usuarios u ON u.id = c.created_by
     WHERE (${checks.map(([clause]) => clause).join(" OR ")}) AND c.id <> ?
     ORDER BY c.id DESC
     LIMIT 1`,
    [...checks.map(([, value]) => value), excludeId]
  );
  const duplicate = rows[0];
  if (!duplicate) return null;
  const reasons = duplicateReasons(payload, duplicate);
  const lastActivity = await findLastClientActivity(duplicate.id);
  const activityLabel = formatDuplicateActivity(lastActivity);
  const owner = duplicate.created_by_name || "usuario no identificado";
  const clientName = [duplicate.nombre, duplicate.apellido].filter(Boolean).join(" ") || `cliente #${duplicate.id}`;
  return {
    duplicate,
    reasons,
    lastActivity,
    activityLabel,
    message: `El cliente ya esta registrado por ${owner}. Motivo: ${reasons.join(", ") || "datos duplicados"}. Cliente: ${clientName}. Ultima actividad: ${activityLabel}.`,
  };
}

function changedDuplicatePayload(payload, current) {
  return {
    identificacionFiscal: payload.identificacionFiscal !== (current.identificacion_fiscal || null) ? payload.identificacionFiscal : null,
    idLead: payload.idLead !== (current.id_lead || null) ? payload.idLead : null,
    celular: payload.celular !== (current.celular || null) ? payload.celular : null,
    email: payload.email && payload.email.toLowerCase() !== String(current.email || "").toLowerCase() ? payload.email : null,
  };
}

export async function PUT(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const payload = normalizeClient(await request.json());

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Cliente invalido." }, { status: 400 });
    }

    const [[current]] = await pool.query(
      `SELECT id, id_lead, email, celular, identificacion_fiscal, created_by
       FROM administracion_clientes
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!current) {
      return NextResponse.json({ message: "Cliente no encontrado." }, { status: 404 });
    }

    if (payload.createdBy) {
      const [[owner]] = await pool.query(`SELECT id FROM administracion_usuarios WHERE id=? LIMIT 1`, [payload.createdBy]);
      if (!owner) return NextResponse.json({ message: "El propietario seleccionado no existe." }, { status: 400 });
    }

    const duplicate = await findDuplicateClient(changedDuplicatePayload(payload, current), id);
    if (duplicate) {
      return NextResponse.json(
        {
          message: duplicate.message,
          reason: duplicate.reasons.join(", "),
          createdByName: duplicate.duplicate.created_by_name || "",
          clientId: duplicate.duplicate.id,
          lastActivity: duplicate.lastActivity?.activity_at || null,
          lastActivityType: duplicate.lastActivity?.activity_type || "",
        },
        { status: 409 }
      );
    }

    const connection = await pool.getConnection();
    let result;
    let opportunitiesAssigned = 0;
    try {
      await connection.beginTransaction();
      [result] = await connection.query(
        `UPDATE administracion_clientes
         SET id_lead = ?, nombre = ?, apellido = ?, email = ?, celular = ?,
             tipo_identificacion = ?, identificacion_fiscal = ?,
             fecha_nacimiento = ?, ocupacion = ?, domicilio = ?,
             departamento_id = ?, provincia_id = ?, distrito_id = ?,
             nombreconyugue = ?, dniconyugue = ?, nombre_comercial = ?,
             created_by = COALESCE(?, created_by)
         WHERE id = ?`,
        [
          payload.idLead,
          payload.nombre,
          payload.apellido,
          payload.email,
          payload.celular,
          payload.tipoIdentificacion,
          payload.identificacionFiscal,
          payload.fechaNacimiento,
          payload.ocupacion,
          payload.domicilio,
          payload.departamentoId,
          payload.provinciaId,
          payload.distritoId,
          payload.nombreConyugue,
          payload.dniConyugue,
          payload.nombreComercial,
          payload.createdBy,
          id,
        ]
      );

      if (payload.createdBy && Number(payload.createdBy) !== Number(current.created_by || 0)) {
        const [assignResult] = await connection.query(
          `UPDATE ventas_oportunidades o
           LEFT JOIN configuracion_ventas_etapas e ON e.id = o.etapasconversion_id
           SET o.asignado_a = ?
           WHERE o.cliente_id = ?
             AND LOWER(COALESCE(e.nombre, '')) <> 'cerrada'`,
          [payload.createdBy, id]
        );
        opportunitiesAssigned = Number(assignResult.affectedRows || 0);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Cliente no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, opportunitiesAssigned });
  } catch (error) {
    console.error("Error updating client:", error);

    return NextResponse.json(
      { message: clientUpdateErrorMessage(error) },
      { status: error?.code === "ER_DUP_ENTRY" ? 409 : 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "Cliente invalido." }, { status: 400 });
    }

    const [result] = await pool.query(`DELETE FROM administracion_clientes WHERE id = ?`, [id]);

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Cliente no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting client:", error);

    return NextResponse.json(
      { message: "No se pudo eliminar el cliente." },
      { status: 500 }
    );
  }
}
