import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function text(value) {
  const clean = String(value ?? "").trim();
  return clean ? clean : null;
}

function dateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const clean = String(value).trim();
  return clean ? clean.slice(0, 10) : null;
}

function phoneValue(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("51") && digits.length > 9 ? `+${digits}` : `+51${digits.slice(-9)}`;
}

async function loadLocationMaps(connection) {
  const [departamentos] = await connection.query(`SELECT id, nombre FROM departamentos`);
  const [provincias] = await connection.query(`SELECT id, nombre, departamento_id FROM provincias`);
  const [distritos] = await connection.query(`SELECT id, nombre, provincia_id, departamento_id FROM distritos`);
  return {
    departamentos: new Map(departamentos.map((row) => [normalize(row.nombre), row.id])),
    provincias: new Map(provincias.map((row) => [`${row.departamento_id}:${normalize(row.nombre)}`, row.id])),
    distritos: new Map(distritos.map((row) => [`${row.departamento_id}:${row.provincia_id}:${normalize(row.nombre)}`, row.id])),
  };
}

async function loadUserMap(connection) {
  const [users] = await connection.query(`SELECT id, fullname, username, email FROM administracion_usuarios`);
  const map = new Map();
  users.forEach((row) => {
    [row.fullname, row.username, row.email].filter(Boolean).forEach((value) => {
      map.set(normalize(value), row.id);
    });
  });
  return map;
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    if (!hasPerm(user.permissions || {}, ["clientes", "import"])) {
      return NextResponse.json({ message: "No tienes permiso para importar clientes." }, { status: 403 });
    }

    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });

    const maps = await loadLocationMaps(connection);
    const users = await loadUserMap(connection);
    let imported = 0;
    let updated = 0;
    const errors = [];
    await connection.beginTransaction();

    for (const [index, row] of rows.entries()) {
      const nombre = text(row.nombre);
      const apellido = text(row.apellido);
      const nombreComercial = text(row.nombre_comercial ?? row.nombreComercial);
      const identificacionFiscal = text(row.identificacion_fiscal ?? row.identificacionFiscal ?? row.documento);
      const tipoIdentificacion = text(row.tipo_identificacion ?? row.tipoIdentificacion) || "DNI";
      const departamento = text(row.departamento);
      const provincia = text(row.provincia);
      const distrito = text(row.distrito);
      const createdByText = text(row.created_by ?? row.createdBy ?? row.creado_por ?? row.creadoPor);

      const departamentoId = departamento ? maps.departamentos.get(normalize(departamento)) : null;
      const provinciaId = provincia ? maps.provincias.get(`${departamentoId}:${normalize(provincia)}`) : null;
      const distritoId = distrito ? maps.distritos.get(`${departamentoId}:${provinciaId}:${normalize(distrito)}`) : null;
      const createdBy = createdByText ? users.get(normalize(createdByText)) : user.id;

      if (!nombre && !nombreComercial) {
        errors.push(`Fila ${index + 2}: nombre o nombre_comercial es obligatorio.`);
        continue;
      }
      if (departamento && !departamentoId) errors.push(`Fila ${index + 2}: departamento no encontrado.`);
      if (provincia && !provinciaId) errors.push(`Fila ${index + 2}: provincia no encontrada para el departamento.`);
      if (distrito && !distritoId) errors.push(`Fila ${index + 2}: distrito no encontrado para departamento/provincia.`);
      if (createdByText && !createdBy) errors.push(`Fila ${index + 2}: created_by no coincide con ningun usuario.`);
      if (errors.length && errors[errors.length - 1].startsWith(`Fila ${index + 2}:`)) continue;

      const values = [
        text(row.id_lead ?? row.idLead),
        nombre,
        apellido,
        text(row.email),
        phoneValue(row.celular),
        tipoIdentificacion,
        identificacionFiscal,
        dateValue(row.fecha_nacimiento ?? row.fechaNacimiento),
        text(row.ocupacion),
        text(row.domicilio),
        departamentoId || null,
        provinciaId || null,
        distritoId || null,
        text(row.nombre_conyugue ?? row.nombreConyugue),
        text(row.dni_conyugue ?? row.dniConyugue),
        nombreComercial,
      ];

      let existingId = null;
      if (identificacionFiscal) {
        const [[existing]] = await connection.query(`SELECT id FROM administracion_clientes WHERE identificacion_fiscal = ? LIMIT 1`, [identificacionFiscal]);
        existingId = existing?.id || null;
      }

      if (existingId) {
        await connection.query(
          `UPDATE administracion_clientes
           SET id_lead=?, nombre=?, apellido=?, email=?, celular=?, tipo_identificacion=?, identificacion_fiscal=?,
               fecha_nacimiento=?, ocupacion=?, domicilio=?, departamento_id=?, provincia_id=?, distrito_id=?,
               nombreconyugue=?, dniconyugue=?, nombre_comercial=?, created_by=?
           WHERE id=?`,
          [...values, createdBy, existingId]
        );
        updated += 1;
      } else {
        await connection.query(
          `INSERT INTO administracion_clientes
           (id_lead, nombre, apellido, email, celular, tipo_identificacion, identificacion_fiscal,
            fecha_nacimiento, ocupacion, domicilio, departamento_id, provincia_id, distrito_id,
            nombreconyugue, dniconyugue, nombre_comercial, created_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE(), ?)`,
          [...values, createdBy]
        );
      }
      imported += 1;
    }

    if (!imported) {
      await connection.rollback();
      return NextResponse.json({ message: errors[0] || "No se pudo importar clientes." }, { status: 400 });
    }

    await connection.commit();
    return NextResponse.json({ ok: true, imported, updated, errors });
  } catch (error) {
    await connection.rollback();
    console.error("Error importing clients:", error);
    return NextResponse.json({ message: "No se pudo importar clientes." }, { status: 500 });
  } finally {
    connection.release();
  }
}
