import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function canSeeAll(user) {
  return Boolean(hasPerm(user.permissions, ["reservas", "viewall"]));
}

const RESERVATION_STATUS_TRANSITIONS = {
  borrador: {
    enviado_firma: "send_signature",
    observado: "observe",
  },
  enviado_firma: {
    observado: "observe",
    firmado: "sign",
  },
  observado: {
    subsanado: "subsanate",
    firmado: "sign",
  },
  subsanado: {
    observado: "observe",
    firmado: "sign",
  },
  firmado: {
    observado: "observe",
  },
};

function canChangeReservationStatus(user, fromStatus, toStatus) {
  const requiredPermission = RESERVATION_STATUS_TRANSITIONS[fromStatus]?.[toStatus];
  if (!requiredPermission) return false;
  return Boolean(hasPerm(user.permissions, ["reservas", requiredPermission]));
}

function normalizeDiscounts(discounts) {
  return (Array.isArray(discounts) ? discounts : [])
    .map((discount, index) => ({
      nombre: String(discount.nombre || "").trim(),
      tipo: String(discount.tipo || "MONTO").toUpperCase() === "PORCENTAJE" ? "PORCENTAJE" : "MONTO",
      valor: Number(discount.valor || 0),
      orden: Number(discount.orden ?? index),
      nota: String(discount.nota || "").trim() || null,
    }))
    .filter((discount) => discount.nombre && discount.valor > 0);
}

function normalizeDeposits(deposits) {
  return (Array.isArray(deposits) ? deposits : [])
    .map((deposit) => ({
      entidadFinanciera: String(deposit.entidadFinanciera || "").trim() || null,
      numeroOperacion: String(deposit.numeroOperacion || "").trim() || null,
      monto: Number(deposit.monto || 0),
      monedaSimbolo: ["$", "S/"].includes(String(deposit.monedaSimbolo || deposit.moneda_simbolo || "").trim()) ? String(deposit.monedaSimbolo || deposit.moneda_simbolo).trim() : "$",
      fechaDeposito: deposit.fechaDeposito ? String(deposit.fechaDeposito).replace("T", " ").slice(0, 19) : null,
      observacion: String(deposit.observacion || "").trim() || null,
    }))
    .filter((deposit) => deposit.monto > 0 || deposit.entidadFinanciera || deposit.numeroOperacion || deposit.fechaDeposito || deposit.observacion);
}

function normalizeCoowners(coowners) {
  return (Array.isArray(coowners) ? coowners : [])
    .map((coowner) => {
      const tipo = String(coowner.tipoIdentificacion || "").toUpperCase();
      const rawDocument = String(coowner.numeroDocumento || "").trim();
      const numeroDocumento = tipo === "DNI"
        ? rawDocument.replace(/\D/g, "").slice(0, 8)
        : tipo === "RUC"
          ? rawDocument.replace(/\D/g, "").slice(0, 11)
          : rawDocument || null;
      return {
        nombre: String(coowner.nombre || "").trim() || null,
        apellido: String(coowner.apellido || "").trim() || null,
        email: String(coowner.email || "").trim() || null,
        celular: String(coowner.celular || "").trim() || null,
        tipoIdentificacion: ["DNI", "RUC", "PASAPORTE"].includes(tipo) ? tipo : null,
        numeroDocumento,
        nombreComercial: tipo === "RUC" ? String(coowner.nombreComercial || "").trim() || null : null,
      };
    })
    .filter((coowner) => coowner.nombre || coowner.apellido || coowner.email || coowner.celular || coowner.numeroDocumento || coowner.nombreComercial);
}

function normalizePersonType(tipoComprobante, tipoPersona) {
  const comprobante = String(tipoComprobante || "").toUpperCase();
  if (comprobante.includes("BOLETA")) return "NATURAL";
  const persona = String(tipoPersona || "").toUpperCase();
  if (comprobante.includes("FACTURA") && ["NATURAL_RUC", "JURIDICA"].includes(persona)) return persona;
  return "NATURAL";
}

function getDiscountAmount(discount, base) {
  if (discount.tipo === "PORCENTAJE") return Number(base || 0) * Number(discount.valor || 0) / 100;
  return Number(discount.valor || 0);
}

function itemDiscountValues(subtotal, type, value) {
  const discount = Math.max(Number(value || 0), 0);
  const porcentaje = type === "percentage" ? discount : null;
  const monto = type === "amount" ? discount : 0;
  const total = Math.max(Number(subtotal || 0) - monto - (porcentaje ? Number(subtotal || 0) * porcentaje / 100 : 0), 0);
  return { porcentaje, monto, total };
}

function normalizeDateTime(value) {
  return value ? String(value).replace("T", " ").slice(0, 19) : null;
}

async function quoteItemsTotal(connection, cotizacionId) {
  if (!cotizacionId) return 0;
  const [[row]] = await connection.query(
    `SELECT
       COALESCE((SELECT SUM(COALESCE(total, 0)) FROM ventas_cotizaciones_accesorios WHERE cotizacion_id=?), 0) AS accesorios_total,
       COALESCE((SELECT SUM(COALESCE(total, 0)) FROM ventas_cotizaciones_regalos WHERE cotizacion_id=?), 0) AS regalos_total`,
    [cotizacionId, cotizacionId]
  );
  return Number(row?.accesorios_total || 0) + Number(row?.regalos_total || 0);
}

async function recalcReservationTotal(connection, reservationId, override = {}) {
  const [[detail]] = await connection.query(
    `SELECT d.id, d.cotizacion_id, d.precio_unitario, d.cantidad, d.dsctotienda, d.dsctobonoretoma,
            d.dsctonper, d.glp, d.tarjetaplaca, d.flete, d.glp_sn, d.tarjeta_sn, d.flete_sn, d.cuota_inicial
     FROM ventas_reserva_detalles d
     WHERE d.reserva_id=?
     LIMIT 1`,
    [reservationId]
  );
  if (!detail) return 0;
  const [discountRows] = await connection.query(
    `SELECT nombre, tipo, valor, orden, nota
     FROM ventas_reserva_detalles_descuentos
     WHERE detalle_id=?
     ORDER BY orden ASC, id ASC`,
    [detail.id]
  );
  const merged = { ...detail, ...override };
  const base = Number(merged.precio_unitario || 0) * Number(merged.cantidad || 1);
  const extraDiscountTotal = discountRows.reduce((sum, discount) => sum + getDiscountAmount(discount, base), 0);
  const itemsTotal = await quoteItemsTotal(connection, merged.cotizacion_id);
  const total = base
    - Number(merged.dsctotienda || 0)
    - Number(merged.dsctobonoretoma || 0)
    - Number(merged.dsctonper || 0)
    - extraDiscountTotal
    + (String(merged.glp_sn || "").toUpperCase() === "SI" ? Number(merged.glp || 0) : 0)
    + (String(merged.tarjeta_sn || "").toUpperCase() === "SI" ? Number(merged.tarjetaplaca || 0) : 0)
    + (String(merged.flete_sn || "").toUpperCase() === "SI" ? Number(merged.flete || 0) : 0)
    - Number(merged.cuota_inicial || 0)
    + itemsTotal;
  await connection.query(`UPDATE ventas_reserva_detalles SET total=? WHERE id=?`, [total, detail.id]);
  return total;
}

export async function GET(_request, { params }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const viewAll = canSeeAll(user);
    const [[reservation]] = await pool.query(
      `SELECT r.*, o.oportunidad_id AS oportunidad_code,
              CONCAT(COALESCE(c.nombre,''),' ',COALESCE(c.apellido,'')) AS cliente,
              c.id_lead, c.email, c.celular, c.tipo_identificacion, c.identificacion_fiscal, c.fecha_nacimiento,
              c.ocupacion, c.domicilio, c.nombre_comercial, c.nombreconyugue, c.dniconyugue,
              og.name AS origen_nombre, so.name AS suborigen_nombre,
              dep.nombre AS departamento, prov.nombre AS provincia, dis.nombre AS distrito,
              u.fullname AS creado_por
       FROM ventas_reservas r
       LEFT JOIN ventas_oportunidades o ON o.id=r.oportunidad_id
       LEFT JOIN administracion_clientes c ON c.id=o.cliente_id
       LEFT JOIN configuracion_origenes_citas og ON og.id=o.origen_id
       LEFT JOIN configuracion_suborigenes_citas so ON so.id=o.suborigen_id
       LEFT JOIN departamentos dep ON dep.id=c.departamento_id
       LEFT JOIN provincias prov ON prov.id=c.provincia_id
       LEFT JOIN distritos dis ON dis.id=c.distrito_id
       LEFT JOIN administracion_usuarios u ON u.id=r.created_by
       WHERE r.id=? ${viewAll ? "" : "AND r.created_by=?"} LIMIT 1`,
      viewAll ? [id] : [id, user.id]
    );
    if (!reservation) return NextResponse.json({ message: "Reserva no encontrada." }, { status: 404 });
    const [[detail]] = await pool.query(
      `SELECT d.*, q.anio, q.sku, q.color_externo, q.color_interno, o.cliente_id,
              p.id AS precio_id, p.version, p.precio_base, p.marca_id, p.modelo_id,
              ma.name AS marca, mo.name AS modelo, cl.name AS clase
       FROM ventas_reserva_detalles d
       INNER JOIN ventas_cotizaciones q ON q.id=d.cotizacion_id
       INNER JOIN ventas_reservas r ON r.id=d.reserva_id
       LEFT JOIN ventas_oportunidades o ON o.id=r.oportunidad_id
       INNER JOIN ventas_precios p ON p.id=q.precio_id
       INNER JOIN administracion_marcas ma ON ma.id=p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id=p.modelo_id
       LEFT JOIN administracion_clases cl ON cl.id=mo.clase_id
       WHERE d.reserva_id=? LIMIT 1`,
      [id]
    );
    const [vins] = detail ? await pool.query(
      `SELECT h.vin, h.color_externo, h.color_interno, h.numero_motor,
              h.numerofactura, h.preciocompra, h.precioventa
       FROM ventas_historial_carros h
       WHERE h.precio_id=?
         AND (
           h.vin=?
           OR NOT EXISTS (
             SELECT 1
             FROM ventas_reserva_detalles rd
             WHERE rd.vin=h.vin AND rd.reserva_id<>?
           )
         )
       ORDER BY h.created_at DESC`,
      [detail.precio_id, detail.vin || "", id]
    ) : [[]];
    const [[vinReleaseRequest]] = detail?.vin ? await pool.query(
      `SELECT s.*, sp.fullname AS solicitado_por_nombre, ap.fullname AS autorizado_por_nombre
       FROM ventas_reservas_liberar_vin_solicitudes s
       INNER JOIN administracion_usuarios sp ON sp.id=s.solicitado_por
       LEFT JOIN administracion_usuarios ap ON ap.id=s.autorizado_por
       WHERE s.vin=? AND s.estado='pendiente'
       ORDER BY s.fecha_solicitud DESC
       LIMIT 1`,
      [detail.vin]
    ) : [[null]];
    const [accessories] = detail ? await pool.query(
      `SELECT ca.*, ad.detalle, ad.numero_parte
       FROM ventas_cotizaciones_accesorios ca
       INNER JOIN ventas_accesorios_disponibles ad ON ad.id=ca.accesorio_id
       WHERE ca.cotizacion_id=?
       ORDER BY ca.id ASC`,
      [detail.cotizacion_id]
    ) : [[]];
    const [gifts] = detail ? await pool.query(
      `SELECT cr.*, rd.detalle, rd.lote
       FROM ventas_cotizaciones_regalos cr
       INNER JOIN ventas_regalos_disponibles rd ON rd.id=cr.regalo_id
       WHERE cr.cotizacion_id=?
       ORDER BY cr.id ASC`,
      [detail.cotizacion_id]
    ) : [[]];
    const [accessoryOptions] = detail ? await pool.query(
      `SELECT id, detalle, numero_parte, COALESCE(precio_venta, precio, 0) AS precio, moneda_id
       FROM ventas_accesorios_disponibles
       WHERE marca_id=? AND modelo_id=?
       ORDER BY detalle ASC`,
      [detail.marca_id, detail.modelo_id]
    ) : [[]];
    const [giftOptions] = detail ? await pool.query(
      `SELECT id, detalle, lote, COALESCE(precio_venta, precio_compra, 0) AS precio, moneda_id
       FROM ventas_regalos_disponibles
       ORDER BY detalle ASC`
    ) : [[]];
    const [discountRows] = detail ? await pool.query(
      `SELECT id, detalle_id, nombre, tipo, valor, orden, nota
       FROM ventas_reserva_detalles_descuentos
       WHERE detalle_id=?
       ORDER BY orden ASC, id ASC`,
      [detail.id]
    ) : [[]];
    const [depositRows] = detail ? await pool.query(
      `SELECT id, detalle_id, entidad_financiera, numero_operacion, monto, moneda_simbolo, fecha_deposito, observacion
       FROM ventas_reserva_depositos
       WHERE detalle_id=?
       ORDER BY COALESCE(fecha_deposito, created_at) ASC, id ASC`,
      [detail.id]
    ) : [[]];
    const [coownerRows] = await pool.query(
      `SELECT id, nombre, apellido, email, celular, tipo_identificacion, numero_documento, nombre_comercial, created_at
       FROM ventas_reservas_copropietarios
       WHERE reserva_id=?
       ORDER BY id ASC`,
      [id]
    );
    const [[carEvent]] = detail?.vin ? await pool.query(
      `SELECT id, vin, numero_factura, fecha_facturacion, fecha_entrega_cliente, fecha_entrega_placa,
              placa, kilometraje, observacion
       FROM ventas_historial_carros_eventos
       WHERE vin=?
       ORDER BY id DESC
       LIMIT 1`,
      [detail.vin]
    ) : [[null]];
    const [[salesBoss]] = await pool.query(
      `SELECT u.fullname
       FROM administracion_usuarios u
       LEFT JOIN configuracion_roles r ON r.id=u.role_id
       WHERE COALESCE(u.is_active, 1)=1
         AND LOWER(TRIM(COALESCE(r.name,''))) LIKE '%jefe%venta%'
       ORDER BY u.id ASC
       LIMIT 1`
    );
    return NextResponse.json({
      currentUser: {
        id: user.id,
        canViewAll: viewAll,
        canCarData: hasPerm(user.permissions, ["reservas", "car_data"]),
        reservationStatusActions: {
          sendSignature: hasPerm(user.permissions, ["reservas", "send_signature"]),
          observe: hasPerm(user.permissions, ["reservas", "observe"]),
          subsanate: hasPerm(user.permissions, ["reservas", "subsanate"]),
          sign: hasPerm(user.permissions, ["reservas", "sign"]),
        },
      },
      reservation: {
        id: reservation.id,
        estado: reservation.estado || "borrador",
        observaciones: reservation.observaciones || "",
        oportunidadId: reservation.oportunidad_id,
        oportunidadCode: reservation.oportunidad_code || "-",
        origenVenta: reservation.origen_nombre || "",
        campania: reservation.suborigen_nombre || "",
        createdAt: reservation.created_at,
        creadoPor: reservation.creado_por || "-",
        cliente: String(reservation.cliente || "").trim() || "-",
        idLead: reservation.id_lead || "",
        email: reservation.email || "",
        celular: reservation.celular || "",
        tipoIdentificacion: reservation.tipo_identificacion || "",
        documento: reservation.identificacion_fiscal || "",
        fechaNacimiento: reservation.fecha_nacimiento,
        ocupacion: reservation.ocupacion || "",
        domicilio: reservation.domicilio || "",
        departamento: reservation.departamento || "",
        provincia: reservation.provincia || "",
        distrito: reservation.distrito || "",
        nombreComercial: reservation.nombre_comercial || "",
        nombreConyugue: reservation.nombreconyugue || "",
        dniConyugue: reservation.dniconyugue || "",
      },
      detail: detail ? {
        id: detail.id,
        clienteId: detail.cliente_id,
        cotizacionId: detail.cotizacion_id,
        marcaId: detail.marca_id,
        modeloId: detail.modelo_id,
        marca: detail.marca,
        modelo: detail.modelo,
        clase: detail.clase || "-",
        version: detail.version,
        anio: detail.anio || "",
        precioId: detail.precio_id,
        precioBase: Number(detail.precio_base || detail.precio_unitario || 0),
        tipoComprobante: detail.tipo_comprobante || "",
        tipoPersona: detail.tipo_persona || "NATURAL",
        numeroMotor: detail.numero_motor || "",
        tcReferencial: detail.tc_referencial || "",
        total: Number(detail.total || 0),
        vin: detail.vin || "",
        vinExiste: Boolean(detail.vin_existe),
        usoVehiculo: detail.usovehiculo || "",
        placa: detail.placa || "",
        descuentoTienda: Number(detail.dsctotienda || 0),
        descuentoTiendaPorcentaje: detail.dsctotiendaporcentaje || "",
        bonoRetoma: Number(detail.dsctobonoretoma || 0),
        descuentoNper: Number(detail.dsctonper || 0),
        glp: Number(detail.glp || 0),
        glpSn: detail.glp_sn || "NO",
        tarjetaPlaca: Number(detail.tarjetaplaca || 0),
        tarjetaSn: detail.tarjeta_sn || "NO",
        flete: Number(detail.flete || 0),
        fleteSn: detail.flete_sn || "NO",
        cuotaInicial: detail.cuota_inicial || "",
        formaPago: detail.forma_pago || "",
        banco: detail.banco || "",
        tipoCredito: detail.tipo_credito || "",
        telefono2: detail.telefono2 || detail.telefono_2 || detail.telefono || detail.telefono_reserva || "",
        cantidad: Number(detail.cantidad || 1),
        precioUnitario: Number(detail.precio_unitario || 0),
        descripcion: detail.descripcion || "",
        origenFondos: detail.origen_fondos || "",
        codigo: detail.codigo || "",
        colorExterno: detail.color_externo || "",
        colorInterno: detail.color_interno || "",
        descuentos: discountRows.map((row) => ({
          id: Number(row.id),
          nombre: row.nombre,
          tipo: row.tipo,
          valor: Number(row.valor || 0),
          orden: Number(row.orden || 0),
          nota: row.nota || "",
        })),
        depositos: depositRows.map((row) => ({
          id: Number(row.id),
          entidadFinanciera: row.entidad_financiera || "",
          numeroOperacion: row.numero_operacion || "",
          monto: Number(row.monto || 0),
          monedaSimbolo: row.moneda_simbolo || "$",
          moneda_simbolo: row.moneda_simbolo || "$",
          fechaDeposito: row.fecha_deposito,
          fecha_deposito: row.fecha_deposito,
          observacion: row.observacion || "",
        })),
        copropietarios: coownerRows.map((row) => ({
          id: Number(row.id),
          nombre: row.nombre || "",
          apellido: row.apellido || "",
          email: row.email || "",
          celular: row.celular || "",
          tipoIdentificacion: row.tipo_identificacion || "",
          numeroDocumento: row.numero_documento || "",
          nombreComercial: row.nombre_comercial || "",
          createdAt: row.created_at,
        })),
        carEvent: carEvent ? {
          id: Number(carEvent.id),
          vin: carEvent.vin,
          numeroFactura: carEvent.numero_factura || "",
          fechaFacturacion: carEvent.fecha_facturacion,
          fechaEntregaCliente: carEvent.fecha_entrega_cliente,
          fechaEntregaPlaca: carEvent.fecha_entrega_placa,
          placa: carEvent.placa || "",
          kilometraje: carEvent.kilometraje === null ? "" : Number(carEvent.kilometraje),
          observacion: carEvent.observacion || "",
        } : null,
      } : null,
      vins: vins.map((row) => ({
        value: row.vin,
        label: row.vin,
        colorExterno: row.color_externo || "",
        colorInterno: row.color_interno || "",
        numeroMotor: row.numero_motor || "",
        numeroFactura: row.numerofactura || "",
        precioCompra: row.preciocompra === null ? null : Number(row.preciocompra),
        precioVenta: row.precioventa === null ? null : Number(row.precioventa),
      })),
      accessories: accessories.map((row) => ({
        id: row.id,
        accesorioId: row.accesorio_id,
        detalle: row.detalle,
        numeroParte: row.numero_parte || "",
        cantidad: Number(row.cantidad || 0),
        precioUnitario: Number(row.precio_unitario || 0),
        subtotal: Number(row.subtotal || 0),
        descuentoPorcentaje: Number(row.descuento_porcentaje || 0),
        descuentoMonto: Number(row.descuento_monto || 0),
        total: Number(row.total || 0),
        notas: row.notas || "",
      })),
      gifts: gifts.map((row) => ({
        id: row.id,
        regaloId: row.regalo_id,
        detalle: row.detalle,
        lote: row.lote || "",
        cantidad: Number(row.cantidad || 0),
        precioUnitario: Number(row.precio_unitario || 0),
        subtotal: Number(row.subtotal || 0),
        descuentoPorcentaje: Number(row.descuento_porcentaje || 0),
        descuentoMonto: Number(row.descuento_monto || 0),
        total: Number(row.total || 0),
        notas: row.notas || "",
      })),
      options: {
        accessories: accessoryOptions.map((row) => ({
          value: row.id,
          label: `${row.detalle}${row.numero_parte ? ` - ${row.numero_parte}` : ""}`,
          price: Number(row.precio || 0),
          monedaId: row.moneda_id,
        })),
        gifts: giftOptions.map((row) => ({
          value: row.id,
          label: `${row.detalle}${row.lote ? ` - ${row.lote}` : ""}`,
          price: Number(row.precio || 0),
          monedaId: row.moneda_id,
        })),
      },
      salesBossName: salesBoss?.fullname || "",
      vinReleaseRequest: vinReleaseRequest ? {
        id: Number(vinReleaseRequest.id),
        vin: vinReleaseRequest.vin,
        estado: vinReleaseRequest.estado,
        motivo: vinReleaseRequest.motivo || "",
        solicitadoPor: Number(vinReleaseRequest.solicitado_por),
        solicitadoPorNombre: vinReleaseRequest.solicitado_por_nombre || "",
        fechaSolicitud: vinReleaseRequest.fecha_solicitud,
      } : null,
    });
  } catch (error) {
    console.error("Error loading reservation:", error);
    return NextResponse.json({ message: "No se pudo cargar la reserva." }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    const body = await request.json();
    await connection.beginTransaction();
    const [[reservationState]] = await connection.query(`SELECT estado FROM ventas_reservas WHERE id=? LIMIT 1`, [id]);
    if (!reservationState) {
      await connection.rollback();
      return NextResponse.json({ message: "Reserva no encontrada." }, { status: 404 });
    }
    if (body.vinReleaseAction) {
      const action = body.vinReleaseAction;
      if (action === "request") {
        const [[detail]] = await connection.query(`SELECT vin FROM ventas_reserva_detalles WHERE reserva_id=? LIMIT 1`, [id]);
        if (!detail?.vin) {
          await connection.rollback();
          return NextResponse.json({ message: "La reserva no tiene VIN asignado." }, { status: 400 });
        }
        const [[pending]] = await connection.query(`SELECT id FROM ventas_reservas_liberar_vin_solicitudes WHERE vin=? AND estado='pendiente' LIMIT 1`, [detail.vin]);
        if (!pending) {
          await connection.query(
            `INSERT INTO ventas_reservas_liberar_vin_solicitudes (vin, solicitado_por, motivo) VALUES (?, ?, ?)`,
            [detail.vin, user.id, body.motivo || "Solicitud para liberar VIN de reserva firmada"]
          );
        }
      } else if (action === "cancel") {
        await connection.query(
          `UPDATE ventas_reservas_liberar_vin_solicitudes
           SET estado='cancelado', fecha_resolucion=NOW(), comentario_resolucion=?
           WHERE id=? AND solicitado_por=? AND estado='pendiente'`,
          [body.comentario || "Cancelado por solicitante", body.requestId, user.id]
        );
      } else if (["approve", "reject"].includes(action)) {
        if (!canSeeAll(user)) {
          await connection.rollback();
          return NextResponse.json({ message: "No tienes permiso para resolver la solicitud." }, { status: 403 });
        }
        const [[requestRow]] = await connection.query(
          `SELECT id, vin FROM ventas_reservas_liberar_vin_solicitudes WHERE id=? AND estado='pendiente' LIMIT 1`,
          [body.requestId]
        );
        if (!requestRow) {
          await connection.rollback();
          return NextResponse.json({ message: "Solicitud no encontrada." }, { status: 404 });
        }
        const nextState = action === "approve" ? "aprobado" : "rechazado";
        await connection.query(
          `UPDATE ventas_reservas_liberar_vin_solicitudes
           SET estado=?, autorizado_por=?, fecha_resolucion=NOW(), comentario_resolucion=?
           WHERE id=?`,
          [nextState, user.id, body.comentario || null, requestRow.id]
        );
        if (action === "approve") {
          await connection.query(
            `UPDATE ventas_reserva_detalles SET vin=NULL, vin_existe=0, numero_motor=NULL WHERE reserva_id=? AND vin=?`,
            [id, requestRow.vin]
          );
        }
      }
      await connection.commit();
      return NextResponse.json({ ok: true });
    }
    if (body.action === "car-data") {
      if (!hasPerm(user.permissions, ["reservas", "car_data"])) {
        await connection.rollback();
        return NextResponse.json({ message: "No tienes permiso para datos del carro." }, { status: 403 });
      }
      if (reservationState.estado !== "firmado") {
        await connection.rollback();
        return NextResponse.json({ message: "La reserva debe estar firmada." }, { status: 409 });
      }
      const [[detail]] = await connection.query(
        `SELECT d.id, d.vin, d.cotizacion_id, q.anio, q.color_externo, p.marca_id, p.modelo_id, o.cliente_id
         FROM ventas_reserva_detalles d
         INNER JOIN ventas_cotizaciones q ON q.id=d.cotizacion_id
         INNER JOIN ventas_precios p ON p.id=q.precio_id
         INNER JOIN ventas_reservas r ON r.id=d.reserva_id
         INNER JOIN ventas_oportunidades o ON o.id=r.oportunidad_id
         WHERE d.reserva_id=?
         LIMIT 1`,
        [id]
      );
      if (!detail?.vin) {
        await connection.rollback();
        return NextResponse.json({ message: "La reserva no tiene VIN." }, { status: 400 });
      }
      const event = body.carEvent || {};
      const eventPayload = [
        event.numeroFactura || null,
        normalizeDateTime(event.fechaFacturacion),
        normalizeDateTime(event.fechaEntregaCliente),
        normalizeDateTime(event.fechaEntregaPlaca),
        event.placa || null,
        event.kilometraje === "" || event.kilometraje === null || event.kilometraje === undefined ? null : Number(event.kilometraje),
        event.observacion || null,
      ];
      const [[existingEvent]] = await connection.query(`SELECT id FROM ventas_historial_carros_eventos WHERE vin=? ORDER BY id DESC LIMIT 1`, [detail.vin]);
      if (existingEvent) {
        await connection.query(
          `UPDATE ventas_historial_carros_eventos
           SET numero_factura=?, fecha_facturacion=?, fecha_entrega_cliente=?, fecha_entrega_placa=?, placa=?, kilometraje=?, observacion=?
           WHERE id=?`,
          [...eventPayload, existingEvent.id]
        );
      } else {
        await connection.query(
          `INSERT INTO ventas_historial_carros_eventos
           (vin, numero_factura, fecha_facturacion, fecha_entrega_cliente, fecha_entrega_placa, placa, kilometraje, observacion)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [detail.vin, ...eventPayload]
        );
      }
      if (event.fechaEntregaCliente && event.kilometraje !== "" && event.kilometraje !== null && event.kilometraje !== undefined) {
        const fechaVisita = String(event.fechaEntregaCliente).slice(0, 10);
        const [[vehicle]] = await connection.query(`SELECT id FROM administracion_vehiculos WHERE vin=? AND deleted_at IS NULL LIMIT 1`, [detail.vin]);
        if (vehicle) {
          await connection.query(
            `UPDATE administracion_vehiculos
             SET cliente_id=?, placas=?, marca_id=?, modelo_id=?, anio=?, color=?, kilometraje=?, fecha_ultima_visita=?
             WHERE id=?`,
            [detail.cliente_id || null, event.placa || null, detail.marca_id || null, detail.modelo_id || null, detail.anio || null, detail.color_externo || null, Number(event.kilometraje || 0), fechaVisita, vehicle.id]
          );
        } else {
          await connection.query(
            `INSERT INTO administracion_vehiculos
             (cliente_id, placas, vin, marca_id, modelo_id, anio, color, kilometraje, fecha_ultima_visita, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
            [detail.cliente_id || null, event.placa || null, detail.vin, detail.marca_id || null, detail.modelo_id || null, detail.anio || null, detail.color_externo || null, Number(event.kilometraje || 0), fechaVisita]
          );
        }
      }
      await connection.commit();
      return NextResponse.json({ ok: true });
    }
    if (Object.prototype.hasOwnProperty.call(body, "reservationObservaciones")) {
      if (reservationState.estado === "firmado") {
        await connection.rollback();
        return NextResponse.json({ message: "La reserva firmada no se puede modificar." }, { status: 409 });
      }
      await connection.query(`UPDATE ventas_reservas SET observaciones=? WHERE id=?`, [body.reservationObservaciones || null, id]);
      await connection.commit();
      return NextResponse.json({ ok: true });
    }
    if (reservationState.estado === "firmado" && (body.detail || body.quoteItem || (body.status && String(body.status || "") !== "observado"))) {
      await connection.rollback();
      return NextResponse.json({ message: "La reserva firmada no se puede modificar." }, { status: 409 });
    }
    if (body.quoteItem) {
      if (!hasPerm(user.permissions, ["reservas", "edit"]) && !hasPerm(user.permissions, ["cotizacion", "edit"]) && !canSeeAll(user)) {
        await connection.rollback();
        return NextResponse.json({ message: "No tienes permiso para modificar accesorios o regalos." }, { status: 403 });
      }
      const [[detail]] = await connection.query(
        `SELECT d.cotizacion_id, p.marca_id, p.modelo_id
         FROM ventas_reserva_detalles d
         INNER JOIN ventas_cotizaciones q ON q.id=d.cotizacion_id
         INNER JOIN ventas_precios p ON p.id=q.precio_id
         WHERE d.reserva_id=?
         LIMIT 1`,
        [id]
      );
      if (!detail?.cotizacion_id) {
        await connection.rollback();
        return NextResponse.json({ message: "La reserva no tiene cotizacion asociada." }, { status: 404 });
      }
      const item = body.quoteItem;
      const isGift = item.type === "gift";
      if (item.mode === "delete") {
        const table = isGift ? "ventas_cotizaciones_regalos" : "ventas_cotizaciones_accesorios";
        await connection.query(`DELETE FROM ${table} WHERE id=? AND cotizacion_id=?`, [Number(item.itemId), detail.cotizacion_id]);
        await recalcReservationTotal(connection, id);
        await connection.commit();
        return NextResponse.json({ ok: true });
      }
      const catalogId = Number(item.catalogId);
      const cantidad = Math.max(Number(item.cantidad || 1), 1);
      const [[catalog]] = isGift
        ? await connection.query(`SELECT id, precio_compra, precio_venta, moneda_id FROM ventas_regalos_disponibles WHERE id=?`, [catalogId])
        : await connection.query(
          `SELECT id, precio, precio_venta, moneda_id
           FROM ventas_accesorios_disponibles
           WHERE id=? AND marca_id=? AND modelo_id=?`,
          [catalogId, detail.marca_id, detail.modelo_id]
        );
      if (!catalog) {
        await connection.rollback();
        return NextResponse.json({ message: isGift ? "Regalo no encontrado." : "Accesorio no disponible para esta version." }, { status: 404 });
      }
      const unit = Number(isGift ? (catalog.precio_venta ?? catalog.precio_compra ?? 0) : (catalog.precio_venta ?? catalog.precio ?? 0));
      const subtotal = unit * cantidad;
      const { porcentaje, monto, total } = itemDiscountValues(subtotal, item.discountType, item.discountValue);
      if (item.mode === "update") {
        const table = isGift ? "ventas_cotizaciones_regalos" : "ventas_cotizaciones_accesorios";
        const fk = isGift ? "regalo_id" : "accesorio_id";
        await connection.query(
          `UPDATE ${table}
           SET ${fk}=?, cantidad=?, precio_unitario=?, moneda_id=?, subtotal=?, descuento_porcentaje=?, descuento_monto=?, total=?, notas=?
           WHERE id=? AND cotizacion_id=?`,
          [catalog.id, cantidad, unit, catalog.moneda_id, subtotal, porcentaje, monto, total, item.notas || null, Number(item.itemId), detail.cotizacion_id]
        );
      } else if (isGift) {
        await connection.query(
          `INSERT INTO ventas_cotizaciones_regalos (cotizacion_id, regalo_id, cantidad, precio_unitario, moneda_id, subtotal, descuento_porcentaje, descuento_monto, total, notas)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [detail.cotizacion_id, catalog.id, cantidad, unit, catalog.moneda_id, subtotal, porcentaje, monto, total, item.notas || null]
        );
      } else {
        await connection.query(
          `INSERT INTO ventas_cotizaciones_accesorios (cotizacion_id, accesorio_id, cantidad, precio_unitario, moneda_id, subtotal, descuento_porcentaje, descuento_monto, total, notas)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [detail.cotizacion_id, catalog.id, cantidad, unit, catalog.moneda_id, subtotal, porcentaje, monto, total, item.notas || null]
        );
      }
      await recalcReservationTotal(connection, id);
      await connection.commit();
      return NextResponse.json({ ok: true });
    }
    if (body.status) {
      const nextStatus = String(body.status || "");
      const currentStatus = String(reservationState.estado || "borrador");
      if (!canChangeReservationStatus(user, currentStatus, nextStatus)) {
        await connection.rollback();
        return NextResponse.json({ message: "No tienes permiso para ese cambio de estado o la transicion no es valida." }, { status: 403 });
      }
      await connection.query(`UPDATE ventas_reservas SET estado=?, observaciones=COALESCE(?, observaciones) WHERE id=?`, [body.status, body.observaciones ?? null, id]);
    }
    if (body.detail) {
      const d = body.detail;
      const base = Number(d.precioUnitario || 0) * Number(d.cantidad || 1);
      const extraDiscounts = normalizeDiscounts(d.descuentos);
      const deposits = normalizeDeposits(d.depositos);
      const coowners = normalizeCoowners(d.copropietarios);
      const tipoPersona = normalizePersonType(d.tipoComprobante, d.tipoPersona);
      const extraDiscountTotal = extraDiscounts.reduce((sum, discount) => sum + getDiscountAmount(discount, base), 0);
      const itemsTotal = await quoteItemsTotal(connection, d.cotizacionId);
      const glpSn = String(d.glpSn || "NO").toUpperCase() === "SI" ? "SI" : "NO";
      const tarjetaSn = String(d.tarjetaSn || "NO").toUpperCase() === "SI" ? "SI" : "NO";
      const fleteSn = String(d.fleteSn || "NO").toUpperCase() === "SI" ? "SI" : "NO";
      const total = base
        - Number(d.descuentoTienda || 0)
        - Number(d.bonoRetoma || 0)
        - Number(d.descuentoNper || 0)
        - extraDiscountTotal
        + (glpSn === "SI" ? Number(d.glp || 0) : 0)
        + (tarjetaSn === "SI" ? Number(d.tarjetaPlaca || 0) : 0)
        + (fleteSn === "SI" ? Number(d.flete || 0) : 0)
        - Number(d.cuotaInicial || 0)
        + itemsTotal;
      const [detailUpdate] = await connection.query(
        `UPDATE ventas_reserva_detalles
         SET tipo_comprobante=?, tipo_persona=?, numero_motor=?, tc_referencial=?, total=?, vin=?, vin_existe=?, usovehiculo=?, placa=?,
             dsctotienda=?, dsctotiendaporcentaje=?, dsctobonoretoma=?, dsctonper=?, glp=?, tarjetaplaca=?, flete=?,
             glp_sn=?, tarjeta_sn=?, flete_sn=?, cuota_inicial=?, cantidad=?, precio_unitario=?, descripcion=?,
             origen_fondos=?, codigo=?, forma_pago=?, banco=?, tipo_credito=?
         WHERE reserva_id=?`,
        [
          d.tipoComprobante || null, tipoPersona, d.numeroMotor || null, d.tcReferencial || null, total,
          d.vinExiste ? d.vin || null : null, d.vinExiste ? 1 : 0, d.usoVehiculo || null, d.placa || null,
          d.descuentoTienda || 0, d.descuentoTiendaPorcentaje || null, d.bonoRetoma || 0, d.descuentoNper || 0,
          d.glp || 0, d.tarjetaPlaca || 0, d.flete || 0, glpSn, tarjetaSn, fleteSn, d.cuotaInicial || null, d.cantidad || 1,
          d.precioUnitario || 0, d.descripcion || null, d.origenFondos || null, d.codigo || null,
          d.formaPago || null, d.banco || null, d.tipoCredito || null, id,
        ]
      );
      if (d.clienteId) {
        await connection.query(
          `UPDATE administracion_clientes
           SET email=?, celular=?, identificacion_fiscal=?, fecha_nacimiento=?, ocupacion=?, domicilio=?,
               nombre_comercial=?, nombreconyugue=?, dniconyugue=?
           WHERE id=?`,
          [
            d.clienteEmail || null,
            d.clienteTelefono1 || null,
            d.clienteDocumento || null,
            d.clienteFechaNacimiento || null,
            d.clienteOcupacion || null,
            d.clienteDomicilio || null,
            d.clienteRazonSocial || null,
            d.clienteConyugue || null,
            d.clienteDniConyugue || null,
            d.clienteId,
          ]
        );
      }
      await connection.query(`DELETE FROM ventas_reservas_copropietarios WHERE reserva_id=?`, [id]);
      if (coowners.length) {
        await connection.query(
          `INSERT INTO ventas_reservas_copropietarios
           (reserva_id, nombre, apellido, email, celular, tipo_identificacion, numero_documento, nombre_comercial)
           VALUES ${coowners.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
          coowners.flatMap((coowner) => [
            id,
            coowner.nombre,
            coowner.apellido,
            coowner.email,
            coowner.celular,
            coowner.tipoIdentificacion,
            coowner.numeroDocumento,
            coowner.nombreComercial,
          ])
        );
      }
      const detailId = Number(d.id || 0);
      if (detailId) {
        await connection.query(`DELETE FROM ventas_reserva_detalles_descuentos WHERE detalle_id=?`, [detailId]);
        if (extraDiscounts.length) {
          await connection.query(
            `INSERT INTO ventas_reserva_detalles_descuentos (detalle_id, nombre, tipo, valor, orden, nota)
             VALUES ${extraDiscounts.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}`,
            extraDiscounts.flatMap((discount) => [detailId, discount.nombre, discount.tipo, discount.valor, discount.orden, discount.nota])
          );
        }
        await connection.query(`DELETE FROM ventas_reserva_depositos WHERE detalle_id=?`, [detailId]);
        if (deposits.length) {
          await connection.query(
            `INSERT INTO ventas_reserva_depositos (detalle_id, entidad_financiera, numero_operacion, monto, moneda_simbolo, fecha_deposito, observacion)
             VALUES ${deposits.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
            deposits.flatMap((deposit) => [detailId, deposit.entidadFinanciera, deposit.numeroOperacion, deposit.monto, deposit.monedaSimbolo, deposit.fechaDeposito, deposit.observacion])
          );
        }
      } else if (detailUpdate.affectedRows) {
        const [[savedDetail]] = await connection.query(`SELECT id FROM ventas_reserva_detalles WHERE reserva_id=? LIMIT 1`, [id]);
        if (savedDetail?.id) {
          await connection.query(`DELETE FROM ventas_reserva_detalles_descuentos WHERE detalle_id=?`, [savedDetail.id]);
          if (extraDiscounts.length) {
            await connection.query(
              `INSERT INTO ventas_reserva_detalles_descuentos (detalle_id, nombre, tipo, valor, orden, nota)
               VALUES ${extraDiscounts.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}`,
              extraDiscounts.flatMap((discount) => [savedDetail.id, discount.nombre, discount.tipo, discount.valor, discount.orden, discount.nota])
            );
          }
          await connection.query(`DELETE FROM ventas_reserva_depositos WHERE detalle_id=?`, [savedDetail.id]);
          if (deposits.length) {
            await connection.query(
              `INSERT INTO ventas_reserva_depositos (detalle_id, entidad_financiera, numero_operacion, monto, moneda_simbolo, fecha_deposito, observacion)
               VALUES ${deposits.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
              deposits.flatMap((deposit) => [savedDetail.id, deposit.entidadFinanciera, deposit.numeroOperacion, deposit.monto, deposit.monedaSimbolo, deposit.fechaDeposito, deposit.observacion])
            );
          }
        }
      }
      if (d.cotizacionId) {
        await connection.query(
          `UPDATE ventas_cotizaciones SET color_externo=?, color_interno=?, anio=? WHERE id=?`,
          [d.colorExterno || null, d.colorInterno || null, d.anioModelo || d.anio || null, d.cotizacionId]
        );
      }
    }
    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error saving reservation:", error);
    return NextResponse.json({ message: "No se pudo guardar la reserva." }, { status: 500 });
  } finally {
    connection.release();
  }
}
