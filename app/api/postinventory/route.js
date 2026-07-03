import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function mapStock(row) {
  return {
    id: row.id,
    productoId: row.producto_id,
    loteId: row.lote_id,
    loteLabel: `Lote ${row.lote_id}`,
    numeroParte: row.numero_parte || "",
    descripcion: row.descripcion || "",
    anaquelId: row.anaquel_id,
    nivelId: row.nivel_id,
    posicionId: row.posicion_id,
    anaquelCodigo: row.anaquel_codigo || "",
    anaquelDescripcion: row.anaquel_descripcion || "",
    nivelCodigo: row.codigo_nivel || "",
    posicion: row.posicion || "",
    tallerName: row.taller_name || "",
    mostradorName: row.mostrador_name || "",
    stock: Number(row.cantidad || 0),
    createdAt: row.created_at,
  };
}

function mapCombo(row, items) {
  const comboItems = items.filter((item) => item.comboId === row.id);
  return {
    id: row.id,
    codigo: row.codigo || "",
    nombre: row.nombre,
    descripcion: row.descripcion || "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: comboItems,
    itemCount: comboItems.length,
    totalCantidad: comboItems.reduce((sum, item) => sum + Number(item.cantidad || 0), 0),
  };
}

function mapSoldProduct(row) {
  return {
    id: row.id,
    productoId: row.producto_id,
    anio: Number(row.anio || 0),
    mes: Number(row.mes || 0),
    cantidad: Number(row.cantidad || 0),
    numeroParte: row.numero_parte || "",
    descripcion: row.descripcion || "",
  };
}

export async function GET() {
  try {
    const [productRows] = await pool.query(
      `SELECT p.id, p.numero_parte, p.descripcion, p.tipo_inventario_id, p.fecha_ingreso,
              p.stock_total, p.stock_usado, p.stock_disponible,
              p.precio_compra, p.precio_venta, p.moneda_id,
              t.nombre AS tipo_nombre,
              m.codigo AS moneda_codigo, m.nombre AS moneda_nombre, m.simbolo AS moneda_simbolo
       FROM posventa_productos p
       LEFT JOIN configuracion_inventario_tipo t ON t.id = p.tipo_inventario_id
       LEFT JOIN configuracion_monedas m ON m.id = p.moneda_id
       ORDER BY p.numero_parte ASC`
    );
    const [stockRows] = await pool.query(
      `SELECT u.id, u.lote_id, u.anaquel_id, u.nivel_id, u.posicion_id, u.cantidad, u.created_at,
              l.producto_id,
              p.numero_parte, p.descripcion,
              a.codigo AS anaquel_codigo, a.descripcion AS anaquel_descripcion,
              n.codigo_nivel, po.posicion,
              ta.nombre AS taller_name, mo.nombre AS mostrador_name
       FROM posventa_lotes_ubicaciones u
       INNER JOIN posventa_productos_lotes l ON l.id = u.lote_id
       INNER JOIN posventa_productos p ON p.id = l.producto_id
       INNER JOIN almacen_anaqueles a ON a.id = u.anaquel_id
       LEFT JOIN almacen_anaquel_niveles n ON n.id = u.nivel_id
       LEFT JOIN almacen_nivel_posiciones po ON po.id = u.posicion_id
       LEFT JOIN configuracion_talleres ta ON ta.id = a.taller_id
       LEFT JOIN configuracion_mostradores mo ON mo.id = a.mostrador_id
       ORDER BY u.created_at DESC`
    );
    const [typeRows] = await pool.query(
      `SELECT id, nombre FROM configuracion_inventario_tipo ORDER BY nombre ASC`
    );
    const [currencyRows] = await pool.query(
      `SELECT id, codigo, nombre, simbolo, is_active
       FROM configuracion_monedas
       WHERE is_active = 1
       ORDER BY codigo ASC`
    );
    const [centerRows] = await pool.query(
      `SELECT id, nombre FROM configuracion_centros ORDER BY nombre ASC`
    );
    const [workshopRows] = await pool.query(
      `SELECT id, centro_id, nombre FROM configuracion_talleres ORDER BY nombre ASC`
    );
    const [counterRows] = await pool.query(
      `SELECT id, centro_id, nombre FROM configuracion_mostradores ORDER BY nombre ASC`
    );
    const [lotRows] = await pool.query(
      `SELECT l.id, l.producto_id, p.numero_parte, p.descripcion
       FROM posventa_productos_lotes l
       INNER JOIN posventa_productos p ON p.id = l.producto_id
       ORDER BY p.numero_parte ASC, l.id DESC`
    );
    const [shelfRows] = await pool.query(
      `SELECT a.id, a.codigo, a.descripcion, a.taller_id, a.mostrador_id,
              ta.nombre AS taller_name, mo.nombre AS mostrador_name
       FROM almacen_anaqueles a
       LEFT JOIN configuracion_talleres ta ON ta.id = a.taller_id
       LEFT JOIN configuracion_mostradores mo ON mo.id = a.mostrador_id
       WHERE a.activo = 1
       ORDER BY a.codigo ASC`
    );
    const [shelfLevelRows] = await pool.query(
      `SELECT id, anaquel_id, codigo_nivel, orden_nivel
       FROM almacen_anaquel_niveles
       WHERE activo = 1
       ORDER BY orden_nivel ASC`
    );
    const [shelfPositionRows] = await pool.query(
      `SELECT id, nivel_id, posicion
       FROM almacen_nivel_posiciones
       WHERE activo = 1
       ORDER BY posicion ASC`
    );
    const [comboRows] = await pool.query(
      `SELECT id, codigo, nombre, descripcion, is_active, created_at, updated_at
       FROM posventa_combos
       ORDER BY nombre ASC`
    );
    const [comboItemRows] = await pool.query(
      `SELECT ci.id, ci.combo_id, ci.producto_id, ci.cantidad, ci.created_at,
              p.numero_parte, p.descripcion
       FROM posventa_combo_items ci
       INNER JOIN posventa_productos p ON p.id = ci.producto_id
       ORDER BY p.numero_parte ASC`
    );
    const [soldProductRows] = await pool.query(
      `SELECT v.id, v.producto_id, v.anio, v.mes, v.cantidad,
              p.numero_parte, p.descripcion
       FROM posventa_productos_ventames v
       INNER JOIN posventa_productos p ON p.id = v.producto_id
       ORDER BY v.anio DESC, v.mes DESC, p.numero_parte ASC`
    );

    const stocks = stockRows.map(mapStock);
    const products = productRows.map((row) => ({
      ...(() => {
        const productStocks = stocks.filter((stock) => stock.productoId === row.id);
        const used = productStocks.reduce((sum, stock) => sum + Number(stock.stock || 0), 0);
        const total = Number(row.stock_total || 0);
        return {
          stockUsado: used,
          stockDisponible: Math.max(total - used, 0),
          stock: productStocks,
        };
      })(),
      id: row.id,
      numeroParte: row.numero_parte,
      descripcion: row.descripcion,
      tipoId: row.tipo_inventario_id,
      tipoNombre: row.tipo_nombre || "Sin tipo",
      fechaIngreso: row.fecha_ingreso,
      stockTotal: Number(row.stock_total || 0),
      precioCompra: Number(row.precio_compra || 0),
      precioVenta: Number(row.precio_venta || 0),
      monedaId: row.moneda_id,
      monedaCodigo: row.moneda_codigo || "",
      monedaNombre: row.moneda_nombre || "",
      monedaSimbolo: row.moneda_simbolo || "S/",
    }));
    const comboItems = comboItemRows.map((row) => ({
      id: row.id,
      comboId: row.combo_id,
      productoId: row.producto_id,
      cantidad: Number(row.cantidad || 0),
      numeroParte: row.numero_parte,
      descripcion: row.descripcion,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      products,
      combos: comboRows.map((row) => mapCombo(row, comboItems)),
      soldProducts: soldProductRows.map(mapSoldProduct),
      stocks,
      options: {
        types: typeRows.map((row) => ({ id: row.id, nombre: row.nombre })),
        currencies: currencyRows.map((row) => ({ id: row.id, codigo: row.codigo, nombre: row.nombre, simbolo: row.simbolo })),
        centers: centerRows.map((row) => ({ id: row.id, nombre: row.nombre })),
        workshops: workshopRows.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
        counters: counterRows.map((row) => ({ id: row.id, centroId: row.centro_id, nombre: row.nombre })),
        lots: lotRows.map((row) => ({ id: row.id, productoId: row.producto_id, numeroParte: row.numero_parte, descripcion: row.descripcion, label: `${row.numero_parte} - Lote ${row.id}` })),
        shelves: shelfRows.map((row) => ({ id: row.id, codigo: row.codigo, descripcion: row.descripcion || "", tallerId: row.taller_id, mostradorId: row.mostrador_id, tallerName: row.taller_name || "", mostradorName: row.mostrador_name || "" })),
        shelfLevels: shelfLevelRows.map((row) => ({ id: row.id, anaquelId: row.anaquel_id, codigoNivel: row.codigo_nivel, ordenNivel: row.orden_nivel })),
        shelfPositions: shelfPositionRows.map((row) => ({ id: row.id, nivelId: row.nivel_id, posicion: row.posicion })),
      },
    });
  } catch (error) {
    console.error("Error loading post inventory:", error);
    return NextResponse.json({ message: "No se pudo cargar inventario." }, { status: 500 });
  }
}
