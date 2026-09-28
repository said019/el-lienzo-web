import type { APIRoute } from "astro";
import { readPromotionStore } from "../../lib/promotion-store";
import { selectActivePromotion } from "../../lib/promotions";

export const prerender = false;

// Only the currently public campaign is exposed, never drafts or future offers.
export const GET: APIRoute = async () => {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, max-age=0",
  };
  try {
    const promotion = selectActivePromotion(await readPromotionStore());
    return new Response(JSON.stringify(promotion ? [promotion] : []), { headers });
  } catch {
    return new Response("[]", { status: 503, headers });
  }
};
