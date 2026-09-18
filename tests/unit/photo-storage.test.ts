import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadPhoto } from "../../src/lib/photo-storage";

const bytes = Buffer.from("photo-fixture");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let fetchMock: ReturnType<typeof vi.fn>;
function successfulUpload() {
  fetchMock.mockResolvedValueOnce(json({ access_token: "photo-token" }))
    .mockResolvedValueOnce(new Response(null, { status: 200, headers: { location: "https://www.googleapis.com/upload/drive/v3/files?upload_id=test" } }))
    .mockResolvedValueOnce(json({ id: "photo-id", md5Checksum: createHash("md5").update(bytes).digest("hex"), size: String(bytes.length) }))
    .mockResolvedValueOnce(json({}));
}
beforeEach(() => {
  for (const [key, value] of Object.entries({ PHOTOS_DRIVE_CLIENT_ID: "photo-client", PHOTOS_DRIVE_CLIENT_SECRET: "photo-secret", PHOTOS_DRIVE_REFRESH_TOKEN: "photo-refresh", PHOTOS_DRIVE_FOLDER_ID: "own-photo-folder", GOOGLE_CLIENT_ID: "legacy-client" })) vi.stubEnv(key, value);
  fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("public promotion Drive storage", () => {
  it("uses its own account and folder, verifies bytes and publishes only the file", async () => {
    successfulUpload();
    expect(await uploadPhoto(bytes, "image/webp")).toBe("https://lh3.googleusercontent.com/d/photo-id=w1600");
    const tokenBody = new URLSearchParams(fetchMock.mock.calls[0]![1].body);
    expect(tokenBody.get("client_id")).toBe("photo-client");
    expect(tokenBody.get("refresh_token")).toBe("photo-refresh");
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).parents).toEqual(["own-photo-folder"]);
    expect(Buffer.from(fetchMock.mock.calls[2]![1].body)).toEqual(bytes);
    expect(fetchMock.mock.calls[3]![0]).toBe("https://www.googleapis.com/drive/v3/files/photo-id/permissions");
    expect(JSON.parse(fetchMock.mock.calls[3]![1].body)).toEqual({ type: "anyone", role: "reader" });
    expect(process.env.GOOGLE_CLIENT_ID).toBe("legacy-client");
  });

  it("rejects unsupported formats and oversized bytes before any request", async () => {
    await expect(uploadPhoto(Buffer.alloc(10 * 1024 * 1024 + 1), "image/png")).rejects.toThrow();
    await expect(uploadPhoto(bytes, "image/svg+xml")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not silently fall back when configuration or authorization fails", async () => {
    vi.stubEnv("PHOTOS_DRIVE_FOLDER_ID", "");
    await expect(uploadPhoto(bytes, "image/png")).rejects.toThrow("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("PHOTOS_DRIVE_FOLDER_ID", "own-photo-folder");
    fetchMock.mockResolvedValueOnce(json({}, 401));
    await expect(uploadPhoto(bytes, "image/png")).rejects.toThrow("authorization failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects resumable upload redirects outside Google before transmitting image bytes", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "photo-token" }))
      .mockResolvedValueOnce(new Response(null, { headers: { location: "https://attacker.example/upload" } }));
    await expect(uploadPhoto(bytes, "image/png")).rejects.toThrow("Invalid upload location");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deletes an integrity mismatch without publishing it", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "photo-token" }))
      .mockResolvedValueOnce(new Response(null, { headers: { location: "https://www.googleapis.com/upload/session" } }))
      .mockResolvedValueOnce(json({ id: "bad-photo", md5Checksum: "wrong", size: String(bytes.length) }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(uploadPhoto(bytes, "image/png")).rejects.toThrow("integrity");
    expect(fetchMock.mock.calls[3]![1].method).toBe("DELETE");
    expect(fetchMock.mock.calls.some(call => String(call[0]).endsWith("/permissions"))).toBe(false);
  });

  it("removes the uploaded file when public access cannot be established", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "photo-token" }))
      .mockResolvedValueOnce(new Response(null, { headers: { location: "https://www.googleapis.com/upload/session" } }))
      .mockResolvedValueOnce(json({ id: "photo-id", md5Checksum: createHash("md5").update(bytes).digest("hex"), size: String(bytes.length) }))
      .mockResolvedValueOnce(json({}, 403))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(uploadPhoto(bytes, "image/png")).rejects.toThrow("Photo access failed");
    expect(fetchMock.mock.calls[4]![1].method).toBe("DELETE");
  });
});
