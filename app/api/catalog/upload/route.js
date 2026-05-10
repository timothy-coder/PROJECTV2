import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm", "video/ogg", "video/quicktime"]);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") return NextResponse.json({ message: "Archivo invalido." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ message: "Solo se permiten imagenes o videos." }, { status: 400 });

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
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  if (type === "video/mp4") return ".mp4";
  if (type === "video/webm") return ".webm";
  if (type === "video/ogg") return ".ogg";
  if (type === "video/quicktime") return ".mov";
  return ".png";
}
