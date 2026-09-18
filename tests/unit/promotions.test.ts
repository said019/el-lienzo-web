import { describe, expect, it } from "vitest";

import {
  hasPromotionBeenShown,
  hasPromotionTriggerFired,
  isPromotionActive,
  markPromotionAsShown,
  selectActivePromotion,
  type Promotion,
  type StorageLike,
} from "../../src/lib/promotions";

const basePromotion: Promotion = {
  id: "base",
  revision: 1,
  enabled: true,
  priority: 0,
  startsAt: "2026-01-01T00:00:00-06:00",
  endsAt: "2027-01-01T00:00:00-06:00",
  title: "Agenda una visita",
  body: "Conoce los espacios.",
  cta: { label: "Agendar", href: "#cotiza" },
  trigger: { mode: "either", delayMs: 8_000, scrollPercent: 35 },
  tone: "terracotta",
};

describe("campaign selection", () => {
  it("selects the highest-priority active promotion", () => {
    const promotions: Promotion[] = [
      { ...basePromotion, id: "always", priority: 1 },
      { ...basePromotion, id: "seasonal", priority: 20 },
    ];

    expect(
      selectActivePromotion(
        promotions,
        new Date("2026-08-28T12:00:00-06:00"),
      )?.id,
    ).toBe("seasonal");
  });

  it("ignores disabled, future and invalid campaigns", () => {
    const promotions: Promotion[] = [
      { ...basePromotion, id: "disabled", enabled: false, priority: 100 },
      {
        ...basePromotion,
        id: "future",
        startsAt: "2028-01-01T00:00:00-06:00",
        endsAt: "2029-01-01T00:00:00-06:00",
        priority: 90,
      },
      {
        ...basePromotion,
        id: "invalid",
        startsAt: "not-a-date",
        priority: 80,
      },
      { ...basePromotion, id: "available", priority: 1 },
    ];

    expect(
      selectActivePromotion(
        promotions,
        new Date("2026-08-28T12:00:00-06:00"),
      )?.id,
    ).toBe("available");
  });

  it("treats the start as inclusive and the end as exclusive", () => {
    expect(
      isPromotionActive(
        basePromotion,
        new Date("2026-01-01T00:00:00-06:00"),
      ),
    ).toBe(true);
    expect(
      isPromotionActive(
        basePromotion,
        new Date("2027-01-01T00:00:00-06:00"),
      ),
    ).toBe(false);
  });
});

describe("promotion session and triggers", () => {
  it("marks a promotion as shown once per session", () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };

    expect(hasPromotionBeenShown(storage)).toBe(false);
    markPromotionAsShown(storage, basePromotion);
    expect(hasPromotionBeenShown(storage)).toBe(true);
    expect(hasPromotionBeenShown(storage, basePromotion)).toBe(true);
    expect(
      hasPromotionBeenShown(storage, {
        id: basePromotion.id,
        revision: basePromotion.revision + 1,
      }),
    ).toBe(false);
  });

  it("fires an either trigger when delay or reading progress is reached", () => {
    expect(
      hasPromotionTriggerFired(basePromotion.trigger, {
        elapsedMs: 2_000,
        scrollPercent: 40,
      }),
    ).toBe(true);
    expect(
      hasPromotionTriggerFired(basePromotion.trigger, {
        elapsedMs: 2_000,
        scrollPercent: 10,
      }),
    ).toBe(false);
  });
});
