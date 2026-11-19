import { createHmac, timingSafeEqual } from "node:crypto";

export const deskCookie = "orbit_desk";

export function deskPassword(): string {
  return process.env.DESK_PASSWORD || "";
}

export function sessionValue(password: string): string {
  return createHmac("sha256", password).update("orbit-desk-v1").digest("base64url");
}

export function passwordMatches(input: string, expected: string): boolean {
  const given = Buffer.from(input);
  const real = Buffer.from(expected);
  if (given.length !== real.length) return false;
  return timingSafeEqual(given, real);
}

export function sessionIsValid(value: string | undefined): boolean {
  const password = deskPassword();
  if (!password || !value) return false;
  const expected = sessionValue(password);
  const given = Buffer.from(value);
  const real = Buffer.from(expected);
  if (given.length !== real.length) return false;
  return timingSafeEqual(given, real);
}
