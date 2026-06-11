import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { pool } from "@/lib/db";
import { decodeSpecValue, encodeSpecValue } from "@/app/api/catalog/valueUtils";

function payload(body) {
  return {
    groupId: Number(body.groupId),
    clave: String(body.clave || "").trim(),
    valor: encodeSpecValue(body),
    orden: Number(body.orden || 0),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
}

function catalogUploadFilePath(value) {
  const cleanPath = String(value || "").trim();
  if (!cleanPath.startsWith("/uploads/catalogo/")) return null;
  const filename = path.basename(cleanPath);
  if (!filename || filename !== cleanPath.split("/").pop()) return null;
  return path.join(process.cwd(), "public", "uploads", "catalogo", filename);
}

async function deleteCatalogUploadIfUnused(connection, value) {
  const filePath = catalogUploadFilePath(value);
  if (!filePath) return;
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count FROM ventas_precio_specs_item WHERE valor LIKE ?`,
    [`%${value}%`]
  );
  if (Number(rows?.[0]?.count || 0) > 0) return;
  await unlink(filePath).catch((error) => {
    if (error?.code !== "ENOENT") console.warn("No se pudo eliminar archivo de catalogo:", error);
  });
}

export async function PUT(request, { params }) {
  const connection = await pool.getConnection();
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await request.json();
    const data = payload(body);
    if (!id || !data.groupId || !data.clave) return NextResponse.json({ message: "Especificacion invalida." }, { status: 400 });
    const [[current]] = await connection.query(`SELECT valor FROM ventas_precio_specs_item WHERE id=? LIMIT 1`, [id]);
    const oldPath = decodeSpecValue(current?.valor).valorPath;
    const newPath = String(body.valorPath || "").trim();
    await connection.query(`UPDATE ventas_precio_specs_item SET group_id=?, clave=?, valor=?, orden=?, is_active=? WHERE id=?`, [data.groupId, data.clave, data.valor, data.orden, data.isActive ? 1 : 0, id]);
    if (oldPath && oldPath !== newPath) await deleteCatalogUploadIfUnused(connection, oldPath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating spec item:", error);
    return NextResponse.json({ message: "No se pudo actualizar la especificacion." }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function DELETE(_request, { params }) {
  const connection = await pool.getConnection();
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const [[current]] = await connection.query(`SELECT valor FROM ventas_precio_specs_item WHERE id=? LIMIT 1`, [id]);
    const oldPath = decodeSpecValue(current?.valor).valorPath;
    await connection.query(`DELETE FROM ventas_precio_specs_item WHERE id=?`, [id]);
    if (oldPath) await deleteCatalogUploadIfUnused(connection, oldPath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting spec item:", error);
    return NextResponse.json({ message: "No se pudo eliminar la especificacion." }, { status: 500 });
  } finally {
    connection.release();
  }
}
