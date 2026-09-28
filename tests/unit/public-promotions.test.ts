import { afterEach, expect, it, vi } from "vitest";
import { GET } from "../../src/pages/api/public-promotions";
import { readPromotionStore } from "../../src/lib/promotion-store";
import { DEFAULT_PROMOTIONS } from "../../src/lib/promotion-seed";

vi.mock("../../src/lib/promotion-store", () => ({ readPromotionStore: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

it("reads current content on every request and excludes disabled campaigns", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  const active = { ...DEFAULT_PROMOTIONS[0]!, enabled: true, startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-10-31T00:00:00Z" };
  vi.mocked(readPromotionStore).mockResolvedValue([
    active,
    { ...active, id: "draft", enabled: false, priority: 999 },
    { ...active, id: "future", startsAt: "2026-10-01T00:00:00Z", priority: 999 },
    { ...active, id: "expired", endsAt: "2026-09-20T00:00:00Z", priority: 999 },
  ]);
  const response = await GET({} as never);
  expect(await response.json()).toEqual([active]);
  expect(response.headers.get("cache-control")).toContain("no-store");
  vi.mocked(readPromotionStore).mockResolvedValue([]);
  expect(await (await GET({} as never)).json()).toEqual([]);
});

it("fails closed when storage is unavailable", async () => {
  vi.mocked(readPromotionStore).mockRejectedValue(new Error("offline"));
  const response = await GET({} as never);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual([]);
});
