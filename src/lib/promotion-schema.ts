import { z } from "astro/zod";

import { isSafePromotionHref } from "./promotions";

const promotionImageSource = z.string().trim().refine(
  (value) => value.startsWith("/") || /^https:\/\//i.test(value),
  "La imagen debe usar una ruta de public que empiece con / o una URL https.",
);

const promotionFields = {
  revision: z.number().int().positive().default(1),
  enabled: z.boolean().default(false),
  priority: z.number().int().min(-100).max(100).default(0),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  eyebrow: z.string().trim().min(1).max(50).optional(),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(700),
  note: z.string().trim().min(1).max(300).optional(),
  image: z
    .object({
      src: promotionImageSource,
      alt: z.string().trim().max(160),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      fit: z.enum(["cover", "contain"]).optional(),
      positionX: z.number().min(0).max(100).optional(),
      positionY: z.number().min(0).max(100).optional(),
      zoom: z.number().min(1).max(2.5).optional(),
    })
    .optional(),
  cta: z.object({
    label: z.string().trim().min(1).max(40),
    href: z
      .string()
      .trim()
      .refine(isSafePromotionHref, "El enlace de la promoción no es seguro."),
  }),
  trigger: z.object({
    mode: z.enum(["delay", "scroll", "either"]).default("either"),
    delayMs: z.number().int().min(3_000).max(30_000).default(8_000),
    scrollPercent: z.number().min(10).max(80).default(35),
  }),
  tone: z.enum(["canvas", "terracotta", "forest"]).default("terracotta"),
};

function validatePromotionDatesAndImage(
  promotion: {
    startsAt: string;
    endsAt: string;
    image?: {
      width?: number | undefined;
      height?: number | undefined;
    } | undefined;
  },
  context: z.RefinementCtx,
): void {
  if (Date.parse(promotion.endsAt) <= Date.parse(promotion.startsAt)) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "La fecha de término debe ser posterior a la fecha de inicio.",
    });
  }

  if (
    promotion.image &&
    ((promotion.image.width === undefined) !==
      (promotion.image.height === undefined))
  ) {
    context.addIssue({
      code: "custom",
      path: ["image"],
      message: "Define width y height juntos, o elimina ambos.",
    });
  }
}

export const promotionDataSchema = z
  .object(promotionFields)
  .superRefine(validatePromotionDatesAndImage);

export const storedPromotionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa letras minúsculas, números y guiones."),
    ...promotionFields,
  })
  .superRefine(validatePromotionDatesAndImage);

export const storedPromotionsSchema = z
  .array(storedPromotionSchema)
  .min(1, "Debe existir al menos una campaña.")
  .max(30, "El panel admite hasta 30 campañas.")
  .superRefine((promotions, context) => {
    const seen = new Set<string>();
    promotions.forEach((promotion, index) => {
      if (seen.has(promotion.id)) {
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "El identificador de la campaña debe ser único.",
        });
      }
      seen.add(promotion.id);
    });
  });

export type StoredPromotion = z.infer<typeof storedPromotionSchema>;
