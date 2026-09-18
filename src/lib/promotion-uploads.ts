import { uploadPhoto } from "./photo-storage";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { promotionStorePath } from "./promotion-store";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export class ImageUploadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function uploadDirectory(): string {
  return path.join(path.dirname(promotionStorePath()), "promotion-images");
}

/** Bound the body even when the client uses chunked transfer encoding. */
export async function readImageForm(request: Request): Promise<FormData> {
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) {
    throw new ImageUploadError("La imagen debe pesar como máximo 10 MB.", 413);
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data;")) {
    throw new ImageUploadError("Selecciona una imagen para subir.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ImageUploadError("No se recibió la imagen.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new ImageUploadError("La imagen debe pesar como máximo 10 MB.", 413);
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new ImageUploadError("No se pudo leer el archivo. Selecciónalo de nuevo.");
  }
}

export async function storePromotionImage(file: File) {
  if (!allowedTypes.has(file.type)) {
    throw new ImageUploadError("Usa una imagen JPG, PNG o WebP.", 415);
  }
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    throw new ImageUploadError("La imagen debe pesar entre 1 byte y 10 MB.", 413);
  }
  let encoded;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const options = { limitInputPixels: 40_000_000, failOn: "warning" as const };
    const metadata = await sharp(input, options).metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) {
      throw new Error("Unsupported image");
    }
    encoded = await sharp(input, options)
      .rotate()
      .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ImageUploadError("No se pudo procesar la imagen. Usa un JPG, PNG o WebP sin animación, de hasta 40 megapíxeles.", 415);
  }
  const src = await uploadPhoto(encoded.data, "image/webp");
  return {
    src,
    width: encoded.info.width,
    height: encoded.info.height,
  };
}

export async function readPromotionImage(filename: string): Promise<Buffer | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/.test(filename)) return null;
  try {
    return await readFile(path.join(uploadDirectory(), filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
