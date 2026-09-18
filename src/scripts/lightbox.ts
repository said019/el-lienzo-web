/*
  Visor de imágenes ampliadas.

  Cada disparador es un <button data-zoom> que envuelve la miniatura. El botón nace
  deshabilitado en el HTML: sin JavaScript no queda un control muerto en la página, y
  este módulo lo habilita al arrancar. Las fotos de un mismo data-zoom-group se
  recorren con las flechas, los botones de navegación o deslizando en táctil.
*/

const DIALOG_SELECTOR = "[data-lightbox]";
const TRIGGER_SELECTOR = "button[data-zoom]";
const SWIPE_THRESHOLD_PX = 48;

interface Slide {
  trigger: HTMLButtonElement;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

function readSlide(trigger: HTMLButtonElement): Slide | null {
  const { zoomSrc, zoomAlt, zoomWidth, zoomHeight, zoomCaption } = trigger.dataset;
  if (!zoomSrc) return null;

  return {
    trigger,
    src: zoomSrc,
    width: Number(zoomWidth) || 0,
    height: Number(zoomHeight) || 0,
    alt: zoomAlt ?? "",
    caption: zoomCaption ?? "",
  };
}

export function initLightbox(): void {
  const dialogElement = document.querySelector<HTMLDialogElement>(DIALOG_SELECTOR);
  if (!dialogElement || dialogElement.dataset.ready === "true") return;
  if (typeof dialogElement.showModal !== "function") return;
  dialogElement.dataset.ready = "true";
  const dialog = dialogElement;

  const imageElement = dialog.querySelector<HTMLImageElement>("[data-lightbox-image]");
  const captionNode = dialog.querySelector<HTMLElement>("[data-lightbox-caption]");
  const counterNode = dialog.querySelector<HTMLElement>("[data-lightbox-counter]");
  const closeButton = dialog.querySelector<HTMLButtonElement>("[data-lightbox-close]");
  const previousButton = dialog.querySelector<HTMLButtonElement>("[data-lightbox-prev]");
  const nextButton = dialog.querySelector<HTMLButtonElement>("[data-lightbox-next]");
  if (!imageElement) return;
  const image = imageElement;

  const groups = new Map<string, Slide[]>();
  let slides: Slide[] = [];
  let index = 0;
  let opener: HTMLButtonElement | null = null;

  document.querySelectorAll<HTMLButtonElement>(TRIGGER_SELECTOR).forEach((trigger) => {
    const slide = readSlide(trigger);
    if (!slide) return;

    const group = trigger.dataset.zoomGroup ?? "general";
    const bucket = groups.get(group) ?? [];
    bucket.push(slide);
    groups.set(group, bucket);

    trigger.disabled = false;
    trigger.addEventListener("click", () => open(group, slide));
  });

  if (groups.size === 0) return;

  function render(): void {
    const slide = slides[index];
    if (!slide) return;

    image.src = slide.src;
    image.alt = slide.alt;
    if (slide.width) image.width = slide.width;
    if (slide.height) image.height = slide.height;

    if (captionNode) {
      captionNode.textContent = slide.caption;
      captionNode.hidden = slide.caption === "";
    }

    const many = slides.length > 1;
    if (counterNode) {
      counterNode.textContent = many ? `${index + 1} / ${slides.length}` : "";
      counterNode.hidden = !many;
    }
    if (previousButton) previousButton.hidden = !many;
    if (nextButton) nextButton.hidden = !many;
  }

  function move(step: number): void {
    if (slides.length < 2) return;
    index = (index + step + slides.length) % slides.length;
    render();
  }

  function open(group: string, slide: Slide): void {
    slides = groups.get(group) ?? [slide];
    index = Math.max(0, slides.indexOf(slide));
    opener = slide.trigger;
    render();
    dialog.showModal();
  }

  closeButton?.addEventListener("click", () => dialog.close());
  previousButton?.addEventListener("click", () => move(-1));
  nextButton?.addEventListener("click", () => move(1));

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
  });

  /* Clic fuera de la foto cierra, como en cualquier visor. */
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  let touchStartX: number | null = null;
  dialog.addEventListener(
    "touchstart",
    (event) => {
      touchStartX = event.changedTouches[0]?.clientX ?? null;
    },
    { passive: true },
  );
  dialog.addEventListener(
    "touchend",
    (event) => {
      if (touchStartX === null) return;
      const endX = event.changedTouches[0]?.clientX ?? touchStartX;
      const travelled = endX - touchStartX;
      touchStartX = null;
      if (Math.abs(travelled) < SWIPE_THRESHOLD_PX) return;
      move(travelled < 0 ? 1 : -1);
    },
    { passive: true },
  );

  /* El foco vuelve a la miniatura desde la que se abrió el visor. */
  dialog.addEventListener("close", () => {
    image.removeAttribute("src");
    opener?.focus();
    opener = null;
  });
}
