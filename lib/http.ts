import { NextResponse, type NextRequest } from "next/server";
import { authRequired, isAuthenticated } from "./auth";
import { getConfig } from "./config";
import { AnycubicError } from "./anycubic";

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
}

export function ensureAuthenticated(request: NextRequest): NextResponse | null {
  if (!authRequired()) return null;
  return isAuthenticated(request) ? null : unauthorized();
}

export function ensureConfigured(): NextResponse | null {
  const config = getConfig();
  if (config.demo || config.token) return null;
  return NextResponse.json(
    {
      error:
        "ANYCUBIC_TOKEN is not set. Add it in your environment variables (see README) and redeploy.",
    },
    { status: 503 },
  );
}

export function errorResponse(error: unknown, fallbackStatus = 400): NextResponse {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const status = error instanceof AnycubicError && error.status === 401 ? 401 : fallbackStatus;
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid request body.");
  }
}

export function positiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
