import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

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

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!hasPerm(user?.permissions || {}, ["proveedores", "edit"])) {
      return NextResponse.json({ message: "No tienes permiso para editar proveedores." }, { status: 403 });
    }

    const routeParams = await params;
    const id = Number(routeParams.id);
    const payload = normalizeProvider(await request.json());
    if (!id) return NextResponse.json({ message: "Proveedor invalido." }, { status: 400 });
    if (!payload.razonSocial) return NextResponse.json({ message: "La razon social es obligatoria." }, { status: 400 });

    const [result] = await pool.query(
      `UPDATE administracion_proveedores
       SET razon_social = ?, nombre_comercial = ?, ruc = ?, contacto_nombre = ?,
           contacto_telefono = ?, contacto_email = ?, direccion = ?, is_active = ?
       WHERE id = ?`,
      [
        payload.razonSocial,
        payload.nombreComercial,
        payload.ruc,
        payload.contactoNombre,
        payload.contactoTelefono,
        payload.contactoEmail,
        payload.direccion,
        payload.isActive ? 1 : 0,
        id,
      ]
    );

    if (!result.affectedRows) return NextResponse.json({ message: "Proveedor no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating provider:", error);
    return NextResponse.json({ message: duplicateMessage(error) || "No se pudo actualizar el proveedor." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!hasPerm(user?.permissions || {}, ["proveedores", "delete"])) {
      return NextResponse.json({ message: "No tienes permiso para eliminar proveedores." }, { status: 403 });
    }

    const routeParams = await params;
    const id = Number(routeParams.id);
    if (!id) return NextResponse.json({ message: "Proveedor invalido." }, { status: 400 });

    const [result] = await pool.query(`DELETE FROM administracion_proveedores WHERE id = ?`, [id]);
    if (!result.affectedRows) return NextResponse.json({ message: "Proveedor no encontrado." }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting provider:", error);
    return NextResponse.json({ message: "No se pudo eliminar el proveedor." }, { status: 500 });
  }
}
