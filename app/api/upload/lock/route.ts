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

function safeName(value: unknown): string {
  if (typeof value !== "string") throw new Error("A file name is required.");
  const name = value.split(/[\\/]/).pop()?.trim() ?? "";
  if (!name || name.length > 180) throw new Error("That file name is not valid.");
  if (!/\.(gcode|gco)$/i.test(name)) throw new Error("Choose a .gcode file.");
  return name;
}

export async function POST(request: NextRequest) {
  const denied = ensureAuthenticated(request) ?? ensureConfigured();
  if (denied) return denied;

  const config = getConfig();
  if (config.demo) {
    return NextResponse.json({ error: "Uploads are disabled in demo mode." }, { status: 400 });
  }

  try {
    const body = await readJson<{ name?: string; size?: number }>(request);
    const name = safeName(body.name);
    const size = positiveInt(body.size);

    if (!size) throw new Error("The file appears to be empty.");
    if (size > config.maxUploadBytes) {
      throw new Error(
        `That file is larger than the ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB limit.`,
      );
    }

    const store = await anycubic.getUserStore();
    if (store && store.total_bytes > 0 && store.used_bytes + size > store.total_bytes) {
      throw new Error("There is not enough space left in your Anycubic cloud storage.");
    }

    const lock = await anycubic.lockStorage(size, name);

    return NextResponse.json({
      lockId: lock.id,
      presignUrl: lock.preSignUrl,
      name,
      size,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
