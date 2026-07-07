import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function clean(value) {
  return String(value ?? "").trim();
}

function value(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return "";
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
    const priceIds = new Set(priceRows.map((row) => Number(row.id)));
    const brands = new Set(priceRows.map((row) => normalize(row.marca_name)).filter(Boolean));
    const modelsByBrand = new Map();
    const modelLabelsByBrand = new Map();
    const versionsByVehicle = new Map();
    const versionLabelsByVehicle = new Map();
    priceRows.forEach((row) => {
      const brand = normalize(row.marca_name);
      const model = normalize(row.modelo_name);
      const version = normalize(row.version);
      const brandModels = modelsByBrand.get(brand) || new Set();
      brandModels.add(model);
      modelsByBrand.set(brand, brandModels);
      const brandModelLabels = modelLabelsByBrand.get(brand) || new Set();
      brandModelLabels.add(row.modelo_name);
      modelLabelsByBrand.set(brand, brandModelLabels);
      const vehicleVersions = versionsByVehicle.get(`${brand}:${model}`) || new Set();
      vehicleVersions.add(version);
      versionsByVehicle.set(`${brand}:${model}`, vehicleVersions);
      const vehicleVersionLabels = versionLabelsByVehicle.get(`${brand}:${model}`) || new Set();
      vehicleVersionLabels.add(row.version);
      versionLabelsByVehicle.set(`${brand}:${model}`, vehicleVersionLabels);
    });

    let imported = 0;
    let updated = 0;
    const errors = [];
    await connection.beginTransaction();

    for (const [index, row] of rows.entries()) {
      const vin = clean(value(row, ["vin", "VIN", "Vin"]));
      const marca = clean(value(row, ["marca", "Marca", "marcaName", "Marca Name", "marca_name"]));
      const modelo = clean(value(row, ["modelo", "Modelo", "modeloName", "Modelo Name", "modelo_name"]));
      const version = clean(value(row, ["version", "Version", "versión", "Versión"]));
      const rawPrecioId = Number(value(row, ["precio_id", "precioId", "Precio ID", "PrecioId"]));
      const invalidPrecioId = Boolean(rawPrecioId && !priceIds.has(rawPrecioId));
      const precioId = rawPrecioId || prices.get(`${normalize(marca)}:${normalize(modelo)}:${normalize(version)}`);

      if (!vin || !precioId || invalidPrecioId) {
        const rowErrors = [];
        if (!vin) rowErrors.push("VIN vacio o encabezado no reconocido");
        if (invalidPrecioId) rowErrors.push(`precio_id no existe: ${rawPrecioId}`);
        if (!marca) rowErrors.push("marca vacia o encabezado no reconocido");
        if (marca && !brands.has(normalize(marca))) rowErrors.push(`marca no encontrada: "${marca}"`);
        if (!modelo) rowErrors.push("modelo vacio o encabezado no reconocido");
        if (marca && modelo && !modelsByBrand.get(normalize(marca))?.has(normalize(modelo))) {
          const available = Array.from(modelLabelsByBrand.get(normalize(marca)) || []).slice(0, 6).join(", ");
          rowErrors.push(`modelo no encontrado para "${marca}": "${modelo}"${available ? `. Modelos disponibles: ${available}` : ""}`);
        }
        if (!version) rowErrors.push("version vacia o encabezado no reconocido");
        if (marca && modelo && version && !precioId) {
          const available = Array.from(versionLabelsByVehicle.get(`${normalize(marca)}:${normalize(modelo)}`) || []).slice(0, 6).join(", ");
          rowErrors.push(`version no encontrada para "${marca} ${modelo}": "${version}"${available ? `. Versiones disponibles: ${available}` : ""}`);
        }
        errors.push(`Fila ${index + 2}: ${rowErrors.join("; ")}. Leido: VIN="${vin || "-"}", marca="${marca || "-"}", modelo="${modelo || "-"}", version="${version || "-"}".`);
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
          nullable(value(row, ["color_externo", "colorExterno", "Color Externo"])),
          nullable(value(row, ["color_interno", "colorInterno", "Color Interno"])),
          nullable(value(row, ["numero_motor", "numeroMotor", "Numero Motor", "N Motor"])),
          nullable(value(row, ["numero_factura", "numeroFactura", "Numero Factura", "Factura"])),
          numberOrNull(value(row, ["precio_compra", "precioCompra", "Precio Compra"])),
          numberOrNull(value(row, ["precio_venta", "precioVenta", "Precio Venta"])),
          dateOrNull(value(row, ["facturacion_at", "facturacionAt", "Facturacion", "Fecha Facturacion"])),
          dateOrNull(value(row, ["llegada_centro_at", "llegadaCentroAt", "Llegada Centro", "Fecha Llegada Centro"])),
          dateOrNull(value(row, ["entrega_at", "entregaAt", "Entrega", "Fecha Entrega"])),
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
