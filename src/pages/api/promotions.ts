import type { APIRoute } from "astro";
import { ZodError } from "astro/zod";

import {
  hasValidAdminPassword,
  isAdminPasswordConfigured,
} from "../../lib/admin-auth";
import { readPromotionStore, writePromotionStore } from "../../lib/promotion-store";
import { storedPromotionsSchema } from "../../lib/promotion-schema";

export const prerender = false;

const responseHeaders = {
  "cache-control": "no-store, max-age=0",
  "content-type": "application/json; charset=utf-8",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function unauthorized(): Response {
  return json(
    {
      error: isAdminPasswordConfigured()
        ? "La contraseña no es correcta."
        : "El panel todavía no tiene una contraseña configurada.",
    },
    isAdminPasswordConfigured() ? 401 : 503,
  );
}

export const GET: APIRoute = async ({ request }) => {
  if (!hasValidAdminPassword(request)) return unauthorized();

  try {
    return json({ promotions: await readPromotionStore() });
  } catch (error) {
    console.error("No se pudieron leer las promociones.", error);
    return json({ error: "No se pudieron cargar las promociones." }, 500);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  if (!hasValidAdminPassword(request)) return unauthorized();

  const rawBody = await request.text();
  if (rawBody.length > 100_000) {
    return json({ error: "El contenido enviado es demasiado grande." }, 413);
  }

  try {
    const input: unknown = JSON.parse(rawBody);
    const promotions = storedPromotionsSchema.parse(
      typeof input === "object" && input !== null && "promotions" in input
        ? (input as { promotions: unknown }).promotions
        : input,
    );

    return json({ promotions: await writePromotionStore(promotions) });
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        {
          error: "Revisa los campos marcados e intenta nuevamente.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
      );
    }

    if (error instanceof SyntaxError) {
      return json({ error: "El contenido enviado no es JSON válido." }, 400);
    }

    console.error("No se pudieron guardar las promociones.", error);
    return json({ error: "No se pudieron guardar los cambios." }, 500);
  }
};
