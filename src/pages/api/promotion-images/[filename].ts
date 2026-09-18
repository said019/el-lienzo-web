import type { APIRoute } from "astro";
import { readPromotionImage } from "../../../lib/promotion-uploads";

export const prerender = false;
export const GET: APIRoute = async ({ params }) => {
  const image = await readPromotionImage(params.filename ?? "");
  if (!image) return new Response("Imagen no encontrada", { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: {
      "content-type": "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
};
