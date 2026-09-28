import { expect, test } from "@playwright/test";

test("production home serves prebuilt images and loads promotions separately", async ({ page, request }) => {
  test.skip(!process.env.E2E_PRODUCTION, "Requires the production build");
  const promotionRequest = page.waitForResponse("**/api/public-promotions");
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(await response!.text()).not.toContain("/_image?");
  expect((await promotionRequest).status()).toBe(200);
  await expect(page.locator("[data-promotion-root]")).toHaveAttribute("data-promotion-initialized", "true");
  const urls = await page.locator('img[src], [data-zoom-src]').evaluateAll(elements =>
    [...new Set(elements.flatMap(element => [element.getAttribute('src'), element.getAttribute('data-zoom-src')]).filter((src): src is string => !!src && src.startsWith('/assets/')))]
  );
  expect(urls.length).toBeGreaterThan(20);
  for (const url of urls) expect((await request.get(url)).status()).toBe(200);
  expect((await request.get('/api/promotions')).status()).toBeGreaterThanOrEqual(401);
  expect((await request.get('/admin/promociones')).status()).toBe(200);
});
