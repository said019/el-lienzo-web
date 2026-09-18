import { expect, test, type Page } from "@playwright/test";

const PROMOTION_SESSION_KEY = "el-lienzo:promotion-shown";

async function openHome(page: Page): Promise<void> {
  await page.addInitScript((storageKey) => {
    window.sessionStorage.setItem(storageKey, "e2e-seen");
  }, PROMOTION_SESSION_KEY);
  await page.goto("/");
}

test.describe("visor de imágenes", () => {
  test("las miniaturas quedan activas sólo cuando el visor está disponible", async ({
    page,
  }) => {
    await openHome(page);

    const triggers = page.locator("button.zoom");
    await expect(triggers.first()).toBeEnabled();
    expect(await triggers.count()).toBeGreaterThan(10);
    await expect(page.locator("button.zoom[disabled]")).toHaveCount(0);
  });

  test("abre la galería, recorre con el teclado y devuelve el foco al cerrar", async ({
    page,
  }) => {
    await openHome(page);

    const dialog = page.locator("dialog[data-lightbox]");
    const counter = dialog.locator("[data-lightbox-counter]");
    const image = dialog.locator("[data-lightbox-image]");
    const firstThumb = page.locator("#galeria button.zoom").first();

    await expect(dialog).toBeHidden();

    await firstThumb.scrollIntoViewIfNeeded();
    await firstThumb.click();

    await expect(dialog).toBeVisible();
    await expect(counter).toHaveText("1 / 4");
    await expect(dialog.locator("[data-lightbox-caption]")).toHaveText("Mesa en tonos rosa");

    // La foto ampliada se descarga de verdad, no queda un hueco.
    await expect
      .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBeGreaterThan(0);

    await page.keyboard.press("ArrowRight");
    await expect(counter).toHaveText("2 / 4");
    await page.keyboard.press("ArrowLeft");
    await expect(counter).toHaveText("1 / 4");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(firstThumb).toBeFocused();
  });

  test("cada espacio abre su propio recorrido de tres fotos", async ({ page }) => {
    await openHome(page);

    const dialog = page.locator("dialog[data-lightbox]");
    const counter = dialog.locator("[data-lightbox-counter]");
    const thumb = page.locator("#espacio-terrazas button.zoom").first();

    await thumb.scrollIntoViewIfNeeded();
    await thumb.click();

    await expect(dialog).toBeVisible();
    await expect(counter).toHaveText("1 / 3");
    await expect(dialog.locator("[data-lightbox-caption]")).toHaveText("Terrazas");

    await dialog.getByRole("button", { name: "Imagen siguiente" }).click();
    await expect(counter).toHaveText("2 / 3");

    await dialog.getByRole("button", { name: "Cerrar imagen ampliada" }).click();
    await expect(dialog).toBeHidden();
  });
});
