import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function clean(value) {
  return String(value ?? "").trim();
}

function nullable(value) {
  const text = clean(value);
  return text ? text : null;
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function dateOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  const text = clean(value);
  return text ? text.replace("T", " ").replace(/[zZ]$/, "") : null;
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });

    const [priceRows] = await connection.query(
      `SELECT p.id, p.version, ma.name AS marca_name, mo.name AS modelo_name
       FROM ventas_precios p
       INNER JOIN administracion_marcas ma ON ma.id = p.marca_id
       INNER JOIN administracion_modelos mo ON mo.id = p.modelo_id`
    );
    const prices = new Map(priceRows.map((row) => [`${normalize(row.marca_name)}:${normalize(row.modelo_name)}:${normalize(row.version)}`, row.id]));

    let imported = 0;
    let updated = 0;
    const errors = [];
    await connection.beginTransaction();

    for (const [index, row] of rows.entries()) {
      const vin = clean(row.vin || row.VIN);
      const marca = clean(row.marca || row.marcaName);
      const modelo = clean(row.modelo || row.modeloName);
      const version = clean(row.version);
      const precioId = Number(row.precio_id || row.precioId) || prices.get(`${normalize(marca)}:${normalize(modelo)}:${normalize(version)}`);

      if (!vin || !precioId) {
        errors.push(`Fila ${index + 2}: VIN y vehiculo exacto (marca, modelo, version) son obligatorios.`);
        continue;
      }

      const [result] = await connection.query(
        `INSERT INTO ventas_historial_carros
         (vin, precio_id, color_externo, color_interno, numero_motor, numerofactura, preciocompra, precioventa, created_at_facturacion, created_at_llegadaalcentro, created_at_entrega)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE precio_id = VALUES(precio_id), color_externo = VALUES(color_externo),
           color_interno = VALUES(color_interno), numero_motor = VALUES(numero_motor), numerofactura = VALUES(numerofactura),
           preciocompra = VALUES(preciocompra), precioventa = VALUES(precioventa),
           created_at_facturacion = VALUES(created_at_facturacion), created_at_llegadaalcentro = VALUES(created_at_llegadaalcentro),
           created_at_entrega = VALUES(created_at_entrega)`,
        [
          vin,
          precioId,
          nullable(row.color_externo ?? row.colorExterno),
          nullable(row.color_interno ?? row.colorInterno),
          nullable(row.numero_motor ?? row.numeroMotor),
          nullable(row.numero_factura ?? row.numeroFactura),
          numberOrNull(row.precio_compra ?? row.precioCompra),
          numberOrNull(row.precio_venta ?? row.precioVenta),
          dateOrNull(row.facturacion_at ?? row.facturacionAt),
          dateOrNull(row.llegada_centro_at ?? row.llegadaCentroAt),
          dateOrNull(row.entrega_at ?? row.entregaAt),
        ]
      );
      imported += 1;
      if (result.affectedRows === 2) updated += 1;
    }

    if (!imported) {
      await connection.rollback();
      return NextResponse.json({ message: errors[0] || "No se pudo importar inventario." }, { status: 400 });
    }

    await connection.commit();
    return NextResponse.json({ ok: true, imported, updated, errors });
  } catch (error) {
    await connection.rollback();
    console.error("Error importing car inventory:", error);
    return NextResponse.json({ message: "No se pudo importar inventario de carros." }, { status: 500 });
  } finally {
    connection.release();
  }
}
