import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { getConfig } from "./config";

export const SESSION_COOKIE = "anydrop_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  const config = getConfig();
  if (config.sessionSecret) return config.sessionSecret;
  // A password is itself a secret, so it can key the session cookie. If no
  // password is configured the app is open and no cookie is ever checked.
  return crypto.createHash("sha256").update(`anydrop:${config.password}`).digest("hex");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export function passwordConfigured(): boolean {
  return getConfig().password.length > 0;
}

export function authRequired(): boolean {
  // The dashboard is password-gated. Demo mode stays usable without one.
  return passwordConfigured() || !getConfig().demo;
}

export function createSessionValue(): string {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `v1.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(value: string | undefined): boolean {
  if (!authRequired()) return true;
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const [version, expiresRaw, signature] = parts;
  if (version !== "v1") return false;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;

  const expected = sign(`${version}.${expiresRaw}`);
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function checkPassword(candidate: string): boolean {
  const expected = getConfig().password;
  if (!expected) return true;
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isAuthenticated(request: NextRequest): boolean {
  if (!authRequired()) return true;
  return verifySessionValue(request.cookies.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
