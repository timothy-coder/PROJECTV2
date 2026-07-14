import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function value(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return "";
}

function cleanText(input) {
  return String(input || "").trim();
}

function numberValue(input) {
  const value = Number(String(input ?? "").replace(/,/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function nullableNumber(input) {
  if (input === "" || input === null || input === undefined) return null;
  const parsed = numberValue(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(input) {
  if (!input) return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input.toISOString().slice(0, 10);
  const text = cleanText(input);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  return text;
}

function mapByKeys(rows, keys) {
  const map = new Map();
  rows.forEach((item) => {
    keys.forEach((key) => {
      const current = item[key];
      if (current !== undefined && current !== null && String(current).trim() !== "") {
        map.set(String(current).trim().toLowerCase(), item.id);
      }
    });
  });
  return map;
}

async function getDefaultCurrencyId(connection) {
  const [[configured]] = await connection.query(
    `SELECT moneda_id
     FROM configuracion_posventa_monedas
     WHERE is_active = 1
     ORDER BY id ASC
     LIMIT 1`
  );
  if (configured?.moneda_id) return Number(configured.moneda_id);
  const [[fallback]] = await connection.query(
    `SELECT id
     FROM configuracion_monedas
     WHERE is_active = 1
     ORDER BY codigo ASC
     LIMIT 1`
  );
  return fallback?.id ? Number(fallback.id) : null;
}

async function getTaxFactor(connection) {
  const [[tax]] = await connection.query(
    `SELECT porcentaje
     FROM configuracion_impuestos
     WHERE is_active = 1
     ORDER BY id ASC
     LIMIT 1`
  );
  const percentage = Number(tax?.porcentaje || 0) || 18;
  return 1 + percentage / 100;
}

async function recalcProductStock(connection, productoId) {
  const [[stock]] = await connection.query(
    `SELECT COALESCE(SUM(stock_lote), 0) AS total,
            COALESCE(SUM(stock_usado), 0) AS usado,
            COALESCE(SUM(stock_disponible), 0) AS disponible,
            CASE
              WHEN COALESCE(SUM(stock_lote), 0) > 0
                THEN COALESCE(SUM((precio_compra * COALESCE(NULLIF(tipo_cambio, 0), 1)) * stock_lote), 0) / SUM(stock_lote)
              ELSE 0
            END AS precio_compra_medio
     FROM posventa_productos_lotes
     WHERE producto_id = ?`,
    [productoId]
  );
  await connection.query(
    `UPDATE posventa_productos
     SET stock_total = ?, stock_usado = ?, stock_disponible = ?, precio_compra = ?
     WHERE id = ?`,
    [
      Number(stock.total || 0),
      Number(stock.usado || 0),
      Number(stock.disponible || 0),
      Number(stock.precio_compra_medio || 0),
      productoId,
    ]
  );
}

export async function POST(request) {
  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) {
      return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });
    }

    const [typeRows] = await connection.query(`SELECT id, nombre FROM configuracion_inventario_tipo`);
    const [currencyRows] = await connection.query(`SELECT id, codigo, nombre, simbolo FROM configuracion_monedas`);
    const [measureRows] = await connection.query(`SELECT id, nombre, abreviatura FROM configuracion_tipos_medida`);
    const [providerRows] = await connection.query(
      `SELECT id, razon_social, nombre_comercial, ruc
       FROM administracion_proveedores
       WHERE is_active = 1`
    );
    const typeMap = new Map(typeRows.map((item) => [String(item.nombre || "").trim().toLowerCase(), item.id]));
    const currencyMap = new Map();
    currencyRows.forEach((item) => {
      [item.codigo, item.nombre, item.simbolo, item.id].forEach((key) => {
        if (key !== undefined && key !== null && String(key).trim() !== "") {
          currencyMap.set(String(key).trim().toLowerCase(), item.id);
        }
      });
    });
    const measureMap = mapByKeys(measureRows, ["nombre", "abreviatura", "id"]);
    const providerMap = mapByKeys(providerRows, ["razon_social", "nombre_comercial", "ruc", "id"]);
    const defaultCurrencyId = await getDefaultCurrencyId(connection);
    const taxFactor = await getTaxFactor(connection);

    let imported = 0;
    let updated = 0;
    let lotsImported = 0;
    let lotsUpdated = 0;
    const errors = [];
    const touchedProducts = new Set();

    await connection.beginTransaction();
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const numeroParte = cleanText(value(row, ["numero_parte", "Numero Parte", "NUMERO DE PARTE", "N Parte", "numeroParte"]));
      const descripcionExcel = cleanText(value(row, ["DESCRIPCION"]));
      const descripcion = cleanText(value(row, ["descripcion", "Descripcion", "Descripción"]));
      const marca = cleanText(value(row, ["marca", "Marca"])) || null;
      const procedencia = cleanText(value(row, ["procedencia", "Procedencia", "PROCEDENCIA"])) || null;
      if (!numeroParte || !(descripcion || descripcionExcel)) {
        errors.push(`Fila ${index + 2}: numero_parte y descripcion son obligatorios.`);
        continue;
      }

      const tipoRaw = cleanText(value(row, ["tipo_inventario", "Tipo Inventario", "TIPO INVENTARIO", "tipoId", "tipo_id"]));
      const monedaRaw = cleanText(value(row, ["moneda", "Moneda", "monedaId", "moneda_id"]));
      const tipoId = tipoRaw ? Number(tipoRaw) || typeMap.get(tipoRaw.toLowerCase()) || null : null;
      const monedaId = monedaRaw ? Number(monedaRaw) || currencyMap.get(monedaRaw.toLowerCase()) || defaultCurrencyId : defaultCurrencyId;
      const fechaIngreso = dateValue(value(row, ["fecha_ingreso", "Fecha Ingreso", "FECHA INGRESO", "fechaIngreso"]));
      const stockTotal = numberValue(value(row, ["stock_total", "Stock Total", "stockTotal", "stock_lote", "Stock Lote", "STOCK LOTE"]));
      const precioCompra = numberValue(value(row, ["precio_compra", "Precio Compra", "PRECIO DE COMPRA", "PRECIO DE COMPRA (SIN IGV)", "precioCompra"]));
      const precioVentaConIgvInput = nullableNumber(value(row, ["precio_venta_con_igv", "Precio Venta Con IGV", "PRECIO VENTA CON IGV", "precio_venta", "Precio Venta", "precioVenta"]));
      const precioVentaSinIgv = nullableNumber(value(row, ["precio_venta_sin_igv", "Precio Venta Sin IGV", "PRECIO VENTA SIN IGV"]));
      const precioVentaConIgv = precioVentaSinIgv !== null ? Number((precioVentaSinIgv * taxFactor).toFixed(2)) : precioVentaConIgvInput;
      const margenComercial = nullableNumber(value(row, ["margen_comercial", "Margen Comercial", "MARGEN COMERCIAL", "MARGEN COMERCIAL (%)", "margen"]));
      const numeroFactura = cleanText(value(row, ["numero_comprobante", "Numero Comprobante", "NUMERO DE COMPROBANTE", "numero_factura", "Numero Factura", "NUMERO DE FACTURA"]));
      const tipoMedidaRaw = cleanText(value(row, ["unidad_medida", "Unidad Medida", "UNIDAD DE MEDIDA", "tipo_medida", "Tipo Medida"]));
      const proveedorRaw = cleanText(value(row, ["proveedor", "Proveedor", "PROVEEDOR"]));
      const fechaVencimiento = dateValue(value(row, ["fecha_vencimiento", "Fecha Vencimiento", "FECHA DE VENCIMIENTO", "FEHCHA DE VENCIMIENTO"]));
      const stockLote = numberValue(value(row, ["stock_lote", "Stock Lote", "STOCK LOTE", "stock_total", "Stock Total", "stockTotal"]));
      const tipoCambio = nullableNumber(value(row, ["tipo_cambio", "Tipo Cambio"]));
      const tipoMedidaId = tipoMedidaRaw ? Number(tipoMedidaRaw) || measureMap.get(tipoMedidaRaw.toLowerCase()) || null : null;
      const proveedorId = proveedorRaw ? Number(proveedorRaw) || providerMap.get(proveedorRaw.toLowerCase()) || null : null;
      const hasLotData = Boolean(numeroFactura || tipoMedidaRaw || proveedorRaw || fechaVencimiento || stockLote || precioCompra);

      const [existingRows] = await connection.query(`SELECT id FROM posventa_productos WHERE numero_parte = ? LIMIT 1`, [numeroParte]);
      let productoId = existingRows[0]?.id || null;
      if (existingRows.length) {
        await connection.query(
          `UPDATE posventa_productos
           SET descripcion = ?, tipo_inventario_id = ?, fecha_ingreso = ?, marca = ?, procedencia = ?,
               precio_venta = COALESCE(?, precio_venta), moneda_id = COALESCE(?, moneda_id)
           WHERE id = ?`,
          [descripcion || descripcionExcel, tipoId, fechaIngreso, marca, procedencia, precioVentaConIgv, monedaId, productoId]
        );
        updated += 1;
      } else {
        const [insertResult] = await connection.query(
          `INSERT INTO posventa_productos
           (numero_parte, descripcion, marca, procedencia, tipo_inventario_id, fecha_ingreso, stock_total, stock_usado, stock_disponible, precio_compra, precio_venta, moneda_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
          [numeroParte, descripcion || descripcionExcel, marca, procedencia, tipoId, fechaIngreso, hasLotData ? 0 : stockTotal, hasLotData ? 0 : stockTotal, precioVentaConIgv || 0, monedaId]
        );
        productoId = insertResult.insertId;
        imported += 1;
      }

      if (!hasLotData) continue;

      if (!tipoMedidaId) {
        errors.push(`Fila ${index + 2}: unidad de medida es obligatoria para crear lote.`);
        continue;
      }
      if (monedaId && defaultCurrencyId && Number(monedaId) !== Number(defaultCurrencyId) && (!tipoCambio || tipoCambio <= 0)) {
        errors.push(`Fila ${index + 2}: tipo de cambio obligatorio cuando la moneda es diferente a la moneda activa.`);
        continue;
      }

      const [existingLotRows] = await connection.query(
        `SELECT id, stock_usado FROM posventa_productos_lotes WHERE producto_id = ? AND numero_factura = ? LIMIT 1`,
        [productoId, numeroFactura]
      );

      if (existingLotRows.length) {
        const used = Number(existingLotRows[0].stock_usado || 0);
        await connection.query(
          `UPDATE posventa_productos_lotes
           SET tipo_medida_id = ?, proveedor_id = ?, fecha_vencimiento = ?, precio_compra = ?,
               moneda_id = ?, tipo_cambio = ?, margen_comercial = ?, precio_venta_sin_igv = ?,
               precio_venta_con_igv = ?, stock_lote = ?, stock_disponible = GREATEST(? - ?, 0)
           WHERE id = ?`,
          [
            tipoMedidaId,
            proveedorId,
            fechaVencimiento,
            precioCompra,
            monedaId,
            tipoCambio,
            margenComercial,
            precioVentaSinIgv,
            precioVentaConIgv,
            stockLote,
            stockLote,
            used,
            existingLotRows[0].id,
          ]
        );
        lotsUpdated += 1;
      } else {
        await connection.query(
          `INSERT INTO posventa_productos_lotes
           (producto_id, tipo_medida_id, proveedor_id, numero_factura, fecha_vencimiento, precio_compra, moneda_id, tipo_cambio,
            margen_comercial, precio_venta_sin_igv, precio_venta_con_igv, stock_lote, stock_usado, stock_disponible, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            productoId,
            tipoMedidaId,
            proveedorId,
            numeroFactura,
            fechaVencimiento,
            precioCompra,
            monedaId,
            tipoCambio,
            margenComercial,
            precioVentaSinIgv,
            precioVentaConIgv,
            stockLote,
            stockLote,
            user?.id || null,
          ]
        );
        lotsImported += 1;
      }

      if (precioVentaConIgv !== null) {
        await connection.query(
          `UPDATE posventa_productos SET precio_venta = ?, moneda_id = COALESCE(?, moneda_id) WHERE id = ?`,
          [precioVentaConIgv, monedaId, productoId]
        );
      }
      touchedProducts.add(productoId);
    }

    for (const productoId of touchedProducts) {
      await recalcProductStock(connection, productoId);
    }

    if (errors.length && !imported && !updated) {
      await connection.rollback();
      return NextResponse.json({ message: errors[0], errors }, { status: 400 });
    }

    await connection.commit();
    return NextResponse.json({ imported, updated, lotsImported, lotsUpdated, errors });
  } catch (error) {
    await connection.rollback();
    console.error("Error importing post inventory products:", error);
    return NextResponse.json({ message: "No se pudo importar productos." }, { status: 500 });
  } finally {
    connection.release();
  }
}
