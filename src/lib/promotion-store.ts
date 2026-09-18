import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { storedPromotionsSchema, type StoredPromotion } from "./promotion-schema";
import { DEFAULT_PROMOTIONS } from "./promotion-seed";

export function promotionStorePath(): string {
  const configuredPath = process.env.PROMOTIONS_DATA_FILE?.trim();
  return configuredPath || path.resolve(process.cwd(), "data/promotions.json");
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export async function readPromotionStore(): Promise<StoredPromotion[]> {
  const storePath = promotionStorePath();

  try {
    const raw = await readFile(storePath, "utf8");
    return storedPromotionsSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (!isMissingFile(error)) throw error;

    await writePromotionStore(DEFAULT_PROMOTIONS);
    return DEFAULT_PROMOTIONS;
  }
}

export async function writePromotionStore(
  promotions: readonly StoredPromotion[],
): Promise<StoredPromotion[]> {
  const parsed = storedPromotionsSchema.parse(promotions);
  const storePath = promotionStorePath();
  const directory = path.dirname(storePath);
  const temporaryPath = `${storePath}.${process.pid}.${randomUUID()}.tmp`;

  await mkdir(directory, { recursive: true });

  try {
    await writeFile(temporaryPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    await rename(temporaryPath, storePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }

  return parsed;
}
