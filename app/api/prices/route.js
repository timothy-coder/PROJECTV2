import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [maintenanceRows] = await pool.query(
      `SELECT id, name FROM posventa_mantenimiento WHERE is_active = 1 ORDER BY name ASC`
    );
    const [subRows] = await pool.query(
      `SELECT id, name, posventamantenimiento_id
       FROM posventa_submantenimiento
       WHERE is_active = 1
       ORDER BY posventamantenimiento_id ASC, name ASC`
    );
    const [modelRows] = await pool.query(
      `SELECT mo.id, mo.name, mo.marca_id, mo.clase_id,
              ma.name AS marca_name, cl.name AS clase_name
       FROM administracion_modelos mo
       INNER JOIN administracion_marcas ma ON ma.id = mo.marca_id
       LEFT JOIN administracion_clases cl ON cl.id = mo.clase_id
       ORDER BY ma.name ASC, mo.name ASC`
    );
    const [priceRows] = await pool.query(
      `SELECT id, mantenimiento_id, submantenimiento_id, marca_id, modelo_id, precio
       FROM posventa_precios`
    );

    return NextResponse.json({
      maintenances: maintenanceRows.map((row) => ({ id: row.id, name: row.name })),
      submaintenances: subRows.map((row) => ({
        id: row.id,
        name: row.name,
        mantenimientoId: row.posventamantenimiento_id,
      })),
      models: modelRows.map((row) => ({
        id: row.id,
        name: row.name,
        marcaId: row.marca_id,
        marcaName: row.marca_name,
        claseId: row.clase_id,
        claseName: row.clase_name || "Sin clase",
      })),
      prices: priceRows.map((row) => ({
        id: row.id,
        mantenimientoId: row.mantenimiento_id,
        submantenimientoId: row.submantenimiento_id,
        marcaId: row.marca_id,
        modeloId: row.modelo_id,
        precio: Number(row.precio),
      })),
    });
  } catch (error) {
    console.error("Error loading prices:", error);
    return NextResponse.json({ message: "No se pudieron cargar precios." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const mantenimientoId = Number(body.mantenimientoId);
    const submantenimientoId = Number(body.submantenimientoId);
    const marcaId = Number(body.marcaId);
    const modeloId = Number(body.modeloId);
    const precio = Number(body.precio || 0);

    if (!mantenimientoId || !submantenimientoId || !marcaId || !modeloId || Number.isNaN(precio)) {
      return NextResponse.json({ message: "Precio invalido." }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO posventa_precios (mantenimiento_id, submantenimiento_id, marca_id, modelo_id, precio)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE precio = VALUES(precio)`,
      [mantenimientoId, submantenimientoId, marcaId, modeloId, precio]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving price:", error);
    return NextResponse.json({ message: "No se pudo guardar el precio." }, { status: 500 });
  }
}
