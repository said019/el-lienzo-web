import { expect, test } from "@playwright/test";

test.use({ javaScriptEnabled: false });

test("mantiene visible la cotización y el fallback de WhatsApp sin JavaScript", async ({
  page,
}) => {
  await page.goto("/");

  const section = page.locator("#cotiza");
  await section.scrollIntoViewIfNeeded();
  await expect(
    section.getByRole("heading", { name: "Empecemos por tu idea." }),
  ).toBeVisible();
  await expect(
    section.getByRole("form", { name: "Formulario de cotización" }),
  ).toBeVisible();
  await expect(
    section.locator('a[href^="https://wa.me/524271032890"]').first(),
  ).toBeVisible();

  const revealOpacity = await section
    .locator("[data-reveal]")
    .first()
    .evaluate((element) => getComputedStyle(element).opacity);
  expect(revealOpacity).toBe("1");
});
