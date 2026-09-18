export type PromotionTriggerMode = "delay" | "scroll" | "either";

export type PromotionTone = "canvas" | "terracotta" | "forest";

export interface PromotionTrigger {
  mode: PromotionTriggerMode;
  delayMs: number;
  scrollPercent: number;
}

export interface PromotionImage {
  src: string;
  alt: string;
  width?: number | undefined;
  height?: number | undefined;
  fit?: "cover" | "contain" | undefined;
  positionX?: number | undefined;
  positionY?: number | undefined;
  zoom?: number | undefined;
}

/** The editor and public dialog use the same non-destructive framing. */
export function applyPromotionImageFrame(element: HTMLImageElement, image: PromotionImage): void {
  const x = image.positionX ?? 50;
  const y = image.positionY ?? 50;
  element.style.objectFit = image.fit ?? "cover";
  element.style.objectPosition = `${x}% ${y}%`;
  element.style.transformOrigin = `${x}% ${y}%`;
  element.style.transform = `scale(${image.zoom ?? 1})`;
}

export interface PromotionCallToAction {
  label: string;
  href: string;
}

export interface Promotion {
  id: string;
  revision: number;
  enabled: boolean;
  priority: number;
  startsAt: string;
  endsAt: string;
  eyebrow?: string | undefined;
  title: string;
  body: string;
  note?: string | undefined;
  image?: PromotionImage | undefined;
  cta: PromotionCallToAction;
  trigger: PromotionTrigger;
  tone: PromotionTone;
}

/**
 * Compatibility shape for any pre-existing in-code campaign draft. New
 * campaigns should use the validated content collection instead.
 */
export interface PromotionCampaign {
  id: string;
  status: "draft" | "scheduled" | "active" | "expired";
  eyebrow?: string;
  title: string;
  description: string;
  cta: {
    label: string;
    href: string;
    target?: "_self" | "_blank";
  };
  priority: number;
  startsAt?: string;
  endsAt?: string;
  trigger: {
    delayMs: number;
    scrollPercent: number;
    strategy: "any" | "all";
  };
  oncePerSession: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PROMOTION_SESSION_KEY = "el-lienzo:promotion-shown";

const ALLOWED_LINK_PROTOCOLS = new Set(["https:", "mailto:", "tel:"]);

/**
 * Accepts secure absolute URLs and same-page anchors. This is shared by the
 * content schema and the client so a campaign cannot inject a script URL.
 */
export function isSafePromotionHref(value: string): boolean {
  const href = value.trim();

  if (/^#[A-Za-z][\w:.-]*$/.test(href)) {
    return true;
  }

  try {
    return ALLOWED_LINK_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
}

export function isPromotionActive(
  promotion: Promotion,
  now: Date | number = Date.now(),
): boolean {
  if (!promotion.enabled) {
    return false;
  }

  const instant = now instanceof Date ? now.getTime() : now;
  const startsAt = Date.parse(promotion.startsAt);
  const endsAt = Date.parse(promotion.endsAt);

  if (![instant, startsAt, endsAt].every(Number.isFinite) || endsAt <= startsAt) {
    return false;
  }

  return instant >= startsAt && instant < endsAt;
}

/**
 * Returns one deterministic campaign without mutating the source collection.
 * Higher priority wins, then the campaign with the most recent start date.
 */
export function selectActivePromotion(
  promotions: readonly Promotion[],
  now: Date | number = Date.now(),
): Promotion | undefined {
  return [...promotions]
    .filter((promotion) => isPromotionActive(promotion, now))
    .sort((first, second) => {
      const priorityDifference = second.priority - first.priority;
      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const startDifference =
        Date.parse(second.startsAt) - Date.parse(first.startsAt);
      if (startDifference !== 0) {
        return startDifference;
      }

      return first.id.localeCompare(second.id, "es-MX");
    })[0];
}

export function hasPromotionBeenShown(
  storage: StorageLike | null,
  promotion?: Pick<Promotion, "id" | "revision">,
): boolean {
  if (!storage) {
    return false;
  }

  try {
    const stored = storage.getItem(PROMOTION_SESSION_KEY);
    if (stored === null) return false;
    if (!promotion) return true;

    try {
      const shown = JSON.parse(stored) as { id?: unknown; revision?: unknown };
      return shown.id === promotion.id && shown.revision === promotion.revision;
    } catch {
      return true;
    }
  } catch {
    return false;
  }
}

export function markPromotionAsShown(
  storage: StorageLike | null,
  promotion: Pick<Promotion, "id" | "revision">,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      PROMOTION_SESSION_KEY,
      JSON.stringify({
        id: promotion.id,
        revision: promotion.revision,
        shownAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Storage can be unavailable in hardened privacy modes. The dialog remains
    // usable for the current page even when persistence is not available.
  }
}

export interface PromotionTriggerState {
  elapsedMs: number;
  scrollPercent: number;
}

export function hasPromotionTriggerFired(
  trigger: PromotionTrigger,
  state: PromotionTriggerState,
): boolean {
  const delayReached = state.elapsedMs >= trigger.delayMs;
  const scrollReached = state.scrollPercent >= trigger.scrollPercent;

  if (trigger.mode === "delay") {
    return delayReached;
  }

  if (trigger.mode === "scroll") {
    return scrollReached;
  }

  return delayReached || scrollReached;
}
