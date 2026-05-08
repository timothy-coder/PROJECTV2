import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function normalizeClient(body) {
  return {
    nombre: String(body.nombre || "").trim() || null,
    apellido: String(body.apellido || "").trim() || null,
    email: String(body.email || "").trim() || null,
    celular: String(body.celular || "").trim() || null,
    tipoIdentificacion: body.tipoIdentificacion || null,
    identificacionFiscal: String(body.identificacionFiscal || "").trim() || null,
    fechaNacimiento: body.fechaNacimiento || null,
    ocupacion: String(body.ocupacion || "").trim() || null,
    domicilio: String(body.domicilio || "").trim() || null,
    departamentoId: body.departamentoId ? Number(body.departamentoId) : null,
    provinciaId: body.provinciaId ? Number(body.provinciaId) : null,
    distritoId: body.distritoId ? Number(body.distritoId) : null,
    nombreConyugue: String(body.nombreConyugue || "").trim() || null,
    dniConyugue: String(body.dniConyugue || "").trim() || null,
    nombreComercial: String(body.nombreComercial || "").trim() || null,
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

    const [result] = await pool.query(
      `UPDATE administracion_clientes
       SET nombre = ?, apellido = ?, email = ?, celular = ?,
           tipo_identificacion = ?, identificacion_fiscal = ?,
           fecha_nacimiento = ?, ocupacion = ?, domicilio = ?,
           departamento_id = ?, provincia_id = ?, distrito_id = ?,
           nombreconyugue = ?, dniconyugue = ?, nombre_comercial = ?
       WHERE id = ?`,
      [
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
        id,
      ]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ message: "Cliente no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating client:", error);

    return NextResponse.json(
      { message: "No se pudo actualizar el cliente." },
      { status: 500 }
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
