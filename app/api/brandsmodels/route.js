import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

function parseJson(value, fallback = []) {
  if (!value) return fallback;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const [brandsRows] = await pool.query(
      `SELECT id, name, image_url, created_at FROM administracion_marcas ORDER BY name ASC`
    );
    const [classesRows] = await pool.query(
      `SELECT id, name, created_at, updated_at FROM administracion_clases ORDER BY name ASC`
    );
    const [modelsRows] = await pool.query(
      `SELECT m.id, m.marca_id, m.clase_id, m.name, m.anios, m.created_at,
              b.name AS marca_name, c.name AS clase_name
       FROM administracion_modelos m
       LEFT JOIN administracion_marcas b ON b.id = m.marca_id
       LEFT JOIN administracion_clases c ON c.id = m.clase_id
       ORDER BY m.name ASC`
    );
    const [maintenanceRows] = await pool.query(
      `SELECT a.id, a.modelo_id, a.marca_id, a.kilometraje, a.meses, a.anios,
              m.name AS modelo_name, b.name AS marca_name
       FROM administracion_algoritmo_visita a
       LEFT JOIN administracion_modelos m ON m.id = a.modelo_id
       LEFT JOIN administracion_marcas b ON b.id = a.marca_id
       ORDER BY b.name ASC, m.name ASC`
    );

    const models = modelsRows.map((row) => ({
      id: row.id,
      marcaId: row.marca_id,
      marcaName: row.marca_name || "",
      claseId: row.clase_id,
      claseName: row.clase_name || "",
      name: row.name,
      anios: parseJson(row.anios),
      createdAt: row.created_at,
    }));
    const brands = brandsRows.map((row) => ({
      id: row.id,
      name: row.name,
      imageUrl: row.image_url || "",
      createdAt: row.created_at,
      models: models.filter((model) => model.marcaId === row.id),
    }));
    const classes = classesRows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    const maintenance = maintenanceRows.map((row) => ({
      id: Number(row.id),
      modeloId: row.modelo_id,
      marcaId: row.marca_id,
      modeloName: row.modelo_name || "",
      marcaName: row.marca_name || "",
      kilometraje: Number(row.kilometraje),
      meses: row.meses,
      anios: parseJson(row.anios),
    }));

    return NextResponse.json({ brands, models, classes, maintenance });
  } catch (error) {
    console.error("Error loading brands/models:", error);
    return NextResponse.json({ message: "No se pudieron cargar marcas y modelos." }, { status: 500 });
  }
}
