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

function dateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const clean = String(value).trim();
  return clean ? clean.slice(0, 10) : null;
}

async function loadMaps(connection) {
  const [clients] = await connection.query(`SELECT id, id_lead, identificacion_fiscal FROM administracion_clientes`);
  const [brands] = await connection.query(`SELECT id, name FROM administracion_marcas`);
  const [models] = await connection.query(`SELECT id, marca_id, name FROM administracion_modelos`);
  return {
    clientsByDocument: new Map(clients.filter((row) => row.identificacion_fiscal).map((row) => [normalize(row.identificacion_fiscal), row.id])),
    clientsByLead: new Map(clients.filter((row) => row.id_lead).map((row) => [normalize(row.id_lead), row.id])),
    brands: new Map(brands.map((row) => [normalize(row.name), row.id])),
    models: new Map(models.map((row) => [`${row.marca_id}:${normalize(row.name)}`, row.id])),
  };
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    if (!hasPerm(user.permissions || {}, ["clientes", "vehicles_import"])) {
      return NextResponse.json({ message: "No tienes permiso para importar vehiculos." }, { status: 403 });
    }

    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });

    const maps = await loadMaps(connection);
    let imported = 0;
    let updated = 0;
    const errors = [];

    await connection.beginTransaction();

    for (const [index, row] of rows.entries()) {
      const clienteDocumento = text(row.cliente_documento ?? row.clienteDocumento ?? row.documento);
      const clienteLead = text(row.cliente_id_lead ?? row.clienteIdLead ?? row.id_lead);
      const placas = text(row.placas ?? row.placa);
      const vin = text(row.vin ?? row.VIN);
      const marca = text(row.marca);
      const modelo = text(row.modelo);

      const clienteId = clienteDocumento ? maps.clientsByDocument.get(normalize(clienteDocumento)) : (clienteLead ? maps.clientsByLead.get(normalize(clienteLead)) : null);
      const marcaId = marca ? maps.brands.get(normalize(marca)) : null;
      const modeloId = marcaId && modelo ? maps.models.get(`${marcaId}:${normalize(modelo)}`) : null;

      if (!clienteId) {
        errors.push(`Fila ${index + 2}: cliente no encontrado por documento o id_lead.`);
        continue;
      }
      if (!placas) {
        errors.push(`Fila ${index + 2}: placas es obligatorio.`);
        continue;
      }
      if (marca && !marcaId) {
        errors.push(`Fila ${index + 2}: marca no encontrada.`);
        continue;
      }
      if (modelo && !modeloId) {
        errors.push(`Fila ${index + 2}: modelo no encontrado para la marca.`);
        continue;
      }

      let existingId = null;
      if (vin) {
        const [[existing]] = await connection.query(`SELECT id FROM administracion_vehiculos WHERE vin=? AND deleted_at IS NULL LIMIT 1`, [vin]);
        existingId = existing?.id || null;
      }
      if (!existingId) {
        const [[existing]] = await connection.query(`SELECT id FROM administracion_vehiculos WHERE cliente_id=? AND placas=? AND deleted_at IS NULL LIMIT 1`, [clienteId, placas]);
        existingId = existing?.id || null;
      }

      const values = [
        clienteId,
        placas,
        vin,
        marcaId || null,
        modeloId || null,
        numberValue(row.anio),
        text(row.color),
        numberValue(row.kilometraje),
        dateValue(row.fecha_ultima_visita ?? row.fechaUltimaVisita),
      ];

      if (existingId) {
        await connection.query(
          `UPDATE administracion_vehiculos
           SET cliente_id=?, placas=?, vin=?, marca_id=?, modelo_id=?, anio=?, color=?, kilometraje=?, fecha_ultima_visita=?
           WHERE id=?`,
          [...values, existingId]
        );
        updated += 1;
      } else {
        await connection.query(
          `INSERT INTO administracion_vehiculos
           (cliente_id, placas, vin, marca_id, modelo_id, anio, color, kilometraje, fecha_ultima_visita, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE())`,
          values
        );
      }
      imported += 1;
    }

    if (!imported) {
      await connection.rollback();
      return NextResponse.json({ message: errors[0] || "No se pudo importar vehiculos." }, { status: 400 });
    }

    await connection.commit();
    return NextResponse.json({ ok: true, imported, updated, errors });
  } catch (error) {
    await connection.rollback();
    console.error("Error importing vehicles:", error);
    return NextResponse.json({ message: "No se pudo importar vehiculos." }, { status: 500 });
  } finally {
    connection.release();
  }
}
