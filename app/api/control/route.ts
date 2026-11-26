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
import { isActiveProject } from "@/lib/shape";

export const dynamic = "force-dynamic";

const ACTIONS: Record<string, number> = {
  pause: 2,
  resume: 3,
  cancel: 4,
};

interface ControlBody {
  printerId?: number;
  projectId?: number;
  action?: string;
}

export async function POST(request: NextRequest) {
  const denied = ensureAuthenticated(request) ?? ensureConfigured();
  if (denied) return denied;

  if (getConfig().demo) {
    return NextResponse.json({ error: "Controls are disabled in demo mode." }, { status: 400 });
  }

  try {
    const body = await readJson<ControlBody>(request);
    const printerId = positiveInt(body.printerId);
    const projectId = positiveInt(body.projectId);
    const orderId = ACTIONS[String(body.action)];

    if (!printerId || !projectId || !orderId) {
      throw new Error("That print control is not valid.");
    }

    const projects = await anycubic.getProjects(1, 30);
    const project = projects.find((entry) => Number(entry.id) === projectId);
    if (!project) throw new Error("That job is no longer in the cloud.");
    if (Number(project.printer_id) !== printerId) {
      throw new Error("That job belongs to a different printer.");
    }
    if (!isActiveProject(project)) {
      throw new Error("That job has already finished.");
    }

    const result = await anycubic.sendOrder({
      order_id: orderId,
      printer_id: printerId,
      project_id: projectId,
      data: null,
      ams_info: null,
      settings: null,
    });

    return NextResponse.json({ ok: true, messageId: extractMessageId(result) });
  } catch (error) {
    return errorResponse(error, 502);
  }
}

function extractMessageId(result: unknown): string | null {
  if (typeof result === "string") return result;
  if (result && typeof result === "object" && "msgid" in result) {
    const value = (result as { msgid?: unknown }).msgid;
    return typeof value === "string" ? value : null;
  }
  return null;
}
