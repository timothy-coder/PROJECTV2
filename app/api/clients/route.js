import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function mapClient(row) {
  return {
    id: row.id,
    idLead: row.id_lead || "",
    createdBy: row.created_by,
    createdByName: row.created_by_name || "",
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
  const [usersRows] = await pool.query(
    `SELECT id, fullname, username
     FROM administracion_usuarios
     WHERE is_active=1
     ORDER BY fullname ASC, username ASC`
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
    users: usersRows.map((row) => ({
      id: row.id,
      name: row.fullname || row.username || `Usuario ${row.id}`,
    })),
  };
}

function normalizeClient(body) {
  return {
    idLead: String(body.idLead || "").trim() || null,
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

function duplicateReasons(payload, row) {
  const reasons = [];
  if (payload.identificacionFiscal && payload.identificacionFiscal === row.identificacion_fiscal) reasons.push(`documento ${payload.identificacionFiscal}`);
  if (payload.idLead && payload.idLead === row.id_lead) reasons.push(`ID Lead ${payload.idLead}`);
  if (payload.celular && payload.celular === row.celular) reasons.push(`celular ${payload.celular}`);
  if (payload.email && payload.email.toLowerCase() === String(row.email || "").toLowerCase()) reasons.push(`email ${payload.email}`);
  return reasons;
}

async function findDuplicateClient(payload, excludeId = null) {
  const checks = [
    ["identificacion_fiscal = ?", payload.identificacionFiscal],
    ["id_lead = ?", payload.idLead],
    ["celular = ?", payload.celular],
    ["LOWER(email) = LOWER(?)", payload.email],
  ].filter(([, value]) => value);
  if (!checks.length) return null;

  const where = checks.map(([clause]) => clause);
  const values = checks.map(([, value]) => value);
  if (excludeId) values.push(excludeId);

  const [rows] = await pool.query(
    `SELECT c.id, c.id_lead, c.nombre, c.apellido, c.email, c.celular, c.identificacion_fiscal,
            COALESCE(u.fullname, u.username, CONCAT('Usuario ', c.created_by)) AS created_by_name
     FROM administracion_clientes c
     LEFT JOIN administracion_usuarios u ON u.id = c.created_by
     WHERE (${where.join(" OR ")}) ${excludeId ? "AND c.id <> ?" : ""}
     ORDER BY c.id DESC
     LIMIT 1`,
    values
  );
  const duplicate = rows[0];
  if (!duplicate) return null;
  const reasons = duplicateReasons(payload, duplicate);
  const owner = duplicate.created_by_name || "usuario no identificado";
  const clientName = [duplicate.nombre, duplicate.apellido].filter(Boolean).join(" ") || `cliente #${duplicate.id}`;
  return {
    duplicate,
    reasons,
    message: `El cliente ya esta registrado por ${owner}. Motivo: ${reasons.join(", ") || "datos duplicados"}. Cliente: ${clientName}.`,
  };
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    }

    const userPermissions = user?.permissions || {};
    const canViewAll = hasPerm(userPermissions, ["clientes", "viewall"]);
    const { searchParams } = new URL(request.url);
    const requestedPage = Number(searchParams.get("page"));
    const requestedLimit = Number(searchParams.get("limit"));
    const isPaginated = Number.isFinite(requestedPage) && requestedPage > 0 && Number.isFinite(requestedLimit) && requestedLimit > 0;
    const page = isPaginated ? Math.max(1, Math.floor(requestedPage)) : 1;
    const limit = isPaginated ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : null;
    const offset = isPaginated ? (page - 1) * limit : 0;
    const q = String(searchParams.get("q") || "").trim();

    const where = [];
    const params = [];
    if (!canViewAll) {
      where.push("c.created_by = ?");
      params.push(user.id);
    }
    if (q) {
      const like = `%${q}%`;
      where.push(`(
        c.nombre LIKE ? OR c.apellido LIKE ? OR c.nombre_comercial LIKE ? OR
        c.id_lead LIKE ? OR c.identificacion_fiscal LIKE ? OR c.celular LIKE ? OR
        c.email LIKE ? OR COALESCE(u.fullname, u.username) LIKE ?
      )`);
      params.push(like, like, like, like, like, like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[countRow]] = isPaginated
      ? await pool.query(
          `SELECT COUNT(*) AS total
           FROM administracion_clientes c
           LEFT JOIN administracion_usuarios u ON u.id = c.created_by
           ${whereSql}`,
          params
        )
      : [[{ total: 0 }]];

    const [clientRows] = await pool.query(
      `SELECT c.id, c.id_lead, c.nombre, c.apellido, c.email, c.celular, c.tipo_identificacion,
              identificacion_fiscal, fecha_nacimiento, ocupacion, domicilio,
              departamento_id, provincia_id, distrito_id, nombreconyugue,
              dniconyugue, nombre_comercial, c.created_at, c.created_by,
              COALESCE(u.fullname, u.username) AS created_by_name
       FROM administracion_clientes c
       LEFT JOIN administracion_usuarios u ON u.id = c.created_by
       ${whereSql}
       ORDER BY c.id DESC
       ${isPaginated ? "LIMIT ? OFFSET ?" : ""}`,
      isPaginated ? [...params, limit, offset] : params
    );
    const clients = clientRows.map(mapClient);
    const byId = new Map(clients.map((client) => [client.id, client]));
    const clientIds = clients.map((client) => client.id);
    const [vehicleRows] = clientIds.length
      ? await pool.query(
          `SELECT v.id, v.cliente_id, v.placas, v.vin, v.marca_id, v.modelo_id,
                  v.anio, v.color, v.kilometraje, v.fecha_ultima_visita, v.created_at,
                  ma.name AS marca_name, mo.name AS modelo_name,
                  mo.clase_id, cl.name AS clase_name
           FROM administracion_vehiculos v
           LEFT JOIN administracion_marcas ma ON ma.id = v.marca_id
           LEFT JOIN administracion_modelos mo ON mo.id = v.modelo_id
           LEFT JOIN administracion_clases cl ON cl.id = mo.clase_id
           WHERE v.deleted_at IS NULL AND v.cliente_id IN (?)
           ORDER BY v.id DESC`,
          [clientIds]
        )
      : [[]];

    vehicleRows.map(mapVehicle).forEach((vehicle) => {
      byId.get(vehicle.clienteId)?.vehicles.push(vehicle);
    });

    const options = await loadOptions();

    return NextResponse.json({
      clients,
      options,
      meta: {
        total: isPaginated ? Number(countRow.total || 0) : clients.length,
        page,
        limit: isPaginated ? limit : clients.length,
        paginated: isPaginated,
      },
    });
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    }

    const payload = normalizeClient(await request.json());

    if (!payload.nombre && !payload.nombreComercial) {
      return NextResponse.json(
        { message: "Ingresa nombre o nombre comercial." },
        { status: 400 }
      );
    }

    const duplicate = await findDuplicateClient(payload);
    if (duplicate) {
      return NextResponse.json(
        {
          message: duplicate.message,
          reason: duplicate.reasons.join(", "),
          createdByName: duplicate.duplicate.created_by_name || "",
          clientId: duplicate.duplicate.id,
        },
        { status: 409 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO administracion_clientes
       (id_lead, nombre, apellido, email, celular, tipo_identificacion, identificacion_fiscal,
        fecha_nacimiento, ocupacion, domicilio, departamento_id, provincia_id,
        distrito_id, nombreconyugue, dniconyugue, nombre_comercial, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE(), ?)`,
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
        user.id,
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
