import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PROMOTION_SESSION_KEY = "el-lienzo:promotion-shown";

test("no presenta violaciones Axe críticas o serias", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    window.sessionStorage.setItem(storageKey, "e2e-seen");
  }, PROMOTION_SESSION_KEY);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  for (const section of ["#espacios", "#experiencias", "#galeria", "#cotiza"]) {
    await page.locator(section).scrollIntoViewIfNeeded();
  }

  const results = await new AxeBuilder({ page })
    .withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22a",
      "wcag22aa",
    ])
    .analyze();
  const blockingViolations = results.violations.filter(
    ({ impact }) => impact === "critical" || impact === "serious",
  );

  expect(
    blockingViolations,
    blockingViolations
      .map(
        (violation) =>
          `${violation.id}: ${violation.help}\n${violation.nodes
            .map((node) => `  ${node.target.join(" ")}: ${node.failureSummary}`)
            .join("\n")}`,
      )
      .join("\n\n"),
  ).toEqual([]);
});

test("refluye al ampliar el texto al 200 % sin recortar contenido", async ({
  page,
}) => {
  await page.addInitScript((storageKey) => {
    window.sessionStorage.setItem(storageKey, "e2e-seen");
  }, PROMOTION_SESSION_KEY);
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
});
