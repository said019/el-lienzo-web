import type { APIRoute } from "astro";
import { hasValidAdminPassword } from "../../../lib/admin-auth";
import { ImageUploadError, readImageForm, storePromotionImage } from "../../../lib/promotion-uploads";

export const prerender = false;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export const POST: APIRoute = async ({ request }) => {
  if (!hasValidAdminPassword(request)) return json({ error: "Vuelve a entrar al panel para subir imágenes." }, 401);
  try {
    const form = await readImageForm(request);
    const file = form.get("image");
    if (!(file instanceof File)) return json({ error: "Selecciona una imagen para subir." }, 400);
    return json({ image: await storePromotionImage(file) }, 201);
  } catch (error) {
    if (error instanceof ImageUploadError) return json({ error: error.message }, error.status);
    console.error("No se pudo guardar la imagen de promoción.", error);
    return json({ error: "No se pudo guardar la imagen. Intenta nuevamente." }, 500);
  }
};
