import {
  applyPromotionImageFrame,
  hasPromotionBeenShown,
  hasPromotionTriggerFired,
  isSafePromotionHref,
  markPromotionAsShown,
  selectActivePromotion,
  type Promotion,
} from "../lib/promotions";

const ROOT_SELECTOR = "[data-promotion-root]";
const QUOTE_FORM_SELECTOR = "[data-quote-form]";

interface QuoteEngagementDetail {
  engaged: boolean;
}

interface NavigationOverlayDetail {
  open: boolean;
}

function isPromotion(value: unknown): value is Promotion {
  if (!value || typeof value !== "object") return false;

  const campaign = value as Partial<Promotion>;
  return (
    typeof campaign.id === "string" &&
    typeof campaign.revision === "number" &&
    typeof campaign.enabled === "boolean" &&
    typeof campaign.priority === "number" &&
    typeof campaign.startsAt === "string" &&
    typeof campaign.endsAt === "string" &&
    typeof campaign.title === "string" &&
    typeof campaign.body === "string" &&
    Boolean(campaign.cta) &&
    typeof campaign.cta?.label === "string" &&
    typeof campaign.cta.href === "string" &&
    isSafePromotionHref(campaign.cta.href) &&
    Boolean(campaign.trigger) &&
    typeof campaign.trigger?.delayMs === "number" &&
    typeof campaign.trigger.scrollPercent === "number"
  );
}

function readPromotions(root: HTMLElement): Promotion[] {
  const config = root.querySelector<HTMLScriptElement>(
    "script[data-promotion-config]",
  );
  if (!config?.textContent) return [];

  try {
    const value: unknown = JSON.parse(config.textContent);
    return Array.isArray(value) ? value.filter(isPromotion) : [];
  } catch {
    root.dataset.promotionState = "invalid-config";
    return [];
  }
}

function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function renderPromotion(root: HTMLElement, promotion: Promotion): boolean {
  const eyebrow = root.querySelector<HTMLElement>("[data-promotion-eyebrow]");
  const title = root.querySelector<HTMLElement>("[data-promotion-title]");
  const body = root.querySelector<HTMLElement>("[data-promotion-body]");
  const note = root.querySelector<HTMLElement>("[data-promotion-note]");
  const imageWrap = root.querySelector<HTMLElement>("[data-promotion-image-wrap]");
  const image = root.querySelector<HTMLImageElement>("[data-promotion-image]");
  const cta = root.querySelector<HTMLAnchorElement>("[data-promotion-cta]");

  if (!title || !body || !cta) return false;

  title.textContent = promotion.title;
  body.textContent = promotion.body;
  cta.textContent = promotion.cta.label;
  cta.href = promotion.cta.href;

  if (/^https:/i.test(promotion.cta.href)) {
    cta.target = "_blank";
    cta.rel = "noreferrer noopener";
  } else {
    cta.removeAttribute("target");
    cta.removeAttribute("rel");
  }

  if (eyebrow) {
    eyebrow.textContent = promotion.eyebrow ?? "";
    eyebrow.hidden = !promotion.eyebrow;
  }

  if (note) {
    note.textContent = promotion.note ?? "";
    note.hidden = !promotion.note;
  }

  if (imageWrap && image) {
    if (promotion.image) {
      image.src = promotion.image.src;
      image.alt = promotion.image.alt;
      applyPromotionImageFrame(image, promotion.image);
      if (promotion.image.width) image.width = promotion.image.width;
      if (promotion.image.height) image.height = promotion.image.height;
      imageWrap.hidden = false;
    } else {
      image.removeAttribute("src");
      image.alt = "";
      imageWrap.hidden = true;
    }
  }

  root.dataset.promotionCampaign = promotion.id;
  root.dataset.promotionTone = promotion.tone;
  return true;
}

function quoteIsEngaged(): boolean {
  const active = document.activeElement;
  if (active instanceof Element && active.closest(QUOTE_FORM_SELECTOR)) {
    return true;
  }

  return Array.from(
    document.querySelectorAll<HTMLElement>(QUOTE_FORM_SELECTOR),
  ).some((form) => form.dataset.quoteEngaged === "true");
}

function readingProgress(): number {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 100;
  return Math.max(0, Math.min(100, (window.scrollY / scrollable) * 100));
}

function setupPromotionRoot(root: HTMLElement): void {
  if (root.dataset.promotionInitialized === "true") return;
  root.dataset.promotionInitialized = "true";

  const dialog = root.querySelector<HTMLDialogElement>(
    "dialog[data-promotion-dialog]",
  );
  const promotion = selectActivePromotion(readPromotions(root));
  const storage = getSessionStorage();

  if (!dialog || !promotion) {
    root.dataset.promotionState = "inactive";
    return;
  }

  if (hasPromotionBeenShown(storage, promotion)) {
    root.dataset.promotionState = "seen";
    return;
  }

  if (!renderPromotion(root, promotion)) {
    root.dataset.promotionState = "invalid-config";
    return;
  }

  const controller = new AbortController();
  const { signal } = controller;
  const closeButton = root.querySelector<HTMLButtonElement>(
    "[data-promotion-close]",
  );
  const cta = root.querySelector<HTMLAnchorElement>("[data-promotion-cta]");
  const initialFocus = root.querySelector<HTMLElement>(
    "[data-promotion-initial-focus]",
  );
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const armedAt = Date.now();
  let opened = false;
  let suppressed = quoteIsEngaged();
  let delayTimer: number | undefined;
  let scrollFrame: number | undefined;
  let returnFocus: HTMLElement | null = null;

  const syncMotionPreference = (): void => {
    const reduced = motionQuery.matches ? "true" : "false";
    root.dataset.reducedMotion = reduced;
    dialog.dataset.reducedMotion = reduced;
  };

  const closeDialog = (reason: string): void => {
    if (!dialog.open) return;

    if (typeof dialog.close === "function") {
      dialog.close(reason);
    } else {
      dialog.removeAttribute("open");
      dialog.returnValue = reason;
      dialog.dispatchEvent(new Event("close"));
    }
  };

  const openDialog = (): void => {
    if (
      opened ||
      suppressed ||
      quoteIsEngaged() ||
      document.querySelector('.site-header__menu[open]')
    ) {
      return;
    }

    returnFocus =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : null;

    try {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
        dialog.dataset.dialogFallback = "true";
      }
    } catch {
      root.dataset.promotionState = "open-error";
      return;
    }

    opened = true;
    root.dataset.promotionState = "open";
    markPromotionAsShown(storage, promotion);
    window.requestAnimationFrame(() => initialFocus?.focus({ preventScroll: true }));
  };

  const attemptOpen = (): void => {
    if (
      hasPromotionTriggerFired(promotion.trigger, {
        elapsedMs: Date.now() - armedAt,
        scrollPercent: readingProgress(),
      })
    ) {
      openDialog();
    }
  };

  const onScroll = (): void => {
    if (scrollFrame !== undefined) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = undefined;
      attemptOpen();
    });
  };

  const suppressForQuote = (): void => {
    suppressed = true;
    root.dataset.promotionState = "suppressed-for-quote";
    if (dialog.open) closeDialog("quote-engaged");
  };

  const onQuoteEngagement = (event: Event): void => {
    const detail = (event as CustomEvent<QuoteEngagementDetail>).detail;
    if (detail?.engaged) suppressForQuote();
  };

  const onFocusIn = (event: FocusEvent): void => {
    if (
      event.target instanceof Element &&
      event.target.closest(QUOTE_FORM_SELECTOR)
    ) {
      suppressForQuote();
    }
  };

  const onNavigationOverlay = (event: Event): void => {
    const detail = (event as CustomEvent<NavigationOverlayDetail>).detail;
    if (!detail?.open) attemptOpen();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!dialog.open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog("escape");
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = [cta, closeButton].filter(
      (element): element is HTMLAnchorElement | HTMLButtonElement =>
        element !== null,
    );
    if (focusable.length === 0) return;

    const activeIndex = focusable.findIndex(
      (element) => element === document.activeElement,
    );
    const nextIndex =
      activeIndex < 0
        ? event.shiftKey
          ? focusable.length - 1
          : 0
        : (activeIndex + (event.shiftKey ? -1 : 1) + focusable.length) %
          focusable.length;

    event.preventDefault();
    focusable[nextIndex]?.focus({ preventScroll: true });
  };

  const focusCtaDestination = (): void => {
    const href = cta?.getAttribute("href");
    if (!href?.startsWith("#")) return;

    const destination = document.querySelector(href);
    const focusTarget =
      destination?.querySelector<HTMLElement>("[data-promotion-focus-target]") ??
      (destination instanceof HTMLElement ? destination : null);

    window.requestAnimationFrame(() =>
      focusTarget?.focus({ preventScroll: true }),
    );
  };

  const dispose = (): void => {
    controller.abort();
    if (delayTimer !== undefined) window.clearTimeout(delayTimer);
    if (scrollFrame !== undefined) window.cancelAnimationFrame(scrollFrame);
  };

  syncMotionPreference();
  root.dataset.promotionState = suppressed ? "suppressed-for-quote" : "armed";

  motionQuery.addEventListener("change", syncMotionPreference, { signal });
  window.addEventListener("el-lienzo:quote-engagement", onQuoteEngagement, {
    signal,
  });
  window.addEventListener("el-lienzo:navigation-overlay", onNavigationOverlay, {
    signal,
  });
  document.addEventListener("focusin", onFocusIn, { signal });
  document.addEventListener("keydown", onKeyDown, { signal });
  document.addEventListener("astro:before-swap", dispose, {
    once: true,
    signal,
  });

  closeButton?.addEventListener("click", () => closeDialog("dismiss"), {
    signal,
  });
  cta?.addEventListener(
    "click",
    () => {
      closeDialog("cta");
      focusCtaDestination();
    },
    { signal },
  );
  dialog.addEventListener(
    "cancel",
    () => {
      dialog.returnValue = "escape";
    },
    { signal },
  );
  dialog.addEventListener(
    "close",
    () => {
      root.dataset.promotionState =
        dialog.returnValue === "quote-engaged"
          ? "suppressed-for-quote"
          : "closed";

      if (dialog.returnValue !== "cta" && returnFocus?.isConnected) {
        window.requestAnimationFrame(() =>
          returnFocus?.focus({ preventScroll: true }),
        );
      }
    },
    { signal },
  );
  dialog.addEventListener(
    "click",
    (event) => {
      if (event.target !== dialog) return;

      const bounds = dialog.getBoundingClientRect();
      const inside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      if (!inside) closeDialog("backdrop");
    },
    { signal },
  );

  if (promotion.trigger.mode !== "scroll") {
    delayTimer = window.setTimeout(attemptOpen, promotion.trigger.delayMs);
  }

  if (promotion.trigger.mode !== "delay") {
    window.addEventListener("scroll", onScroll, { passive: true, signal });
    onScroll();
  }
}

export function initPromotionDialogs(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLElement>(ROOT_SELECTOR).forEach(setupPromotionRoot);
}
