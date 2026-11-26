import { NextResponse, type NextRequest } from "next/server";
import { anycubic } from "@/lib/anycubic";
import { getConfig } from "@/lib/config";
import {
  ensureAuthenticated,
  ensureConfigured,
  errorResponse,
  positiveInt,
  readJson,
} from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = ensureAuthenticated(request) ?? ensureConfigured();
  if (denied) return denied;

  if (getConfig().demo) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = await readJson<{ lockId?: number; deleteObject?: boolean }>(request);
    const lockId = positiveInt(body.lockId);
    if (!lockId) throw new Error("The upload lock is missing.");

    await anycubic.unlockStorage(lockId, Boolean(body.deleteObject));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 502);
  }
}
