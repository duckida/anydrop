import { getConfig } from "./config";
import type { GcodeInfo, PaintInfo, RawPrinter, RawProject, RawSlot, SliceParam } from "./anycubic";

export interface SlotView {
  globalIndex: number;
  boxIndex: number;
  slotIndex: number;
  material: string;
  color: [number, number, number];
  colorHex: string;
  loaded: boolean;
  empty: boolean;
  remainingPercent: number | null;
}

export interface PrinterView {
  id: number;
  name: string;
  model: string;
  online: boolean;
  machineType: number | null;
  nozzleTemp: number | null;
  bedTemp: number | null;
  targetNozzleTemp: number | null;
  targetBedTemp: number | null;
  slots: SlotView[];
  hasAce: boolean;
  boxes: number;
}

export interface JobView {
  id: number;
  printerId: number | null;
  name: string;
  progress: number;
  paused: boolean;
  status: number | null;
  statusLabel: string;
  remainMinutes: number | null;
  elapsedMinutes: number | null;
  imageUrl: string | null;
  material: string | null;
}

export interface MaterialView {
  paintIndex: number;
  materialType: string;
  grams: number;
  color: [number, number, number];
  colorHex: string;
}

export interface UploadResult {
  file: {
    id: number;
    name: string;
    size: number;
    gcodeId: number | null;
  };
  info: {
    name: string;
    estimateSeconds: number | null;
    layerHeight: string | number | null;
    imageUrl: string | null;
    materials: MaterialView[];
  } | null;
  warnings: string[];
}

export interface Overview {
  store: {
    usedBytes: number;
    totalBytes: number;
    usedLabel: string;
    totalLabel: string;
  } | null;
  printers: PrinterView[];
  jobs: JobView[];
  warnings: string[];
  serverTime: string;
}

const ACTIVE_STATUSES = new Set([1, 4, 5, 6, 7, 9]);

const STATUS_LABELS: Record<number, string> = {
  1: "Printing",
  2: "Finished",
  3: "Cancelled",
  4: "Downloading",
  5: "Checking",
  6: "Preheating",
  7: "Slicing",
  9: "Levelling",
};

const FALLBACK_COLORS: Array<[number, number, number]> = [
  [124, 255, 178],
  [255, 184, 107],
  [126, 200, 255],
  [255, 126, 182],
  [214, 180, 255],
  [255, 236, 61],
  [175, 175, 175],
  [255, 255, 255],
];

function toInt(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function rgb(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  const [r, g, b] = value;
  if (![r, g, b].every((channel) => Number.isFinite(Number(channel)))) return fallback;
  return [toInt(r), toInt(g), toInt(b)].map((channel) => Math.min(255, Math.max(0, channel))) as [
    number,
    number,
    number,
  ];
}

export function hexOf(color: [number, number, number]): string {
  return `#${color.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function boxesOf(printer: RawPrinter): Array<{ id?: number; slots: RawSlot[] }> {
  const raw = printer.multi_color_box;
  if (!raw) return [];
  const boxes = Array.isArray(raw) ? raw : [raw];
  return boxes
    .filter((box): box is NonNullable<typeof box> => Boolean(box))
    .map((box) => ({ id: box.id, slots: Array.isArray(box.slots) ? box.slots : [] }));
}

export function slotsOf(printer: RawPrinter): SlotView[] {
  const slots: SlotView[] = [];

  boxesOf(printer).forEach((box, boxIndex) => {
    box.slots.forEach((slot, slotIndex) => {
      const fallback = FALLBACK_COLORS[(boxIndex * 4 + slotIndex) % FALLBACK_COLORS.length];
      const color = rgb(slot.color, fallback);
      const globalIndex = boxIndex * 4 + slotIndex;
      slots.push({
        globalIndex,
        boxIndex,
        slotIndex,
        material: typeof slot.type === "string" && slot.type.trim() ? slot.type.trim() : "—",
        color,
        colorHex: hexOf(color),
        loaded: toInt(slot.status, 0) === 5,
        empty: toInt(slot.edit_status, 0) === 2,
        remainingPercent:
          typeof slot.consumables_percent === "number" ? Math.round(slot.consumables_percent) : null,
      });
    });
  });

  return slots;
}

export function shapePrinter(printer: RawPrinter): PrinterView {
  const slots = slotsOf(printer);
  const parameter = printer.parameter ?? {};

  return {
    id: toInt(printer.id),
    name: typeof printer.name === "string" && printer.name ? printer.name : "Anycubic printer",
    model: typeof printer.model === "string" ? printer.model : "",
    online: toInt(printer.device_status, 0) === 1,
    machineType: printer.machine_type === undefined ? null : toInt(printer.machine_type),
    nozzleTemp: numberOrNull(parameter.curr_nozzle_temp),
    bedTemp: numberOrNull(parameter.curr_hotbed_temp),
    targetNozzleTemp: numberOrNull(parameter.target_nozzle_temp),
    targetBedTemp: numberOrNull(parameter.target_hotbed_temp),
    slots,
    hasAce: slots.length > 0,
    boxes: boxesOf(printer).length,
  };
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isActiveProject(project: RawProject): boolean {
  return ACTIVE_STATUSES.has(toInt(project.print_status, 0));
}

export function projectImageUrl(project: RawProject): string | null {
  const img = project.img;
  if (typeof img === "string" && /^https?:\/\//i.test(img)) return img;

  const imageId = project.slice_param?.image_id;
  if (typeof imageId === "string" && imageId) {
    return `${getConfig().endpoints.imageBase}${imageId}`;
  }

  return null;
}

export function shapeJob(project: RawProject): JobView {
  const status = project.print_status === undefined || project.print_status === null
    ? null
    : toInt(project.print_status);
  const paused = toInt(project.pause, 0) !== 0 && (status === 1 || status === 6 || status === 9);

  return {
    id: toInt(project.id),
    printerId: project.printer_id === undefined ? null : toInt(project.printer_id),
    name:
      (typeof project.gcode_name === "string" && project.gcode_name) ||
      (typeof project.name === "string" && project.name) ||
      "Untitled print",
    progress: Math.min(100, Math.max(0, toInt(project.progress, 0))),
    paused,
    status,
    statusLabel: paused ? "Paused" : status === null ? "Unknown" : STATUS_LABELS[status] ?? "Printing",
    remainMinutes: numberOrNull(project.remain_time),
    elapsedMinutes: numberOrNull(project.print_time),
    imageUrl: projectImageUrl(project),
    material: typeof project.material === "string" && project.material ? project.material : null,
  };
}

export function materialsFromInfo(info: GcodeInfo | null): MaterialView[] {
  const sliceParam: SliceParam | null | undefined = info?.slice_param;
  const paintInfos = Array.isArray(sliceParam?.paint_infos) ? sliceParam.paint_infos : [];

  const materials = paintInfos
    .filter((entry): entry is PaintInfo => Boolean(entry) && typeof entry === "object")
    .map((entry, index) => {
      const fallback = FALLBACK_COLORS[index % FALLBACK_COLORS.length];
      const color = rgb(entry.paint_color, fallback);
      return {
        paintIndex: toInt(entry.paint_index, index),
        materialType:
          typeof entry.material_type === "string" && entry.material_type.trim()
            ? entry.material_type.trim()
            : "PLA",
        grams: Math.max(0, Number(entry.filament_used) || 0),
        color,
        colorHex: hexOf(color),
      };
    });

  if (materials.length > 0) return materials;

  // A single-material file can arrive without paint_infos. The printer still
  // needs one mapping entry on an ACE machine, so offer one neutral row.
  return [
    {
      paintIndex: 0,
      materialType: "PLA",
      grams: 0,
      color: FALLBACK_COLORS[0],
      colorHex: hexOf(FALLBACK_COLORS[0]),
    },
  ];
}

export function pickSlotForMaterial(
  material: MaterialView,
  slots: SlotView[],
  used: Set<number>,
): number | null {
  const available = slots.filter((slot) => !used.has(slot.globalIndex) && !slot.empty);
  const pool = available.length > 0 ? available : slots;

  const exact = pool.find(
    (slot) =>
      slot.material.toUpperCase() === material.materialType.toUpperCase() &&
      slot.colorHex.toLowerCase() === material.colorHex.toLowerCase(),
  );
  if (exact) return exact.globalIndex;

  const sameMaterial = pool.find(
    (slot) => slot.material.toUpperCase() === material.materialType.toUpperCase(),
  );
  if (sameMaterial) return sameMaterial.globalIndex;

  return pool[0]?.globalIndex ?? null;
}
