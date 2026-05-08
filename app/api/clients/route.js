import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapClient(row) {
  return {
    id: row.id,
    nombre: row.nombre || "",
    apellido: row.apellido || "",
    email: row.email || "",
    celular: row.celular || "",
    tipoIdentificacion: row.tipo_identificacion || "",
    identificacionFiscal: row.identificacion_fiscal || "",
    fechaNacimiento: row.fecha_nacimiento || "",
    ocupacion: row.ocupacion || "",
    domicilio: row.domicilio || "",
    departamentoId: row.departamento_id,
    provinciaId: row.provincia_id,
    distritoId: row.distrito_id,
    nombreConyugue: row.nombreconyugue || "",
    dniConyugue: row.dniconyugue || "",
    nombreComercial: row.nombre_comercial || "",
    createdAt: row.created_at,
    vehicles: [],
  };
}

function mapVehicle(row) {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    placas: row.placas || "",
    vin: row.vin || "",
    marcaId: row.marca_id,
    marcaName: row.marca_name || "",
    modeloId: row.modelo_id,
    modeloName: row.modelo_name || "",
    claseId: row.clase_id,
    claseName: row.clase_name || "",
    anio: row.anio,
    color: row.color || "",
    kilometraje: row.kilometraje,
    fechaUltimaVisita: row.fecha_ultima_visita || "",
    createdAt: row.created_at,
  };
}

async function loadOptions() {
  const [departamentosRows] = await pool.query(
    `SELECT id, nombre, codigo_ubigeo FROM departamentos ORDER BY nombre ASC`
  );
  const [provinciasRows] = await pool.query(
    `SELECT id, nombre, departamento_id, codigo_ubigeo FROM provincias ORDER BY nombre ASC`
  );
  const [distritosRows] = await pool.query(
    `SELECT id, nombre, provincia_id, departamento_id, codigo_ubigeo FROM distritos ORDER BY nombre ASC`
  );
  const [marcasRows] = await pool.query(
    `SELECT id, name, image_url FROM administracion_marcas ORDER BY name ASC`
  );
  const [clasesRows] = await pool.query(
    `SELECT id, name FROM administracion_clases ORDER BY name ASC`
  );
  const [modelosRows] = await pool.query(
    `SELECT id, marca_id, clase_id, name, anios FROM administracion_modelos ORDER BY name ASC`
  );

  return {
    departamentos: departamentosRows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      codigoUbigeo: row.codigo_ubigeo,
    })),
    provincias: provinciasRows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      departamentoId: row.departamento_id,
      codigoUbigeo: row.codigo_ubigeo,
    })),
    distritos: distritosRows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      provinciaId: row.provincia_id,
      departamentoId: row.departamento_id,
      codigoUbigeo: row.codigo_ubigeo,
    })),
    marcas: marcasRows.map((row) => ({
      id: row.id,
      name: row.name,
      imageUrl: row.image_url || "",
    })),
    clases: clasesRows.map((row) => ({
      id: row.id,
      name: row.name,
    })),
    modelos: modelosRows.map((row) => ({
      id: row.id,
      marcaId: row.marca_id,
      claseId: row.clase_id,
      name: row.name,
      anios: row.anios ? JSON.parse(row.anios) : [],
    })),
  };
}

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

export async function GET() {
  try {
    const [clientRows] = await pool.query(
      `SELECT id, nombre, apellido, email, celular, tipo_identificacion,
              identificacion_fiscal, fecha_nacimiento, ocupacion, domicilio,
              departamento_id, provincia_id, distrito_id, nombreconyugue,
              dniconyugue, nombre_comercial, created_at
       FROM administracion_clientes
       ORDER BY id DESC`
    );
    const [vehicleRows] = await pool.query(
      `SELECT v.id, v.cliente_id, v.placas, v.vin, v.marca_id, v.modelo_id,
              v.anio, v.color, v.kilometraje, v.fecha_ultima_visita, v.created_at,
              ma.name AS marca_name, mo.name AS modelo_name,
              mo.clase_id, cl.name AS clase_name
       FROM administracion_vehiculos v
       LEFT JOIN administracion_marcas ma ON ma.id = v.marca_id
       LEFT JOIN administracion_modelos mo ON mo.id = v.modelo_id
       LEFT JOIN administracion_clases cl ON cl.id = mo.clase_id
       WHERE v.deleted_at IS NULL
       ORDER BY v.id DESC`
    );
    const clients = clientRows.map(mapClient);
    const byId = new Map(clients.map((client) => [client.id, client]));

    vehicleRows.map(mapVehicle).forEach((vehicle) => {
      byId.get(vehicle.clienteId)?.vehicles.push(vehicle);
    });

    const options = await loadOptions();

    return NextResponse.json({ clients, options });
  } catch (error) {
    console.error("Error loading clients:", error);

    return NextResponse.json(
      { message: "No se pudieron cargar los clientes." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const payload = normalizeClient(await request.json());

    if (!payload.nombre && !payload.nombreComercial) {
      return NextResponse.json(
        { message: "Ingresa nombre o nombre comercial." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO administracion_clientes
       (nombre, apellido, email, celular, tipo_identificacion, identificacion_fiscal,
        fecha_nacimiento, ocupacion, domicilio, departamento_id, provincia_id,
        distrito_id, nombreconyugue, dniconyugue, nombre_comercial, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE())`,
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
      ]
    );

    return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);

    return NextResponse.json(
      { message: "No se pudo crear el cliente." },
      { status: 500 }
    );
  }
}
