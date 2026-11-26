import { NextResponse, type NextRequest } from "next/server";
import { authRequired, isAuthenticated, passwordConfigured } from "@/lib/auth";
import { publicConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    ...publicConfig(),
    authRequired: authRequired(),
    passwordConfigured: passwordConfigured(),
    authenticated: isAuthenticated(request),
  });
}
