"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBytes, formatGrams, formatSeconds } from "@/lib/format";
import type { MaterialView, PrinterView, SlotView, UploadResult } from "@/lib/shape";
import { AlertIcon, ClockIcon, CloseIcon, LayersIcon, UploadIcon } from "./icons";
import { Pill, Spinner } from "./ui";

const FALLBACK: MaterialView = {
  paintIndex: 0,
  materialType: "PLA",
  grams: 0,
  color: [255, 255, 255],
  colorHex: "#ffffff",
};

function chooseSlot(material: MaterialView, slots: SlotView[], used: Set<number>): number | null {
  const unused = slots.filter((slot) => !used.has(slot.globalIndex));
  const loaded = unused.filter((slot) => !slot.empty);
  const pool = loaded.length > 0 ? loaded : unused.length > 0 ? unused : slots;

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

export function PrintDialog({
  result,
  printers,
  initialPrinterId,
  demo,
  onClose,
  onStarted,
}: {
  result: UploadResult;
  printers: PrinterView[];
  initialPrinterId: number | null;
  demo: boolean;
  onClose: () => void;
  onStarted: () => void;
}) {
  const materials = useMemo<MaterialView[]>(
    () => (result.info?.materials?.length ? result.info.materials : [FALLBACK]),
    [result],
  );

  const initialPrinter =
    printers.find((printer) => printer.id === initialPrinterId) ??
    printers.find((printer) => printer.online) ??
    printers[0] ??
    null;

  const [printerId, setPrinterId] = useState<number | null>(initialPrinter?.id ?? null);
  const [mapping, setMapping] = useState<Record<number, number>>({});
  const [deleteAfter, setDeleteAfter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageOk, setImageOk] = useState(true);

  const printer = printers.find((entry) => entry.id === printerId) ?? null;

  useEffect(() => {
    if (!printer) {
      setMapping({});
      return;
    }
    const used = new Set<number>();
    const next: Record<number, number> = {};
    for (const material of materials) {
      const slot = chooseSlot(material, printer.slots, used);
      if (slot !== null) {
        next[material.paintIndex] = slot;
        used.add(slot);
      }
    }
    setMapping(next);
    // Only reset the defaults when the selected printer changes; the user's
    // own choices must survive a status poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printer?.id, materials]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [busy, onClose]);

  const needsSlots = Boolean(printer?.hasAce);
  const mappingComplete =
    !needsSlots || materials.every((material) => mapping[material.paintIndex] !== undefined);
  const totalGrams = materials.reduce((sum, material) => sum + material.grams, 0);
  const canStart =
    Boolean(printer) && printer!.online && !busy && !demo && mappingComplete && printers.length > 0;

  async function start() {
    if (!printer || !canStart) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerId: printer.id,
          fileId: result.file.id,
          deleteAfter,
          materials: needsSlots
            ? materials.map((material) => ({
                paintIndex: material.paintIndex,
                filamentUsed: material.grams,
                materialType: material.materialType,
                slotIndex: mapping[material.paintIndex],
              }))
            : [],
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not start the print.");
      onStarted();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not start the print.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="print-title">
        <div className="modal-head">
          <div>
            <span className="eyebrow">
              <UploadIcon size={13} /> Uploaded
            </span>
            <h2 id="print-title">Start a print</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="file-summary">
          <div className="file-art">
            {result.info?.imageUrl && imageOk ? (
              <img
                src={result.info.imageUrl}
                alt=""
                onError={() => setImageOk(false)}
              />
            ) : (
              <LayersIcon size={26} />
            )}
          </div>
          <div className="file-text">
            <strong>{result.info?.name || result.file.name}</strong>
            <span className="muted">
              {formatBytes(result.file.size)}
              {result.info?.estimateSeconds ? ` · ${formatSeconds(result.info.estimateSeconds)}` : ""}
              {result.info?.layerHeight ? ` · ${formatLayerHeight(result.info.layerHeight)} layer` : ""}
            </span>
          </div>
          <Pill tone="ok">Ready</Pill>
        </div>

        <div className="modal-section">
          <label className="field">
            <span>Printer</span>
            <select
              className="select"
              value={printerId ?? ""}
              onChange={(event) => setPrinterId(Number(event.target.value))}
              disabled={busy || printers.length === 0}
            >
              {printers.length === 0 ? <option value="">No printers found</option> : null}
              {printers.map((entry) => (
                <option key={entry.id} value={entry.id} disabled={!entry.online}>
                  {entry.name}
                  {entry.online ? "" : " — offline"}
                </option>
              ))}
            </select>
          </label>

          {printer && !printer.online ? (
            <p className="inline-warning">
              <AlertIcon size={15} /> This printer is offline. Wake it before starting.
            </p>
          ) : null}
        </div>

        <div className="modal-section">
          <div className="section-head">
            <h3>Filament</h3>
            <span className="muted tiny">
              {needsSlots ? "Match each colour to an ACE slot" : "Single colour"}
            </span>
          </div>

          <div className="materials">
            {materials.map((material) => {
              const selectedSlot = printer?.slots.find(
                (slot) => slot.globalIndex === mapping[material.paintIndex],
              );
              const mismatch =
                selectedSlot &&
                !selectedSlot.empty &&
                selectedSlot.material.toUpperCase() !== material.materialType.toUpperCase();

              return (
                <div className="material-row" key={material.paintIndex}>
                  <span className="swatch" style={{ background: material.colorHex }} />
                  <span className="material-text">
                    <strong>{material.materialType}</strong>
                    <span className="muted">
                      {material.grams > 0 ? formatGrams(material.grams) : "usage unknown"}
                      {mismatch ? ` · slot holds ${selectedSlot.material}` : ""}
                    </span>
                  </span>

                  {needsSlots && printer ? (
                    <select
                      className="select compact"
                      value={mapping[material.paintIndex] ?? ""}
                      onChange={(event) =>
                        setMapping((current) => ({
                          ...current,
                          [material.paintIndex]: Number(event.target.value),
                        }))
                      }
                      disabled={busy}
                      aria-label={`Slot for ${material.materialType}`}
                    >
                      {mapping[material.paintIndex] === undefined ? (
                        <option value="">Pick a slot</option>
                      ) : null}
                      {printer.slots.map((slot) => (
                        <option key={slot.globalIndex} value={slot.globalIndex} disabled={slot.empty}>
                          Slot {slot.globalIndex + 1} · {slot.empty ? "empty" : slot.material}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="muted tiny">as sliced</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {result.warnings.length > 0 || !result.info ? (
          <div className="modal-warnings">
            {result.warnings.map((warning) => (
              <p key={warning}>
                <AlertIcon size={14} /> {warning}
              </p>
            ))}
            {!result.info ? (
              <p>
                <AlertIcon size={14} /> Anycubic is still analysing this file. It can print, but the
                material estimate is missing.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="inline-error">
            <AlertIcon size={16} /> {error}
          </p>
        ) : null}

        <div className="modal-foot">
          <div className="modal-summary">
            <span>
              <ClockIcon size={14} /> {result.info?.estimateSeconds ? formatSeconds(result.info.estimateSeconds) : "time unknown"}
            </span>
            <span>
              <LayersIcon size={14} /> {totalGrams > 0 ? formatGrams(totalGrams) : "filament unknown"}
            </span>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={deleteAfter}
              onChange={(event) => setDeleteAfter(event.target.checked)}
              disabled={busy}
            />
            <span>Remove from cloud after it starts</span>
          </label>

          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={start} disabled={!canStart}>
              {busy ? <Spinner /> : null}
              {busy ? "Starting…" : demo ? "Demo mode" : "Start print"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatLayerHeight(value: string | number): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(2)} mm` : String(value);
}
