import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

function mapProvider(row) {
  return {
    id: Number(row.id),
    razonSocial: row.razon_social || "",
    nombreComercial: row.nombre_comercial || "",
    ruc: row.ruc || "",
    contactoNombre: row.contacto_nombre || "",
    contactoTelefono: row.contacto_telefono || "",
    contactoEmail: row.contacto_email || "",
    direccion: row.direccion || "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeProvider(body) {
  return {
    razonSocial: String(body.razonSocial || "").trim(),
    nombreComercial: String(body.nombreComercial || "").trim() || null,
    ruc: String(body.ruc || "").trim() || null,
    contactoNombre: String(body.contactoNombre || "").trim() || null,
    contactoTelefono: String(body.contactoTelefono || "").trim() || null,
    contactoEmail: String(body.contactoEmail || "").trim() || null,
    direccion: String(body.direccion || "").trim() || null,
    isActive: body.isActive !== false,
  };
}

function duplicateMessage(error) {
  if (error?.code === "ER_DUP_ENTRY") return "Ya existe un proveedor registrado con ese RUC.";
  return null;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!hasPerm(user?.permissions || {}, ["proveedores", "view"])) {
      return NextResponse.json({ message: "No tienes permiso para ver proveedores." }, { status: 403 });
    }

    const [rows] = await pool.query(
      `SELECT id, razon_social, nombre_comercial, ruc, contacto_nombre, contacto_telefono,
              contacto_email, direccion, is_active, created_at, updated_at
       FROM administracion_proveedores
       ORDER BY razon_social ASC`
    );

    return NextResponse.json({ providers: rows.map(mapProvider) });
  } catch (error) {
    console.error("Error loading providers:", error);
    return NextResponse.json({ message: "No se pudieron cargar los proveedores." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!hasPerm(user?.permissions || {}, ["proveedores", "create"])) {
      return NextResponse.json({ message: "No tienes permiso para crear proveedores." }, { status: 403 });
    }

    const payload = normalizeProvider(await request.json());
    if (!payload.razonSocial) {
      return NextResponse.json({ message: "La razon social es obligatoria." }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO administracion_proveedores
       (razon_social, nombre_comercial, ruc, contacto_nombre, contacto_telefono, contacto_email, direccion, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.razonSocial,
        payload.nombreComercial,
        payload.ruc,
        payload.contactoNombre,
        payload.contactoTelefono,
        payload.contactoEmail,
        payload.direccion,
        payload.isActive ? 1 : 0,
      ]
    );

    return NextResponse.json({ ok: true, id: Number(result.insertId) }, { status: 201 });
  } catch (error) {
    console.error("Error creating provider:", error);
    return NextResponse.json({ message: duplicateMessage(error) || "No se pudo crear el proveedor." }, { status: 500 });
  }
}
