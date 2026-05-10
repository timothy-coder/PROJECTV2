import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/getCurrentUser";
import { pool } from "@/lib/db";

async function getStageId(connection, name) {
  const [rows] = await connection.query(`SELECT id FROM ventas_etapasconversion WHERE LOWER(nombre)=LOWER(?) LIMIT 1`, [name]);
  return rows[0]?.id || null;
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

export async function PUT(request, { params }) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    await connection.beginTransaction();
    const hasNewDetail = Boolean(body.detail?.fechaAgenda && body.detail?.horaAgenda);
    const [[countRow]] = await connection.query(`SELECT COUNT(*) AS total FROM ventas_oportunidades_detalles WHERE oportunidad_padre_id=?`, [id]);
    const reprogramStageId = hasNewDetail && Number(countRow.total || 0) > 0 ? await getStageId(connection, "Reprogramado") : null;
    const etapaId = reprogramStageId || Number(body.etapaId);
    if (body.asignadoA && !(await isAdvisorUser(connection, body.asignadoA))) {
      await connection.rollback();
      return NextResponse.json({ message: "Solo se puede asignar a usuarios con rol Asesor." }, { status: 400 });
    }
    await connection.query(`UPDATE ventas_oportunidades SET origen_id=?, suborigen_id=?, etapasconversion_id=?, asignado_a=? WHERE id=?`, [Number(body.origenId), body.suborigenId ? Number(body.suborigenId) : null, etapaId, body.asignadoA ? Number(body.asignadoA) : null, id]);
    if (hasNewDetail) await connection.query(`INSERT INTO ventas_oportunidades_detalles (oportunidad_padre_id, fecha_agenda, hora_agenda) VALUES (?, ?, ?)`, [id, body.detail.fechaAgenda, body.detail.horaAgenda]);
    for (const activity of body.activities || []) if (activity.detalle) await connection.query(`INSERT INTO ventas_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by) VALUES (?, ?, ?, ?)`, [id, Number(body.etapaId), activity.detalle, user.id]);
    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating opportunity:", error);
    return NextResponse.json({ message: "No se pudo actualizar la oportunidad." }, { status: 500 });
  } finally {
    connection.release();
  }
}
