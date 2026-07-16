import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function canSeeAll(user) {
  return Boolean(hasPerm(user.permissions, ["oportunidades", "viewall"]) || hasPerm(user.permissions, ["leads", "viewall"]) || hasPerm(user.permissions, ["agenda", "viewall"]));
}

function datePart(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = String(value);
  const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  return text.slice(0, 10);
}

function timePart(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  const text = String(value);
  return text.match(/\d{2}:\d{2}/)?.[0] || text.slice(0, 5);
}

function mapTestDriveSurvey(row) {
  return {
    id: row.id,
    testdriveId: row.testdrive_id,
    rutaErgonomia: Number(row.ruta_ergonomia || 0),
    rutaVisibilidad: Number(row.ruta_visibilidad || 0),
    rutaDinamica: Number(row.ruta_dinamica || 0),
    rutaSeguridad: Number(row.ruta_seguridad || 0),
    rutaConfort: Number(row.ruta_confort || 0),
    rutaTecnologia: Number(row.ruta_tecnologia || 0),
    feedbackSatisfaccion: row.feedback_satisfaccion || "",
    asesorExplico: row.asesor_explico || "",
    experienciaTestdrive: row.experiencia_testdrive || "",
    explicacionesDemostraciones: row.explicaciones_demostraciones || "",
    fordManejo: row.ford_manejo || "",
    estadoVehiculo: row.estado_vehiculo || "",
    autoSuficiente: row.auto_suficiente || "",
    realizaraCompra: row.realizara_compra || "",
    compraPlazo: row.compra_plazo || "",
  };
}

async function stageId(connection, name) {
  const [rows] = await connection.query(`SELECT id FROM ventas_etapasconversion WHERE LOWER(nombre)=LOWER(?) LIMIT 1`, [name]);
  return rows[0]?.id || null;
}

async function loadTestDriveConfig(connection) {
  try {
    const [rows] = await connection.query(
      `SELECT activar_pdf_testdrive, activar_ruta_testdrive, minutos_testdrive, habilitar_encuesta_en_vivo
       FROM configuracion_testdrive
       ORDER BY id ASC
       LIMIT 1`
    );
    const row = rows[0] || {};
    return {
      activarPdfTestdrive: row.activar_pdf_testdrive !== undefined ? Boolean(row.activar_pdf_testdrive) : true,
      activarRutaTestdrive: Boolean(row.activar_ruta_testdrive),
      minutosTestdrive: Number(row.minutos_testdrive || 0),
      habilitarEncuestaEnVivo: Boolean(row.habilitar_encuesta_en_vivo),
    };
  } catch {
    return { activarPdfTestdrive: true, activarRutaTestdrive: false, minutosTestdrive: 0, habilitarEncuestaEnVivo: false };
  }
}

async function maybeMoveToAttention(connection, opportunity, canAll) {
  const name = String(opportunity.etapa_nombre || "").toLowerCase();
  if (!["nuevo", "asignado"].includes(name)) return opportunity;
  const attentionId = await stageId(connection, "En Atención");
  if (!attentionId) return opportunity;
  await connection.query(`UPDATE ventas_oportunidades SET etapasconversion_id=? WHERE id=?`, [attentionId, opportunity.id]);
  opportunity.etapasconversion_id = attentionId;
  opportunity.etapa_nombre = "En Atención";
  return opportunity;
}

export async function GET(request, { params }) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const { id: rawId } = await params;
    const id = Number(rawId);
    const canAll = canSeeAll(user);
    const skipAutoAttention = request.nextUrl.searchParams.get("skipAutoAttention") === "1";
    const [rows] = await connection.query(
      `SELECT o.*, e.nombre AS etapa_nombre, e.color AS etapa_color, e.descripcion AS etapa_temp, e.sort_order,
              CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente_nombre,
              c.id AS cliente_id, c.id_lead, c.nombre AS cliente_nombre_raw, c.apellido AS cliente_apellido,
              c.email, c.celular, c.tipo_identificacion, c.identificacion_fiscal,
              c.fecha_nacimiento, c.ocupacion, c.domicilio, c.departamento_id, c.provincia_id,
              c.distrito_id, c.nombreconyugue, c.dniconyugue, c.nombre_comercial, c.created_by AS cliente_created_by,
              oc.name AS origen_nombre, so.name AS suborigen_nombre,
              au.fullname AS asignado_nombre, cu.fullname AS creado_nombre
       FROM ventas_oportunidades o
       INNER JOIN ventas_etapasconversion e ON e.id=o.etapasconversion_id
       INNER JOIN administracion_clientes c ON c.id=o.cliente_id
       INNER JOIN configuracion_origenes_citas oc ON oc.id=o.origen_id
       LEFT JOIN configuracion_suborigenes_citas so ON so.id=o.suborigen_id
       LEFT JOIN administracion_usuarios au ON au.id=o.asignado_a
       INNER JOIN administracion_usuarios cu ON cu.id=o.created_by
       WHERE o.id=? ${canAll ? "" : "AND (o.created_by=? OR o.asignado_a=?)"} LIMIT 1`,
      canAll ? [id] : [id, user.id, user.id]
    );
    let opportunity = rows[0];
    if (!opportunity) return NextResponse.json({ message: "No encontrada." }, { status: 404 });
    if (!skipAutoAttention) {
      opportunity = await maybeMoveToAttention(connection, opportunity, canAll);
    }
    const [stages] = await connection.query(`SELECT id,nombre,descripcion,color,sort_order FROM ventas_etapasconversion WHERE is_active=1 ORDER BY COALESCE(sort_order,id) ASC`);
    const [details] = await connection.query(`SELECT * FROM ventas_oportunidades_detalles WHERE oportunidad_padre_id=? ORDER BY created_at DESC`, [id]);
    const [activities] = await connection.query(`SELECT a.*, u.fullname AS user_name FROM ventas_oportunidades_actividades a INNER JOIN administracion_usuarios u ON u.id=a.created_by WHERE a.oportunidad_id=? ORDER BY a.created_at DESC`, [id]);
    const [brands] = await connection.query(`SELECT id,name FROM administracion_marcas ORDER BY name ASC`);
    const [models] = await connection.query(`SELECT id,marca_id,name FROM administracion_modelos ORDER BY name ASC`);
    const [prices] = await connection.query(`SELECT p.id,p.marca_id,p.modelo_id,p.version,p.precio_base,ma.name AS marca,mo.name AS modelo FROM ventas_precios p INNER JOIN administracion_marcas ma ON ma.id=p.marca_id INNER JOIN administracion_modelos mo ON mo.id=p.modelo_id ORDER BY ma.name,mo.name,p.version`);
    const [interest] = await connection.query(`SELECT v.*, ma.name AS marca, mo.name AS modelo FROM ventas_oportunidad_client_interest_vehicles v LEFT JOIN administracion_marcas ma ON ma.id=v.marca_id LEFT JOIN administracion_modelos mo ON mo.id=v.modelo_id WHERE v.client_id=? AND v.active=1 ORDER BY v.created_at DESC`, [opportunity.cliente_id]);
    const [quotes] = await connection.query(
      `SELECT q.*, p.version, p.precio_base AS catalogo_precio_base, p.marca_id, p.modelo_id, ma.name AS marca, mo.name AS modelo,
              ep.id AS enlace_id, ep.token, ep.vistas_totales,
              (SELECT COUNT(*) FROM ventas_cotizacion_vistas_historial vh WHERE vh.enlace_id = ep.id) AS vistas_historial
       FROM ventas_cotizaciones q
       INNER JOIN ventas_precios p ON p.id=q.precio_id
       INNER JOIN administracion_marcas ma ON ma.id=p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id=p.modelo_id
       LEFT JOIN ventas_cotizacion_enlaces_publicos ep ON ep.cotizacion_id=q.id
       WHERE q.oportunidad_id=? ORDER BY q.created_at DESC`,
      [id]
    );
    const enlaceIds = quotes.map((quote) => quote.enlace_id).filter(Boolean);
    const [quoteViews] = enlaceIds.length
      ? await connection.query(
        `SELECT enlace_id, fecha_hora, ip_address, user_agent
         FROM ventas_cotizacion_vistas_historial
         WHERE enlace_id IN (?)
         ORDER BY fecha_hora DESC`,
        [enlaceIds]
      )
      : [[]];
    const [testDrives] = await connection.query(`SELECT t.*, mo.name AS modelo FROM ventas_oportunidades_test_drives t LEFT JOIN administracion_modelos mo ON mo.id=t.modelo_id WHERE t.oportunidad_id=? ORDER BY t.created_at DESC`, [id]);
    const testDriveIds = testDrives.map((item) => item.id);
    const [testDriveSurveys] = testDriveIds.length
      ? await connection.query(
        `SELECT *
         FROM ventas_oportunidades_test_drive_encuestas
         WHERE testdrive_id IN (?)`,
        [testDriveIds]
      )
      : [[]];
    const surveyByTestDrive = new Map(testDriveSurveys.map((row) => [Number(row.testdrive_id), row]));
    const [closures] = await connection.query(`SELECT c.*, u.fullname AS user_name, cd.detalle AS clasificacion FROM ventas_oportunidades_cierres c INNER JOIN administracion_usuarios u ON u.id=c.created_by LEFT JOIN configuracion_ventas_cierres_detalle cd ON cd.id=c.cierre_detalle_id WHERE c.oportunidad_id=? ORDER BY c.created_at DESC`, [id]);
    const [reservations] = await connection.query(
      `SELECT r.id, r.estado, r.created_at, rd.tipo_persona
       FROM ventas_reservas r
       LEFT JOIN (
         SELECT reserva_id, MAX(tipo_persona) AS tipo_persona
         FROM ventas_reserva_detalles
         WHERE oportunidad_id=?
         GROUP BY reserva_id
       ) rd ON rd.reserva_id=r.id
       WHERE r.oportunidad_id=?
       ORDER BY r.created_at DESC`,
      [id, id]
    );
    const [closeOptions] = await connection.query(`SELECT id, detalle FROM configuracion_ventas_cierres_detalle ORDER BY id DESC`);
    const [accessories] = await connection.query(`SELECT id, marca_id, modelo_id, detalle, numero_parte, precio, precio_venta, moneda_id FROM ventas_accesorios_disponibles ORDER BY detalle ASC`);
    const [gifts] = await connection.query(`SELECT id, detalle, lote, precio_compra, precio_venta, moneda_id FROM ventas_regalos_disponibles ORDER BY detalle ASC`);
    const [departamentos] = await connection.query(`SELECT id, nombre, codigo_ubigeo FROM departamentos ORDER BY nombre ASC`);
    const [provincias] = await connection.query(`SELECT id, nombre, departamento_id, codigo_ubigeo FROM provincias ORDER BY nombre ASC`);
    const [distritos] = await connection.query(`SELECT id, nombre, provincia_id, departamento_id, codigo_ubigeo FROM distritos ORDER BY nombre ASC`);
    const [users] = await connection.query(`SELECT id, fullname, username FROM administracion_usuarios WHERE is_active=1 ORDER BY fullname ASC, username ASC`);
    const testdriveConfig = await loadTestDriveConfig(connection);
    return NextResponse.json({
      currentUser: { id: user.id, fullname: user.fullname, canViewAll: canAll, permissions: user.permissions || {} },
      opportunity: {
        id: opportunity.id,
        code: opportunity.oportunidad_id,
        createdAt: opportunity.created_at,
        clienteId: opportunity.cliente_id,
        clienteNombre: opportunity.cliente_nombre.trim(),
        email: opportunity.email || "",
        celular: opportunity.celular || "",
        telefono: "",
        dni: opportunity.identificacion_fiscal || "",
        origenNombre: opportunity.origen_nombre,
        suborigenNombre: opportunity.suborigen_nombre || "",
        etapaId: opportunity.etapasconversion_id,
        etapaNombre: opportunity.etapa_nombre,
        etapaColor: opportunity.etapa_color || "#2563eb",
        asignadoNombre: opportunity.asignado_nombre || "No asignado",
        creadoNombre: opportunity.creado_nombre,
      },
      client: {
        id: opportunity.cliente_id,
        idLead: opportunity.id_lead || "",
        nombre: opportunity.cliente_nombre_raw || "",
        apellido: opportunity.cliente_apellido || "",
        email: opportunity.email || "",
        celular: opportunity.celular || "",
        tipoIdentificacion: opportunity.tipo_identificacion || "DNI",
        identificacionFiscal: opportunity.identificacion_fiscal || "",
        fechaNacimiento: datePart(opportunity.fecha_nacimiento),
        ocupacion: opportunity.ocupacion || "",
        domicilio: opportunity.domicilio || "",
        departamentoId: opportunity.departamento_id,
        provinciaId: opportunity.provincia_id,
        distritoId: opportunity.distrito_id,
        nombreConyugue: opportunity.nombreconyugue || "",
        dniConyugue: opportunity.dniconyugue || "",
        nombreComercial: opportunity.nombre_comercial || "",
        createdBy: opportunity.cliente_created_by,
      },
      stages: stages.map((s) => ({ id: s.id, nombre: s.nombre, temp: Number(s.descripcion || 0), color: s.color || "#2563eb", sortOrder: s.sort_order || s.id })),
      details: details.map((d) => ({ id: d.id, fechaAgenda: datePart(d.fecha_agenda), horaAgenda: timePart(d.hora_agenda), createdAt: d.created_at })),
      activities: activities.map((a) => ({ id: a.id, detalle: a.detalle || "", userName: a.user_name, createdAt: a.created_at })),
      interest,
      quotes: quotes.map((q) => ({
        ...q,
        number: `Q-${String(q.id).padStart(6, "0")}`,
        publicUrl: q.token ? `/cotizacion/${q.token}` : "",
        totalViews: Number(q.vistas_totales || q.vistas_historial || 0),
        viewHistory: quoteViews
          .filter((view) => Number(view.enlace_id) === Number(q.enlace_id))
          .map((view) => ({
            fechaHora: view.fecha_hora,
            ipAddress: view.ip_address || "",
            userAgent: view.user_agent || "",
          })),
      })),
      testDrives: testDrives.map((row) => ({
        ...row,
        fechaTestdrive: datePart(row.fecha_testdrive),
        horaInicio: timePart(row.hora_inicio),
        horaFin: timePart(row.hora_fin),
        inicioPruebaAt: row.inicio_prueba_at,
        conductorNombre: row.conductor_nombre || "",
        conductorRegistro: row.conductor_registro || "",
        certificadoVehiculo: row.certificado_vehiculo || "",
        certificadoLocal: row.certificado_local || "",
        certificadoGeneradoAt: row.certificado_generado_at,
        rutaTestdrive: row.ruta_testdrive || "",
        rutaInicioAt: row.ruta_inicio_at,
        rutaFinAt: row.ruta_fin_at,
        survey: surveyByTestDrive.has(Number(row.id)) ? mapTestDriveSurvey(surveyByTestDrive.get(Number(row.id))) : null,
      })),
      closures,
      reservations: reservations.map((row) => ({ id: row.id, estado: row.estado || "borrador", createdAt: row.created_at, tipoPersona: row.tipo_persona || "" })),
      options: {
        brands,
        models,
        prices,
        closeOptions,
        accessories,
        gifts,
        departamentos: departamentos.map((row) => ({ id: row.id, nombre: row.nombre, codigoUbigeo: row.codigo_ubigeo })),
        provincias: provincias.map((row) => ({ id: row.id, nombre: row.nombre, departamentoId: row.departamento_id, codigoUbigeo: row.codigo_ubigeo })),
        distritos: distritos.map((row) => ({ id: row.id, nombre: row.nombre, provinciaId: row.provincia_id, departamentoId: row.departamento_id, codigoUbigeo: row.codigo_ubigeo })),
        users: users.map((row) => ({ id: row.id, name: row.fullname || row.username || `Usuario ${row.id}` })),
        testdriveConfig,
      },
    });
  } catch (error) {
    console.error("Error loading opportunity detail:", error);
    return NextResponse.json({ message: "No se pudo cargar el detalle." }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function POST(request, { params }) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    let responsePayload = { ok: true };
    await connection.beginTransaction();
    if (body.action === "stage") {
      await connection.query(`UPDATE ventas_oportunidades SET etapasconversion_id=? WHERE id=?`, [Number(body.etapaId), id]);
    }
    if (body.action === "activity") {
      const [[op]] = await connection.query(`SELECT etapasconversion_id FROM ventas_oportunidades WHERE id=?`, [id]);
      await connection.query(`INSERT INTO ventas_oportunidades_actividades (oportunidad_id, etapasconversion_id, detalle, created_by) VALUES (?, ?, ?, ?)`, [id, op.etapasconversion_id, body.detalle, user.id]);
    }
    if (body.action === "agenda") {
      if (!body.fechaAgenda || !body.horaAgenda) {
        await connection.rollback();
        return NextResponse.json({ message: "Completa fecha y hora de agenda." }, { status: 400 });
      }
      await connection.query(
        `INSERT INTO ventas_oportunidades_detalles (oportunidad_padre_id, fecha_agenda, hora_agenda, oportunidad_id) VALUES (?, ?, ?, ?)`,
        [id, body.fechaAgenda, body.horaAgenda, id]
      );
    }
    if (body.action === "interest") {
      if (body.deleteId) await connection.query(`UPDATE ventas_oportunidad_client_interest_vehicles SET active=0, updated_at=NOW() WHERE id=?`, [Number(body.deleteId)]);
      else if (body.id) await connection.query(`UPDATE ventas_oportunidad_client_interest_vehicles SET marca_id=?, modelo_id=?, anio_interes=?, updated_at=NOW() WHERE id=?`, [body.marcaId || null, body.modeloId || null, body.anioInteres || null, Number(body.id)]);
      else await connection.query(`INSERT INTO ventas_oportunidad_client_interest_vehicles (client_id, marca_id, modelo_id, anio_interes, source, active, created_at, updated_at) VALUES (?, ?, ?, ?, 'oportunidad', 1, NOW(), NOW())`, [Number(body.clientId), body.marcaId || null, body.modeloId || null, body.anioInteres || null]);
    }
    if (body.action === "quote") {
      const [[catalogPrice]] = await connection.query(`SELECT precio_base FROM ventas_precios WHERE id=? LIMIT 1`, [Number(body.precioId)]);
      const quotePrice = body.precioBase !== undefined && body.precioBase !== "" ? Number(body.precioBase) : Number(catalogPrice?.precio_base || 0);
      const quoteTc = body.tcReferencial !== undefined && body.tcReferencial !== "" ? Number(body.tcReferencial) : null;
      if (body.id) {
        await connection.query(
          `UPDATE ventas_cotizaciones SET precio_id=?, precio_base=?, anio=?, sku=?, color_externo=?, color_interno=?, tc_referencial=?, descuento_vehículo=?, descuento_vehículo_porcentaje=? WHERE id=? AND oportunidad_id=?`,
          [Number(body.precioId), quotePrice, body.anio || null, body.sku || null, body.colorExterno || null, body.colorInterno || null, quoteTc, body.descuentoVehiculo || 0, body.descuentoVehiculoPorcentaje || 0, Number(body.id), id]
        );
      } else {
        await connection.query(`INSERT INTO ventas_cotizaciones (oportunidad_id, precio_id, precio_base, anio, sku, color_externo, color_interno, tc_referencial, descuento_vehículo, descuento_vehículo_porcentaje, estado, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?)`, [id, Number(body.precioId), quotePrice, body.anio || null, body.sku || null, body.colorExterno || null, body.colorInterno || null, quoteTc, body.descuentoVehiculo || 0, body.descuentoVehiculoPorcentaje || 0, user.id]);
      }
      const cotId = await stageId(connection, "Cotización");
      if (cotId) await connection.query(`UPDATE ventas_oportunidades SET etapasconversion_id=? WHERE id=?`, [cotId, id]);
    }
    if (body.action === "quote-public-link") {
      const [[existing]] = await connection.query(`SELECT id FROM ventas_cotizacion_enlaces_publicos WHERE cotizacion_id=? LIMIT 1`, [Number(body.cotizacionId)]);
      if (!existing) await connection.query(`INSERT INTO ventas_cotizacion_enlaces_publicos (cotizacion_id, token, vistas_totales) VALUES (?, ?, 0)`, [Number(body.cotizacionId), randomUUID()]);
    }
    if (body.action === "quote-cancel") {
      await connection.query(`UPDATE ventas_cotizaciones SET estado='cancelado' WHERE id=?`, [Number(body.cotizacionId)]);
    }
    if (body.action === "quote-duplicate") {
      const [[quote]] = await connection.query(`SELECT * FROM ventas_cotizaciones WHERE id=?`, [Number(body.cotizacionId)]);
      if (quote) {
        const [duplicated] = await connection.query(
          `INSERT INTO ventas_cotizaciones (oportunidad_id, precio_id, precio_base, anio, sku, color_externo, color_interno, tc_referencial, descuento_vehículo, descuento_vehículo_porcentaje, estado, descuento_total_accesorios, descuento_total_regalos, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?, ?, ?)`,
          [quote.oportunidad_id, quote.precio_id, quote.precio_base, quote.anio, quote.sku, quote.color_externo, quote.color_interno, quote.tc_referencial, quote.descuento_vehículo, quote.descuento_vehículo_porcentaje, quote.descuento_total_accesorios, quote.descuento_total_regalos, user.id]
        );
        await connection.query(
          `INSERT INTO ventas_cotizaciones_accesorios (cotizacion_id, accesorio_id, cantidad, precio_unitario, moneda_id, subtotal, descuento_porcentaje, descuento_monto, total, notas)
           SELECT ?, accesorio_id, cantidad, precio_unitario, moneda_id, subtotal, descuento_porcentaje, descuento_monto, total, notas
           FROM ventas_cotizaciones_accesorios WHERE cotizacion_id=?`,
          [duplicated.insertId, quote.id]
        );
        await connection.query(
          `INSERT INTO ventas_cotizaciones_regalos (cotizacion_id, regalo_id, cantidad, precio_unitario, moneda_id, subtotal, descuento_porcentaje, descuento_monto, total, notas)
           SELECT ?, regalo_id, cantidad, precio_unitario, moneda_id, subtotal, descuento_porcentaje, descuento_monto, total, notas
           FROM ventas_cotizaciones_regalos WHERE cotizacion_id=?`,
          [duplicated.insertId, quote.id]
        );
      }
    }
    if (body.action === "quote-add-accessory") {
      const [[item]] = await connection.query(`SELECT id, precio, precio_venta, moneda_id FROM ventas_accesorios_disponibles WHERE id=?`, [Number(body.accesorioId)]);
      if (!item) {
        await connection.rollback();
        return NextResponse.json({ message: "Accesorio no encontrado." }, { status: 404 });
      }
      const cantidad = Math.max(Number(body.cantidad || 1), 1);
      const unit = Number(item.precio_venta ?? item.precio ?? 0);
      const subtotal = unit * cantidad;
      const descuentoMonto = Number(body.descuentoMonto || 0);
      const descuentoPorcentaje = body.descuentoPorcentaje ? Number(body.descuentoPorcentaje) : null;
      const total = Math.max(subtotal - descuentoMonto - (descuentoPorcentaje ? subtotal * descuentoPorcentaje / 100 : 0), 0);
      await connection.query(
        `INSERT INTO ventas_cotizaciones_accesorios (cotizacion_id, accesorio_id, cantidad, precio_unitario, moneda_id, subtotal, descuento_porcentaje, descuento_monto, total, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [Number(body.cotizacionId), item.id, cantidad, unit, item.moneda_id, subtotal, descuentoPorcentaje, descuentoMonto, total, body.notas || null]
      );
    }
    if (body.action === "quote-add-gift") {
      const [[item]] = await connection.query(`SELECT id, precio_compra, precio_venta, moneda_id FROM ventas_regalos_disponibles WHERE id=?`, [Number(body.regaloId)]);
      if (!item) {
        await connection.rollback();
        return NextResponse.json({ message: "Regalo no encontrado." }, { status: 404 });
      }
      const cantidad = Math.max(Number(body.cantidad || 1), 1);
      const unit = Number(item.precio_venta ?? item.precio_compra ?? 0);
      const subtotal = unit * cantidad;
      const descuentoMonto = Number(body.descuentoMonto || 0);
      const descuentoPorcentaje = body.descuentoPorcentaje ? Number(body.descuentoPorcentaje) : null;
      const total = Math.max(subtotal - descuentoMonto - (descuentoPorcentaje ? subtotal * descuentoPorcentaje / 100 : 0), 0);
      await connection.query(
        `INSERT INTO ventas_cotizaciones_regalos (cotizacion_id, regalo_id, cantidad, precio_unitario, moneda_id, subtotal, descuento_porcentaje, descuento_monto, total, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [Number(body.cotizacionId), item.id, cantidad, unit, item.moneda_id, subtotal, descuentoPorcentaje, descuentoMonto, total, body.notas || null]
      );
    }
    if (body.action === "quote-reserve") {
      const [[quote]] = await connection.query(
        `SELECT q.*, p.precio_base AS catalogo_precio_base FROM ventas_cotizaciones q INNER JOIN ventas_precios p ON p.id=q.precio_id WHERE q.id=?`,
        [Number(body.cotizacionId)]
      );
      if (!quote) {
        await connection.rollback();
        return NextResponse.json({ message: "Cotizacion no encontrada." }, { status: 404 });
      }
      const [[sent]] = await connection.query(`SELECT id FROM ventas_cotizaciones WHERE oportunidad_id=? AND estado='enviada' AND id<>? LIMIT 1`, [id, Number(body.cotizacionId)]);
      if (sent) {
        await connection.rollback();
        return NextResponse.json({ message: "Ya existe una cotizacion enviada para esta oportunidad." }, { status: 400 });
      }
      const [[existingReservation]] = await connection.query(`SELECT r.id FROM ventas_reservas r INNER JOIN ventas_reserva_detalles d ON d.reserva_id=r.id WHERE d.cotizacion_id=? LIMIT 1`, [Number(body.cotizacionId)]);
      if (existingReservation) {
        await connection.rollback();
        return NextResponse.json({ message: "Ya existe una reserva para esta cotizacion." }, { status: 400 });
      }
      await connection.query(`UPDATE ventas_cotizaciones SET estado='enviada' WHERE id=?`, [Number(body.cotizacionId)]);
      const [res] = await connection.query(`INSERT INTO ventas_reservas (oportunidad_id, created_by, estado) VALUES (?, ?, 'borrador')`, [id, user.id]);
      await connection.query(
        `INSERT INTO ventas_reserva_detalles (reserva_id, cotizacion_id, oportunidad_id, precio_unitario, total, cantidad, descripcion)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [res.insertId, quote.id, id, quote.precio_base ?? quote.catalogo_precio_base, quote.precio_base ?? quote.catalogo_precio_base, quote.sku || ""]
      );
      const reservaId = await stageId(connection, "Reserva");
      if (reservaId) await connection.query(`UPDATE ventas_oportunidades SET etapasconversion_id=? WHERE id=?`, [reservaId, id]);
      responsePayload = { ok: true, reservaId: res.insertId };
    }
    if (body.action === "reservation-delete") {
      await connection.query(`DELETE FROM ventas_reservas WHERE id=? AND oportunidad_id=?`, [Number(body.reservaId), id]);
    }
    if (body.action === "testdrive") {
      const [[op]] = await connection.query(`SELECT cliente_id FROM ventas_oportunidades WHERE id=?`, [id]);
      if (body.id) {
        const generateCertificate = Boolean(body.generateCertificate || body.startCertificate);
        const startRoute = Boolean(body.startRoute);
        const finishRoute = Boolean(body.finishRoute);
        const resumeRoute = Boolean(body.resumeRoute);
        const nextStatus = finishRoute ? "finalizado" : resumeRoute || startRoute || generateCertificate ? "en_proceso" : body.estado || null;
        await connection.query(
          `UPDATE ventas_oportunidades_test_drives
           SET fecha_testdrive=COALESCE(?, fecha_testdrive),
               hora_inicio=COALESCE(?, hora_inicio),
               hora_fin=?,
               modelo_id=COALESCE(?, modelo_id),
               vin=?,
               placa=?,
               descripcion=?,
               estado=COALESCE(?, estado),
               conductor_nombre=?,
               conductor_registro=?,
               certificado_vehiculo=?,
               certificado_local=?,
               inicio_prueba_at=CASE WHEN ?=1 AND inicio_prueba_at IS NULL THEN NOW() ELSE inicio_prueba_at END,
               certificado_generado_at=CASE WHEN ?=1 AND certificado_generado_at IS NULL THEN NOW() ELSE certificado_generado_at END,
               ruta_testdrive=?,
               ruta_inicio_at=CASE WHEN ?=1 AND ruta_inicio_at IS NULL THEN NOW() ELSE ruta_inicio_at END,
               ruta_fin_at=CASE WHEN ?=1 THEN NULL WHEN ?=1 AND ruta_fin_at IS NULL THEN NOW() ELSE ruta_fin_at END
           WHERE id=? AND oportunidad_id=?`,
          [
            body.fechaTestdrive || null,
            body.horaInicio || null,
            body.horaFin || null,
            body.modeloId || null,
            body.vin || null,
            body.placa || null,
            body.descripcion || null,
            nextStatus,
            body.conductorNombre || null,
            body.conductorRegistro || null,
            body.certificadoVehiculo || null,
            body.certificadoLocal || null,
            generateCertificate ? 1 : 0,
            generateCertificate ? 1 : 0,
            body.rutaTestdrive || null,
            startRoute ? 1 : 0,
            resumeRoute ? 1 : 0,
            finishRoute ? 1 : 0,
            Number(body.id),
            id,
          ]
        );
      } else {
        await connection.query(
          `INSERT INTO ventas_oportunidades_test_drives
           (oportunidad_id, cliente_id, fecha_testdrive, hora_inicio, hora_fin, modelo_id, vin, placa, descripcion, estado, conductor_nombre, conductor_registro, certificado_vehiculo, certificado_local, inicio_prueba_at, certificado_generado_at, ruta_testdrive, ruta_inicio_at, ruta_fin_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            op.cliente_id,
            body.fechaTestdrive,
            body.horaInicio,
            body.horaFin || null,
            body.modeloId || null,
            body.vin || null,
            body.placa || null,
            body.descripcion || null,
            body.estado || "programado",
            body.conductorNombre || null,
            body.conductorRegistro || null,
            body.certificadoVehiculo || null,
            body.certificadoLocal || null,
            body.startCertificate || body.generateCertificate ? new Date() : null,
            body.startCertificate || body.generateCertificate ? new Date() : null,
            body.rutaTestdrive || null,
            body.startRoute ? new Date() : null,
            body.finishRoute ? new Date() : null,
            user.id,
          ]
        );
      }
      const testId = await stageId(connection, "Test drive");
      if (testId) await connection.query(`UPDATE ventas_oportunidades SET etapasconversion_id=? WHERE id=?`, [testId, id]);
    }
    if (body.action === "testdrive-survey") {
      const testdriveId = Number(body.testdriveId);
      const [[testdrive]] = await connection.query(`SELECT id FROM ventas_oportunidades_test_drives WHERE id=? AND oportunidad_id=? LIMIT 1`, [testdriveId, id]);
      if (!testdrive) {
        await connection.rollback();
        return NextResponse.json({ message: "Test drive no encontrado." }, { status: 404 });
      }
      const values = [
        id,
        testdriveId,
        Number(body.rutaErgonomia || 0),
        Number(body.rutaVisibilidad || 0),
        Number(body.rutaDinamica || 0),
        Number(body.rutaSeguridad || 0),
        Number(body.rutaConfort || 0),
        Number(body.rutaTecnologia || 0),
        body.feedbackSatisfaccion || null,
        body.asesorExplico || null,
        body.experienciaTestdrive || null,
        body.explicacionesDemostraciones || null,
        body.fordManejo || null,
        body.estadoVehiculo || null,
        body.autoSuficiente || null,
        body.realizaraCompra || null,
        body.compraPlazo || null,
        user.id,
      ];
      await connection.query(
        `INSERT INTO ventas_oportunidades_test_drive_encuestas
         (oportunidad_id, testdrive_id, ruta_ergonomia, ruta_visibilidad, ruta_dinamica, ruta_seguridad, ruta_confort, ruta_tecnologia, feedback_satisfaccion, asesor_explico, experiencia_testdrive, explicaciones_demostraciones, ford_manejo, estado_vehiculo, auto_suficiente, realizara_compra, compra_plazo, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           ruta_ergonomia=VALUES(ruta_ergonomia),
           ruta_visibilidad=VALUES(ruta_visibilidad),
           ruta_dinamica=VALUES(ruta_dinamica),
           ruta_seguridad=VALUES(ruta_seguridad),
           ruta_confort=VALUES(ruta_confort),
           ruta_tecnologia=VALUES(ruta_tecnologia),
           feedback_satisfaccion=VALUES(feedback_satisfaccion),
           asesor_explico=VALUES(asesor_explico),
           experiencia_testdrive=VALUES(experiencia_testdrive),
           explicaciones_demostraciones=VALUES(explicaciones_demostraciones),
           ford_manejo=VALUES(ford_manejo),
           estado_vehiculo=VALUES(estado_vehiculo),
           auto_suficiente=VALUES(auto_suficiente),
           realizara_compra=VALUES(realizara_compra),
           compra_plazo=VALUES(compra_plazo),
           updated_at=CURRENT_TIMESTAMP`,
        values
      );
    }
    if (body.action === "closure") {
      await connection.query(`INSERT INTO ventas_oportunidades_cierres (oportunidad_id, detalle, cierre_detalle_id, created_by) VALUES (?, ?, ?, ?)`, [id, body.detalle, body.cierreDetalleId || null, user.id]);
      const closeId = await stageId(connection, "Cerrada");
      if (closeId) await connection.query(`UPDATE ventas_oportunidades SET etapasconversion_id=? WHERE id=?`, [closeId, id]);
    }
    await connection.commit();
    return NextResponse.json(responsePayload);
  } catch (error) {
    await connection.rollback();
    console.error("Error saving opportunity detail:", error);
    return NextResponse.json({ message: "No se pudo guardar." }, { status: 500 });
  } finally {
    connection.release();
  }
}
