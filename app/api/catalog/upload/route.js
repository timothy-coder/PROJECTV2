import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { hasPerm } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/getCurrentUser";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/ogg", "video/quicktime"]);

function canUpload(user) {
  const permissions = user?.permissions || {};
  return hasPerm(permissions, ["catalogoventa", "create"]) || hasPerm(permissions, ["catalogoventa", "edit"]) || hasPerm(permissions, ["catalogoventa", "import"]);
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (!canUpload(user)) return NextResponse.json({ message: "No tienes permiso para subir archivos al catalogo." }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") || "IMAGEN").toUpperCase();
    if (!file || typeof file === "string") return NextResponse.json({ message: "Archivo invalido." }, { status: 400 });
    if (kind === "IMAGEN" && !ALLOWED_IMAGE_TYPES.has(file.type)) return NextResponse.json({ message: "Solo se permiten imagenes JPG, JPEG o PNG." }, { status: 400 });
    if (kind === "VIDEO" && !ALLOWED_VIDEO_TYPES.has(file.type)) return NextResponse.json({ message: "Solo se permiten videos MP4, WEBM, OGG o MOV." }, { status: 400 });
    if (!["IMAGEN", "VIDEO"].includes(kind)) return NextResponse.json({ message: "Tipo de archivo invalido." }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > 25 * 1024 * 1024) return NextResponse.json({ message: "El archivo no puede superar 25 MB." }, { status: 400 });

    const filename = `${Date.now()}-${crypto.randomUUID()}${extensionFor(file.type)}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "catalogo");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), bytes);

    return NextResponse.json({ path: `/uploads/catalogo/${filename}` });
  } catch (error) {
    console.error("Error uploading catalog file:", error);
    return NextResponse.json({ message: "No se pudo subir el archivo." }, { status: 500 });
  }
}

function extensionFor(type) {
  if (type === "image/jpeg") return ".jpg";
  if (type === "video/mp4") return ".mp4";
  if (type === "video/webm") return ".webm";
  if (type === "video/ogg") return ".ogg";
  if (type === "video/quicktime") return ".mov";
  return ".png";
}
