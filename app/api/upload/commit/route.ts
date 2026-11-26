import { NextResponse, type NextRequest } from "next/server";
import { del, get } from "@vercel/blob";
import {
  anycubic,
  isPresignedAnycubicUrl,
  type GcodeInfo,
  type RawFile,
} from "@/lib/anycubic";
import { getConfig } from "@/lib/config";
import {
  ensureAuthenticated,
  ensureConfigured,
  errorResponse,
  positiveInt,
  readJson,
} from "@/lib/http";
import { materialsFromInfo } from "@/lib/shape";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface CommitBody {
  lockId?: number;
  presignUrl?: string;
  name?: string;
  size?: number;
  blobPathname?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function infoImageUrl(info: GcodeInfo): string | null {
  const imageId = info.image_id ?? info.slice_param?.image_id;
  if (typeof imageId === "string" && imageId) {
    return `${getConfig().endpoints.imageBase}${imageId}`;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = ensureAuthenticated(request) ?? ensureConfigured();
  if (denied) return denied;

  const config = getConfig();
  if (config.demo) {
    return NextResponse.json({ error: "Uploads are disabled in demo mode." }, { status: 400 });
  }

  let lockId: number | null = null;
  let claimed = false;

  try {
    const body = await readJson<CommitBody>(request);
    lockId = positiveInt(body.lockId);
    const size = positiveInt(body.size);
    const presignUrl = typeof body.presignUrl === "string" ? body.presignUrl : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const blobPathname = typeof body.blobPathname === "string" ? body.blobPathname : "";

    if (!lockId || !size || !name) throw new Error("The upload details are incomplete.");
    if (!isPresignedAnycubicUrl(presignUrl)) {
      throw new Error("The upload URL is not an Anycubic storage URL.");
    }

    if (blobPathname) {
      if (!blobPathname.startsWith("anydrop/")) {
        throw new Error("The staged upload path is not valid.");
      }
      if (!config.blobToken) {
        throw new Error("Blob staging is not configured on this deployment.");
      }

      const staged = await get(blobPathname, { access: config.blobAccess, useCache: false });
      if (!staged || staged.statusCode !== 200 || !staged.stream) {
        throw new Error("The staged upload could not be found. Try the upload again.");
      }

      const bytes = Buffer.from(await new Response(staged.stream).arrayBuffer());
      if (bytes.byteLength !== size) {
        throw new Error("The staged upload was incomplete. Try again.");
      }
      if (bytes.byteLength > config.maxRelayBytes) {
        throw new Error("That file is too large to relay through this deployment.");
      }

      await anycubic.uploadToPresignedUrl(presignUrl, bytes);
      await del(blobPathname).catch(() => undefined);
    }

    const fileId = await anycubic.claimUpload(lockId);
    claimed = true;

    // The lock only has to survive until the file is claimed. Releasing it
    // afterwards keeps the account's storage accounting accurate.
    await anycubic.unlockStorage(lockId, false).catch(() => undefined);

    const warnings: string[] = [];
    let file: RawFile | undefined;

    for (let attempt = 0; attempt < 3 && !file; attempt += 1) {
      if (attempt > 0) await sleep(900);
      const files = await anycubic.listFiles(1, 30).catch((error) => {
        warnings.push(`Could not list cloud files: ${messageOf(error)}`);
        return [] as RawFile[];
      });
      file = files.find((entry) => Number(entry.id) === fileId);
    }

    let info: GcodeInfo | null = null;
    if (file?.gcode_id) {
      info = await anycubic.getGcodeInfo(Number(file.gcode_id)).catch((error) => {
        warnings.push(`Could not read the G-code details: ${messageOf(error)}`);
        return null;
      });
    } else if (file) {
      warnings.push("Anycubic has not finished analysing the file yet.");
    }

    return NextResponse.json({
      file: {
        id: fileId,
        name: info?.name || file?.old_filename || file?.filename || name,
        size: Number(file?.size ?? size),
        gcodeId: file?.gcode_id ? Number(file.gcode_id) : info?.gcode_id ?? null,
      },
      info: info
        ? {
            name: info.name,
            estimateSeconds: Number(info.estimate) || null,
            layerHeight: info.slice_param?.layer_height ?? null,
            imageUrl: infoImageUrl(info),
            materials: materialsFromInfo(info),
          }
        : null,
      warnings,
    });
  } catch (error) {
    if (lockId && !claimed) {
      await anycubic.unlockStorage(lockId, true).catch(() => undefined);
    }
    return errorResponse(error, 502);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
