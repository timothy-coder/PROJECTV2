import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function datePart(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = String(value);
  return text.match(/\d{4}-\d{2}-\d{2}/)?.[0] || text.slice(0, 10);
}

function timePart(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  const text = String(value);
  return text.match(/\d{2}:\d{2}/)?.[0] || text.slice(0, 5);
}

async function enabledLiveSurvey(connection) {
  const [rows] = await connection.query(
    `SELECT habilitar_encuesta_en_vivo
     FROM configuracion_testdrive
     ORDER BY id ASC
     LIMIT 1`
  );
  return Boolean(rows[0]?.habilitar_encuesta_en_vivo);
}

async function loadPublicSurvey(connection, token) {
  const [rows] = await connection.query(
    `SELECT l.id AS link_id, l.token, l.estado AS link_estado, l.expires_at, l.respondido_at,
            t.id AS testdrive_id, t.fecha_testdrive, t.hora_inicio, t.hora_fin, t.placa, t.vin,
            mo.name AS modelo,
            o.id AS oportunidad_pk, o.oportunidad_id,
            CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente_nombre
     FROM ventas_testdrive_encuesta_links l
     INNER JOIN ventas_oportunidades_test_drives t ON t.id = l.testdrive_id
     INNER JOIN ventas_oportunidades o ON o.id = l.oportunidad_id
     INNER JOIN administracion_clientes c ON c.id = o.cliente_id
     LEFT JOIN administracion_modelos mo ON mo.id = t.modelo_id
     WHERE l.token = ?
     LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

function mapRoutePoint(row) {
  return {
    id: row.id,
    lat: Number(row.latitud),
    lng: Number(row.longitud),
    accuracy: row.precision_metros === null ? null : Number(row.precision_metros),
    speed: row.velocidad === null ? null : Number(row.velocidad),
    heading: row.heading === null ? null : Number(row.heading),
    capturedAt: row.capturado_at,
  };
}

export async function GET(_request, { params }) {
  const connection = await pool.getConnection();
  try {
    const { token } = await params;
    if (!(await enabledLiveSurvey(connection))) {
      return NextResponse.json({ message: "La encuesta en vivo no esta disponible." }, { status: 403 });
    }
    const survey = await loadPublicSurvey(connection, token);
    if (!survey) return NextResponse.json({ message: "Enlace no encontrado." }, { status: 404 });
    if (survey.link_estado === "cancelado") return NextResponse.json({ message: "Este enlace fue cancelado." }, { status: 410 });
    if (survey.expires_at && new Date(survey.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ message: "Este enlace ya vencio." }, { status: 410 });
    }
    let routePoints = [];
    try {
      const [points] = await connection.query(
        `SELECT id, latitud, longitud, precision_metros, velocidad, heading, capturado_at
         FROM ventas_testdrive_ruta_puntos
         WHERE testdrive_id=?
         ORDER BY capturado_at ASC, id ASC`,
        [survey.testdrive_id]
      );
      routePoints = points.map(mapRoutePoint);
    } catch {
      routePoints = [];
    }
    return NextResponse.json({
      ok: true,
      link: {
        token: survey.token,
        estado: survey.link_estado,
        respondidoAt: survey.respondido_at,
      },
      testdrive: {
        id: survey.testdrive_id,
        numero: `TD ${survey.testdrive_id}`,
        fecha: datePart(survey.fecha_testdrive),
        horaInicio: timePart(survey.hora_inicio),
        horaFin: timePart(survey.hora_fin),
        modelo: survey.modelo || "",
        placa: survey.placa || "",
        vin: survey.vin || "",
        oportunidadCodigo: survey.oportunidad_id,
        clienteNombre: String(survey.cliente_nombre || "").trim(),
      },
      routePoints,
    });
  } catch (error) {
    console.error("Error loading public test drive survey:", error);
    return NextResponse.json({ message: "No se pudo cargar la encuesta." }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function POST(request, { params }) {
  const connection = await pool.getConnection();
  try {
    const { token } = await params;
    const body = await request.json();
    if (!(await enabledLiveSurvey(connection))) {
      return NextResponse.json({ message: "La encuesta en vivo no esta disponible." }, { status: 403 });
    }
    const survey = await loadPublicSurvey(connection, token);
    if (!survey) return NextResponse.json({ message: "Enlace no encontrado." }, { status: 404 });
    if (survey.link_estado === "cancelado") return NextResponse.json({ message: "Este enlace fue cancelado." }, { status: 410 });
    if (survey.expires_at && new Date(survey.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ message: "Este enlace ya vencio." }, { status: 410 });
    }

    await connection.beginTransaction();
    const [columns] = await connection.query(`SHOW COLUMNS FROM ventas_oportunidades_test_drive_encuestas`);
    const surveyColumns = columns.map((column) => column.Field);
    const payload = {
      oportunidad_id: survey.oportunidad_pk,
      testdrive_id: survey.testdrive_id,
      link_id: survey.link_id,
      ruta_ergonomia: Number(body.rutaErgonomia || 0),
      ruta_visibilidad: Number(body.rutaVisibilidad || 0),
      ruta_dinamica: Number(body.rutaDinamica || 0),
      ruta_seguridad: Number(body.rutaSeguridad || 0),
      ruta_confort: Number(body.rutaConfort || 0),
      ruta_tecnologia: Number(body.rutaTecnologia || 0),
      feedback_satisfaccion: body.feedbackSatisfaccion || null,
      asesor_explico: body.asesorExplico || null,
      experiencia_testdrive: body.experienciaTestdrive || null,
      explicaciones_demostraciones: body.explicacionesDemostraciones || null,
      ford_manejo: body.fordManejo || null,
      estado_vehiculo: body.estadoVehiculo || null,
      auto_suficiente: body.autoSuficiente || null,
      realizara_compra: body.realizaraCompra || null,
      compra_plazo: body.compraPlazo || null,
      respondido_por: "cliente",
      respondido_at: new Date(),
      ip_respuesta: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: request.headers.get("user-agent") || null,
    };
    const allowedColumns = Object.keys(payload).filter((column) => surveyColumns.includes(column));
    const [[existing]] = await connection.query(`SELECT id FROM ventas_oportunidades_test_drive_encuestas WHERE testdrive_id=? LIMIT 1`, [survey.testdrive_id]);
    if (existing) {
      const updateColumns = allowedColumns.filter((column) => !["oportunidad_id", "testdrive_id"].includes(column));
      if (surveyColumns.includes("updated_at")) updateColumns.push("updated_at");
      const setSql = updateColumns.map((column) => (column === "updated_at" ? "`updated_at`=CURRENT_TIMESTAMP" : `\`${column}\`=?`)).join(", ");
      const updateValues = updateColumns.filter((column) => column !== "updated_at").map((column) => payload[column]);
      await connection.query(`UPDATE ventas_oportunidades_test_drive_encuestas SET ${setSql} WHERE id=?`, [...updateValues, existing.id]);
    } else {
      const insertSql = allowedColumns.map((column) => `\`${column}\``).join(", ");
      const placeholders = allowedColumns.map(() => "?").join(", ");
      await connection.query(`INSERT INTO ventas_oportunidades_test_drive_encuestas (${insertSql}) VALUES (${placeholders})`, allowedColumns.map((column) => payload[column]));
    }
    await connection.query(`UPDATE ventas_testdrive_encuesta_links SET estado='respondido', respondido_at=NOW() WHERE id=?`, [survey.link_id]);
    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error saving public test drive survey:", error);
    return NextResponse.json({ message: "No se pudo guardar la encuesta." }, { status: 500 });
  } finally {
    connection.release();
  }
}
