import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_IMAGE_BYTES, readImageForm, readPromotionImage, storePromotionImage } from "../../src/lib/promotion-uploads";
import { storedPromotionSchema } from "../../src/lib/promotion-schema";
import { DEFAULT_PROMOTIONS } from "../../src/lib/promotion-seed";
import { POST } from "../../src/pages/api/promotion-images/index";

vi.mock("../../src/lib/photo-storage", () => ({ uploadPhoto: vi.fn().mockResolvedValue("https://lh3.googleusercontent.com/d/test-photo=w1600") }));
import { uploadPhoto } from "../../src/lib/photo-storage";
let temporaryDirectory: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
});

describe("promotion image uploads", () => {
  it("requires authentication before reading any upload", async () => {
    vi.stubEnv("PROMOTIONS_ADMIN_PASSWORD", "test-secret");
    const response = await POST({ request: new Request("http://localhost/api/promotion-images", { method: "POST" }) } as Parameters<typeof POST>[0]);
    expect(response.status).toBe(401);
  });

  it("normalizes an uploaded image for Drive and preserves historical directory reads", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "lienzo-upload-test-"));
    vi.stubEnv("PROMOTIONS_DATA_FILE", path.join(temporaryDirectory, "promotions.json"));
    const input = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#6f7d78" } }).png().toBuffer();
    const data = new FormData();
    data.set("image", new File([new Uint8Array(input)], "../../photo.png", { type: "image/png" }));
    const form = await readImageForm(new Request("http://localhost/upload", { method: "POST", body: data }));
    const image = await storePromotionImage(form.get("image") as File);
    expect(image.width).toBe(2400);
    expect(image.height).toBe(1200);
    expect(image.src).toBe("https://lh3.googleusercontent.com/d/test-photo=w1600");
    const uploaded = vi.mocked(uploadPhoto).mock.calls.at(-1)!;
    expect(uploaded[1]).toBe("image/webp");
    expect((await sharp(uploaded[0]).metadata()).format).toBe("webp");
    const filename = "11111111-1111-4111-8111-111111111111.webp";
    await mkdir(path.join(temporaryDirectory, "promotion-images"));
    await writeFile(path.join(temporaryDirectory, "promotion-images", filename), uploaded[0]);
    expect(await readPromotionImage(filename)).toEqual(uploaded[0]);
    expect(await readPromotionImage("../../promotions.json")).toBeNull();
    expect(await readPromotionImage("00000000-0000-4000-8000-000000000000.webp")).toBeNull();
  });

  it("rejects invalid bytes and oversized streaming bodies", async () => {
    await expect(storePromotionImage(new File(["not an image"], "fake.jpg", { type: "image/jpeg" }))).rejects.toMatchObject({ status: 415 });
    await expect(storePromotionImage(new File(["<svg/>"], "test.svg", { type: "image/svg+xml" }))).rejects.toMatchObject({ status: 415 });
    const request = new Request("http://localhost/upload", {
      method: "POST", headers: { "content-type": "multipart/form-data; boundary=test" },
      body: new Uint8Array(MAX_IMAGE_BYTES + 100_000),
    });
    await expect(readImageForm(request)).rejects.toMatchObject({ status: 413 });
  });

  it("accepts old campaigns and persists only bounded framing values", () => {
    const campaign = DEFAULT_PROMOTIONS[0]!;
    expect(storedPromotionSchema.safeParse(campaign).success).toBe(true);
    const image = { src: "/photo.webp", alt: "Foto", fit: "contain", positionX: 20, positionY: 70, zoom: 1.5 };
    expect(storedPromotionSchema.parse({ ...campaign, image }).image).toEqual(image);
    expect(storedPromotionSchema.safeParse({ ...campaign, image: { ...image, zoom: 10 } }).success).toBe(false);
    expect(storedPromotionSchema.safeParse({ ...campaign, image: { ...image, positionX: -1 } }).success).toBe(false);
  });
});
