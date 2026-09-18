import { timingSafeEqual } from "node:crypto";

export function hasValidAdminPassword(request: Request): boolean {
  const configuredPassword = process.env.PROMOTIONS_ADMIN_PASSWORD;
  if (!configuredPassword) return false;

  const authorization = request.headers.get("authorization") ?? "";
  const suppliedPassword = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  const expected = Buffer.from(configuredPassword);
  const supplied = Buffer.from(suppliedPassword);

  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.PROMOTIONS_ADMIN_PASSWORD);
}
