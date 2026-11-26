import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  authRequired,
  checkPassword,
  createSessionValue,
  sessionCookieOptions,
} from "@/lib/auth";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 5 * 60_000;
const MAX_ATTEMPTS = 12;

function clientKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: NextRequest) {
  if (!authRequired()) {
    return NextResponse.json({ ok: true });
  }

  const key = clientKey(request);
  const now = Date.now();
  const record = attempts.get(key);

  if (record && record.resetAt > now && record.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const body = await readJson<{ password?: string }>(request);
  const password = typeof body.password === "string" ? body.password : "";

  if (!checkPassword(password)) {
    // A small delay makes a scripted guess measurably slower without making
    // the UI feel sluggish for a real typo.
    await new Promise((resolve) => setTimeout(resolve, 350));
    const fresh = !record || record.resetAt <= now;
    attempts.set(key, {
      count: fresh ? 1 : record.count + 1,
      resetAt: fresh ? now + WINDOW_MS : record.resetAt,
    });
    return NextResponse.json({ error: "That password is not right." }, { status: 401 });
  }

  attempts.delete(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionValue(), sessionCookieOptions);
  return response;
}
