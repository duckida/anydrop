import { NextResponse, type NextRequest } from "next/server";
import { ensureAuthenticated, ensureConfigured, errorResponse } from "@/lib/http";
import { loadOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = ensureAuthenticated(request) ?? ensureConfigured();
  if (denied) return denied;

  try {
    return NextResponse.json(await loadOverview());
  } catch (error) {
    return errorResponse(error, 502);
  }
}
