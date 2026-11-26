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
import { isActiveProject, slotsOf } from "@/lib/shape";

export const dynamic = "force-dynamic";

interface MaterialInput {
  paintIndex?: number;
  filamentUsed?: number;
  materialType?: string;
  slotIndex?: number;
}

interface PrintBody {
  printerId?: number;
  fileId?: number;
  deleteAfter?: boolean;
  materials?: MaterialInput[];
}

export async function POST(request: NextRequest) {
  const denied = ensureAuthenticated(request) ?? ensureConfigured();
  if (denied) return denied;

  if (getConfig().demo) {
    return NextResponse.json({ error: "Printing is disabled in demo mode." }, { status: 400 });
  }

  try {
    const body = await readJson<PrintBody>(request);
    const printerId = positiveInt(body.printerId);
    const fileId = positiveInt(body.fileId);
    if (!printerId || !fileId) throw new Error("Choose a printer and a file first.");

    const printers = await anycubic.getPrinters();
    const printer = printers.find((entry) => Number(entry.id) === printerId);
    if (!printer) throw new Error("That printer is not on this Anycubic account.");
    if (Number(printer.device_status) !== 1) throw new Error("That printer is offline.");

    const projects = await anycubic.getProjects(1, 30);
    const busy = projects.find(
      (project) => Number(project.printer_id) === printerId && isActiveProject(project),
    );
    if (busy) throw new Error("That printer is already running a job. Pause or cancel it first.");

    const slots = slotsOf(printer);
    const materials = Array.isArray(body.materials) ? body.materials : [];

    let amsInfo: Record<string, unknown> | null = null;

    if (slots.length > 0) {
      if (materials.length === 0) {
        throw new Error("This printer has an ACE unit, so each material needs a slot.");
      }

      const mapping = materials.map((material, index) => {
        const slotIndex = Number(material.slotIndex);
        const slot = slots.find((entry) => entry.globalIndex === slotIndex);
        if (!slot) throw new Error(`Slot ${slotIndex + 1} is not attached to this printer.`);

        return {
          ams_color: slot.color,
          ams_index: slot.globalIndex,
          filament_used: Math.max(0, Number(material.filamentUsed) || 0),
          material_type:
            typeof material.materialType === "string" && material.materialType.trim()
              ? material.materialType.trim()
              : slot.material,
          paint_color: slot.color,
          paint_index: Number.isInteger(material.paintIndex) ? Number(material.paintIndex) : index,
        };
      });

      amsInfo = { ams_box_mapping: mapping, use_ams: true };
    }

    const result = await anycubic.sendOrder({
      order_id: 1,
      printer_id: printerId,
      project_id: 0,
      data: {
        filetype: 0,
        file_key: "",
        file_name: "",
        task_settings: { ai_detect: 0, camera_timelapse: 0 },
        file_id: fileId,
        hollow_param: null,
        is_delete_file: body.deleteAfter ? 1 : 0,
        matrix: "",
        project_type: 1,
        punching_param: null,
        slice_param: null,
        slice_size: null,
        template_id: 0,
      },
      ams_info: amsInfo,
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
