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
    if (!hasPerm(user.permissions || {}, ["clientes", "maintenance_import"])) {
      return NextResponse.json({ message: "No tienes permiso para importar mantenimientos." }, { status: 403 });
    }

    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });

    const users = await loadUserMap(connection);
    let imported = 0;
    const errors = [];

    await connection.beginTransaction();

    for (const [index, row] of rows.entries()) {
      const vin = text(row.vin ?? row.VIN);
      const placas = text(row.placas ?? row.placa);
      const fechaVisita = dateTimeValue(row.fecha_visita_taller ?? row.fechaVisitaTaller ?? row.fecha);
      const createdByText = text(row.created_by ?? row.createdBy ?? row.creado_por ?? row.creadoPor);
      const createdBy = createdByText ? users.get(normalize(createdByText)) : user.id;

      if (!vin && !placas) {
        errors.push(`Fila ${index + 2}: vin o placas es obligatorio.`);
        continue;
      }
      if (!fechaVisita) {
        errors.push(`Fila ${index + 2}: fecha_visita_taller es obligatorio.`);
        continue;
      }
      if (createdByText && !createdBy) {
        errors.push(`Fila ${index + 2}: created_by no coincide con ningun usuario.`);
        continue;
      }

      const [[vehicle]] = vin
        ? await connection.query(`SELECT id FROM administracion_vehiculos WHERE vin=? AND deleted_at IS NULL LIMIT 1`, [vin])
        : await connection.query(`SELECT id FROM administracion_vehiculos WHERE placas=? AND deleted_at IS NULL LIMIT 1`, [placas]);

      if (!vehicle?.id) {
        errors.push(`Fila ${index + 2}: vehiculo no encontrado.`);
        continue;
      }

      await connection.query(
        `INSERT INTO administracion_vehiculos_historial_mantenimientos
         (vehiculo_id, fecha_visita_taller, kilometraje_taller, created_by)
         VALUES (?, ?, ?, ?)`,
        [
          vehicle.id,
          fechaVisita,
          numberValue(row.kilometraje_taller ?? row.kilometrajeTaller ?? row.kilometraje),
          createdBy,
        ]
      );
      imported += 1;
    }

    if (!imported) {
      await connection.rollback();
      return NextResponse.json({ message: errors[0] || "No se pudo importar mantenimientos." }, { status: 400 });
    }

    await connection.commit();
    return NextResponse.json({ ok: true, imported, updated: 0, errors });
  } catch (error) {
    await connection.rollback();
    console.error("Error importing vehicle maintenance:", error);
    return NextResponse.json({ message: "No se pudo importar mantenimientos." }, { status: 500 });
  } finally {
    connection.release();
  }
}
