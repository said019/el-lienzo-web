import { expect, test, type Page } from "@playwright/test";

const PROMOTION_SESSION_KEY = "el-lienzo:promotion-shown";

async function suppressPromotion(page: Page): Promise<void> {
  await page.addInitScript((storageKey) => {
    window.sessionStorage.setItem(storageKey, "e2e-seen");
  }, PROMOTION_SESSION_KEY);
}

/**
 * La campaña se dispara por retraso o por scroll. Aquí estiramos el retraso para
 * que sólo el scroll la abra y la prueba no compita contra el temporizador.
 */
async function armPromotionForScroll(page: Page): Promise<void> {
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    const body = await response.text();
    const bodyWithoutDelayRace = body.replace(/"delayMs":\d+/, '"delayMs":600000');
    expect(bodyWithoutDelayRace).not.toBe(body);
    await route.fulfill({ response, body: bodyWithoutDelayRace });
  });
  await page.addInitScript((storageKey) => {
    window.sessionStorage.removeItem(storageKey);
  }, PROMOTION_SESSION_KEY);
}

async function scrollToMiddle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: scrollable * 0.5, behavior: "instant" });
  });
}

test.describe("página principal de El Lienzo", () => {
  test("presenta la propuesta, capacidades y enlaces clave", async ({ page }) => {
    await suppressPromotion(page);
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", /^es(?:-|$)/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Espacios para celebrar" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 2, name: "Conoce cada espacio" }),
    ).toBeAttached();

    const expectedCapacities = [
      "Capacidad de hasta 450 pax.",
      "Capacidad de hasta 80 pax.",
      "Capacidad de hasta 50 pax.",
      "Capacidad de hasta 1000 pax.",
    ];
    for (const capacity of expectedCapacities) {
      await expect(page.getByText(capacity, { exact: true })).toHaveCount(1);
    }

    await expect(
      page.getByRole("link", { name: "Agendar visita", exact: true }).first(),
    ).toHaveAttribute("href", /^https:\/\/wa\.me\/524271032890\?text=/);
    await expect(
      page.getByRole("link", { name: "Cotizar mi evento", exact: true }).first(),
    ).toHaveAttribute("href", "#cotiza");

    for (const section of ["#espacios", "#experiencias", "#paquetes", "#galeria", "#cotiza"]) {
      await expect(page.locator(section)).toBeAttached();
    }
    await expect(page.locator("#espacio-ruedo")).toBeAttached();
    await expect(page.locator("main#contenido")).toBeAttached();

    const instagramLinks = page.getByRole("link", { name: "@ellienzo.eventos" });
    await expect(instagramLinks).toHaveCount(2);
    for (const link of await instagramLinks.all()) {
      await expect(link).toHaveAttribute(
        "href",
        "https://www.instagram.com/ellienzo.eventos/",
      );
    }
    await expect(
      page.getByRole("link", { name: "contacto@ellienzo.com.mx", exact: true }),
    ).toHaveAttribute("href", "mailto:contacto@ellienzo.com.mx");
    await expect(
      page.getByRole("link", { name: "+52 (427) 103 2890" }),
    ).toHaveAttribute("href", "https://wa.me/524271032890");
    await expect(
      page.getByRole("link", {
        name: "Antiguo Camino a Ojo de Agua 6, 76807, San Juan del Río, Qro.",
      }),
    ).toHaveAttribute("href", "https://maps.app.goo.gl/5SL2z6c4k6g5KhqJ6");
  });

  test("el menú móvil abre, navega y vuelve a cerrarse", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chromium",
      "Este contrato corresponde exclusivamente a la navegación móvil.",
    );

    await suppressPromotion(page);
    await page.goto("/");

    const menu = page.locator("details.site-header__menu");
    const trigger = menu.locator("summary.site-header__menu-trigger");
    await expect(menu).not.toHaveAttribute("open", "");
    await expect(trigger).toBeVisible();

    await trigger.click();
    await expect(menu).toHaveAttribute("open", "");

    const mobileNav = page.getByRole("navigation", { name: "Navegación móvil" });
    await expect(mobileNav).toBeVisible();

    const mobileQuoteLink = mobileNav.getByRole("link", {
      name: "Cotizar por WhatsApp",
    });
    await expect(mobileQuoteLink).toBeVisible();
    await expect(page.locator("main")).toHaveJSProperty("inert", true);

    // El foco queda atrapado dentro del panel: del último control vuelve al primero.
    await mobileQuoteLink.focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "El Lienzo, ir al inicio" }).first(),
    ).toBeFocused();

    await mobileNav.getByRole("link", { name: "Espacios", exact: true }).click();

    await expect(menu).not.toHaveAttribute("open", "");
    await expect(page.locator("main")).toHaveJSProperty("inert", false);
    await expect(page).toHaveURL(/#espacios$/);
    await expect(page.locator("#espacios")).toBeInViewport();
  });

  test("mantiene un acceso directo y accesible a WhatsApp en móvil", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chromium",
      "Este acceso directo se muestra exclusivamente en móvil.",
    );

    await suppressPromotion(page);
    await page.goto("/");

    const whatsapp = page.locator("a[data-mobile-whatsapp]");
    await expect(whatsapp).toBeVisible();
    await expect(whatsapp).toHaveAttribute("target", "_blank");
    await expect(whatsapp).toHaveAttribute("rel", /noopener/);

    const href = await whatsapp.getAttribute("href");
    expect(href).not.toBeNull();
    const destination = new URL(href ?? "");
    expect(`${destination.origin}${destination.pathname}`).toBe(
      "https://wa.me/524271032890",
    );
    expect(destination.searchParams.get("text")).toContain(
      "Me gustaría cotizar un evento",
    );
  });

  test("valida la cotización y construye WhatsApp sin enviar el mensaje", async ({ page }) => {
    await suppressPromotion(page);
    await page.addInitScript(() => {
      const testWindow = window as Window & { __e2eOpenedWhatsAppUrl?: string };
      testWindow.__e2eOpenedWhatsAppUrl = "";
      window.open = ((url?: string | URL) => {
        testWindow.__e2eOpenedWhatsAppUrl = String(url ?? "");
        return { opener: null } as Window;
      }) as typeof window.open;
    });
    await page.goto("/");

    const form = page.getByRole("form", { name: "Formulario de cotización" });
    await form.getByRole("button", { name: "Quiero cotizar" }).click();

    await expect(form).toHaveAttribute("data-submission-state", "invalid");
    await expect(form.getByRole("alert")).toHaveText(
      "Revisa los campos señalados antes de continuar a WhatsApp.",
    );
    await expect(form.getByLabel("Nombre", { exact: true })).toBeFocused();
    await expect(form.getByLabel("Nombre", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      form.getByText("Escribe tu nombre.", { exact: true }),
    ).toBeVisible();

    await form.getByLabel("Nombre", { exact: true }).fill("María González");
    await form.getByLabel("Teléfono", { exact: true }).fill("427 555 0198");
    await form.getByLabel(/Correo electrónico/).fill("maria@example.com");
    await form.getByLabel("Tipo de evento").selectOption("boda");
    await form.getByLabel("Fecha estimada").fill("2099-11-15");
    await form.getByLabel("Número estimado de invitados").fill("180");
    await form.getByLabel(/Espacio de interés/).selectOption("ruedo");
    await form.getByLabel(/Paquete de interés/).selectOption("premium");
    await form
      .getByLabel(/Cuéntanos tu idea/)
      .fill("Cena al aire libre y ceremonia al atardecer.");

    await expect(form).toHaveAttribute("data-submission-state", "editing");
    await expect(form.getByRole("alert")).toBeHidden();

    await form.getByRole("button", { name: "Quiero cotizar" }).click();

    await expect(form).toHaveAttribute("data-submission-state", "ready");
    await expect(form.getByRole("status")).toContainText(
      "Abrimos WhatsApp con tu solicitud",
    );

    const openedUrl = await page.evaluate(
      () =>
        (window as Window & { __e2eOpenedWhatsAppUrl?: string })
          .__e2eOpenedWhatsAppUrl ?? "",
    );
    expect(openedUrl).not.toBe("");

    const whatsappUrl = new URL(openedUrl);
    expect(whatsappUrl.origin).toBe("https://wa.me");
    expect(whatsappUrl.pathname).toBe("/524271032890");

    const message = whatsappUrl.searchParams.get("text");
    expect(message).toContain("Hola, quiero cotizar un evento en El Lienzo.");
    expect(message).toContain("Nombre: María González");
    expect(message).toContain("Teléfono: 427 555 0198");
    expect(message).toContain("Correo: maria@example.com");
    expect(message).toContain("Tipo de evento: Boda");
    expect(message).toContain("Fecha: 15/11/2099");
    expect(message).toContain("Invitados: 180");
    expect(message).toContain("Espacio: Ruedo");
    expect(message).toContain("Paquete: Premium");
    expect(message).toContain(
      "Comentarios: Cena al aire libre y ceremonia al atardecer.",
    );

    // El mensaje se prepara, pero nunca se envía sin que la persona confirme.
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("abre la campaña por scroll, enfoca el diálogo y cierra con Escape", async ({ page }) => {
    await armPromotionForScroll(page);
    await page.goto("/");

    const root = page.locator("[data-promotion-root]");
    const dialog = root.locator("dialog[data-promotion-dialog]");
    const returnTarget = page
      .locator("#inicio")
      .getByRole("link", { name: "Agendar visita", exact: true });

    await expect(root).toHaveAttribute("data-promotion-state", "armed");
    await returnTarget.focus();
    await scrollToMiddle(page);

    await expect(dialog).toBeVisible();
    await expect(root).toHaveAttribute("data-promotion-state", "open");
    await expect(dialog).toHaveAttribute(
      "aria-labelledby",
      "promocion-el-lienzo-titulo",
    );
    await expect(dialog).toHaveAttribute(
      "aria-describedby",
      "promocion-el-lienzo-descripcion",
    );
    await expect(
      dialog.getByRole("heading", { name: "Obtén un 10% de descuento de renta" }),
    ).toBeFocused();

    await expect(dialog.locator("[data-promotion-note]")).toHaveText(
      "Promoción válida del 1 de septiembre al 31 de octubre del 2026. Consulta términos y condiciones.",
    );

    const campaignCta = dialog.getByRole("link", { name: "Cotiza tu evento" });
    const closeButton = dialog.getByRole("button", { name: "Cerrar promoción" });
    await expect(campaignCta).toHaveAttribute("href", "#cotiza");

    // El foco no se escapa del diálogo.
    await page.keyboard.press("Tab");
    await expect(campaignCta).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(closeButton).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(campaignCta).toBeFocused();

    const storedCampaign = await page.evaluate((storageKey) => {
      const value = window.sessionStorage.getItem(storageKey);
      return value ? JSON.parse(value) : null;
    }, PROMOTION_SESSION_KEY);
    expect(storedCampaign).toMatchObject({ id: "visitas", revision: 4 });

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(root).toHaveAttribute("data-promotion-state", "closed");
    await expect(returnTarget).toBeFocused();
  });

  test("lleva el foco a cotización al activar la campaña", async ({ page }) => {
    await armPromotionForScroll(page);
    await page.goto("/");

    const root = page.locator("[data-promotion-root]");
    const dialog = root.locator("dialog[data-promotion-dialog]");

    await expect(root).toHaveAttribute("data-promotion-state", "armed");
    await scrollToMiddle(page);
    await expect(dialog).toBeVisible();

    await dialog.getByRole("link", { name: "Cotiza tu evento" }).click();

    await expect(page).toHaveURL(/#cotiza$/);
    await expect(root.locator("dialog")).not.toBeVisible();
    await expect(page.locator("#quote-title")).toBeFocused();
  });
});
