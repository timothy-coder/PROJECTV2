import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg"]);

function extensionFor(type) {
  if (type === "image/jpeg") return ".jpg";
  return ".png";
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    const permissions = user.permissions || {};
    const canUpload =
      hasPerm(permissions, ["configuracion_datos_fiscales_punto", "create"]) ||
      hasPerm(permissions, ["configuracion_datos_fiscales_punto", "edit"]);
    if (!canUpload) return NextResponse.json({ message: "No tienes permiso para subir logo." }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") return NextResponse.json({ message: "Archivo invalido." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ message: "Solo se permiten imagenes JPG, JPEG o PNG." }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > 5 * 1024 * 1024) return NextResponse.json({ message: "El logo no puede superar 5 MB." }, { status: 400 });

    const filename = `${Date.now()}-${crypto.randomUUID()}${extensionFor(file.type)}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "datos-fiscales");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), bytes);

    return NextResponse.json({ path: `/uploads/datos-fiscales/${filename}` });
  } catch (error) {
    console.error("Error uploading fiscal logo:", error);
    return NextResponse.json({ message: "No se pudo subir el logo." }, { status: 500 });
  }
}
