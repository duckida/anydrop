import { NextResponse, type NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getConfig } from "@/lib/config";
import { ensureAuthenticated, ensureConfigured } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const denied = ensureAuthenticated(request) ?? ensureConfigured();
  if (denied) return denied;

  const config = getConfig();
  if (!config.blobToken) {
    return NextResponse.json({ error: "Blob staging is not configured." }, { status: 400 });
  }
  if (config.demo) {
    return NextResponse.json({ error: "Uploads are disabled in demo mode." }, { status: 400 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      token: config.blobToken,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("anydrop/")) {
          throw new Error("The staged upload path is not valid.");
        }
        return {
          maximumSizeInBytes: config.maxRelayBytes,
          addRandomSuffix: true,
          allowOverwrite: false,
        };
      },
      onUploadCompleted: async () => {
        // The commit route pulls the blob itself; nothing to persist here.
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The staged upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
