import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function datePart(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function timePart(value) {
  if (!value) return "";
  if (value instanceof Date) return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  return String(value).slice(11, 16) || String(value).slice(0, 5);
}

export async function GET(_request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (!hasPerm(user.permissions, ["citas", "view"]) && !hasPerm(user.permissions, ["citas", "viewall"])) {
      return NextResponse.json({ message: "No tienes permiso para ver citas de PostVenta." }, { status: 403 });
    }
    const { id: rawId } = await params;
    const canAll = hasPerm(user.permissions, ["citas", "viewall"]);
    const [rows] = await pool.query(
      `SELECT pc.*, cc.nombre AS centro_nombre, ct.nombre AS taller_nombre,
              CONCAT(COALESCE(cl.nombre,''),' ',COALESCE(cl.apellido,'')) AS cliente_nombre,
              cl.email, cl.celular, cl.identificacion_fiscal,
              v.placas, v.vin, v.anio, v.color, ma.name AS marca_nombre, mo.name AS modelo_nombre,
              asesor.fullname AS asesor_nombre, creador.fullname AS creado_por_nombre,
              oc.name AS origen_nombre, op.oportunidad_id AS oportunidad_codigo
       FROM posventa_citas pc
       INNER JOIN configuracion_centros cc ON cc.id=pc.centro_id
       LEFT JOIN configuracion_talleres ct ON ct.id=pc.taller_id
       INNER JOIN administracion_clientes cl ON cl.id=pc.cliente_id
       LEFT JOIN administracion_vehiculos v ON v.id=pc.vehiculo_id
       LEFT JOIN administracion_marcas ma ON ma.id=v.marca_id
       LEFT JOIN administracion_modelos mo ON mo.id=v.modelo_id
       LEFT JOIN administracion_usuarios asesor ON asesor.id=pc.asesor_id
       INNER JOIN administracion_usuarios creador ON creador.id=pc.created_by
       LEFT JOIN configuracion_origenes_citas oc ON oc.id=pc.origen_id
       LEFT JOIN posventa_oportunidades op ON op.id=pc.oportunidadespv_id
       WHERE pc.id=? ${canAll ? "" : "AND (pc.created_by=? OR pc.asesor_id=?)"}
       LIMIT 1`,
      canAll ? [Number(rawId)] : [Number(rawId), user.id, user.id]
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ message: "Cita no encontrada." }, { status: 404 });
    return NextResponse.json({
      appointment: {
        id: row.id,
        centroNombre: row.centro_nombre,
        tallerNombre: row.taller_nombre || "",
        clienteNombre: String(row.cliente_nombre || "").trim(),
        email: row.email || "",
        celular: row.celular || "",
        documento: row.identificacion_fiscal || "",
        vehiculoNombre: [row.modelo_nombre, row.marca_nombre].filter(Boolean).join(" - ") || row.placas || row.vin || "-",
        placa: row.placas || "",
        vin: row.vin || "",
        anio: row.anio || "",
        color: row.color || "",
        asesorNombre: row.asesor_nombre || "Sin asesor",
        origenNombre: row.origen_nombre || "",
        oportunidadId: row.oportunidadespv_id,
        oportunidadCodigo: row.oportunidad_codigo || "",
        startDate: datePart(row.start_at),
        startTime: timePart(row.start_at),
        endDate: datePart(row.end_at),
        endTime: timePart(row.end_at),
        estado: row.estado || "pendiente",
        tipoServicio: row.tipo_servicio,
        notaCliente: row.nota_cliente || "",
        notaInterna: row.nota_interna || "",
        creadoPorNombre: row.creado_por_nombre || "",
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    console.error("Error loading postventa appointment:", error);
    return NextResponse.json({ message: "No se pudo cargar la cita de PostVenta." }, { status: 500 });
  }
}
