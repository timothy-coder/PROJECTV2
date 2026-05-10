import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(request) {
  const user = await getCurrentUser();
  if (!hasPerm(user?.permissions || {}, ["configagenda", "edit"])) {
    const permissions = user?.permissions || {};
    if (!hasPerm(permissions, ["config_ventas_plantillas", "edit"]) && !hasPerm(permissions, ["configagenda", "edit"])) {
      return NextResponse.json({ message: "No tienes permiso para subir imagenes." }, { status: 403 });
    }
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") return NextResponse.json({ message: "Archivo invalido." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ message: "Solo se permiten imagenes PNG, JPG, WEBP o GIF." }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > 5 * 1024 * 1024) return NextResponse.json({ message: "La imagen no puede superar 5 MB." }, { status: 400 });

    const ext = extensionFor(file.type);
    const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "ventas-plantillas");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), bytes);

    return NextResponse.json({ path: `/uploads/ventas-plantillas/${filename}` });
  } catch (error) {
    console.error("Error uploading sales template image:", error);
    return NextResponse.json({ message: "No se pudo subir la imagen." }, { status: 500 });
  }
}

function extensionFor(type) {
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  return ".png";
}
