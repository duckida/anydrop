"use client";

import { formatBytes } from "@/lib/format";
import type { Overview, PrinterView } from "@/lib/shape";
import { CheckIcon, FolderIcon, PrinterIcon, ThermometerIcon } from "./icons";
import { Pill } from "./ui";

export function PrinterCard({
  printers,
  selectedId,
  onSelect,
}: {
  printers: PrinterView[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const selected = printers.find((printer) => printer.id === selectedId) ?? printers[0] ?? null;

  return (
    <section className="panel printer-panel">
      <div className="panel-head">
        <div>
          <h2>Printer</h2>
          <p className="muted">
            {printers.length === 0
              ? "No printers on this account"
              : printers.length === 1
                ? "Connected through Anycubic cloud"
                : `${printers.length} printers on this account`}
          </p>
        </div>
        {selected ? (
          <Pill tone={selected.online ? "ok" : "bad"}>{selected.online ? "Online" : "Offline"}</Pill>
        ) : null}
      </div>

      {printers.length === 0 ? (
        <div className="empty-state">
          <PrinterIcon size={26} />
          <p>Add a printer in the Anycubic app, then refresh.</p>
        </div>
      ) : (
        <>
          <div className="printer-list">
            {printers.map((printer) => (
              <button
                key={printer.id}
                type="button"
                className={`printer-row ${printer.id === selected?.id ? "is-selected" : ""}`}
                onClick={() => onSelect(printer.id)}
              >
                <span className={`dot ${printer.online ? "is-on" : ""}`} />
                <span className="printer-row-text">
                  <strong>{printer.name}</strong>
                  <span>{printer.model || "Anycubic"}</span>
                </span>
                {printer.id === selected?.id ? <CheckIcon size={16} /> : null}
              </button>
            ))}
          </div>

          {selected ? (
            <>
              <div className="temps">
                <div className="temp">
                  <ThermometerIcon size={17} />
                  <span>Nozzle</span>
                  <strong>{selected.nozzleTemp === null ? "—" : `${selected.nozzleTemp}°`}</strong>
                  <small>
                    {selected.targetNozzleTemp ? `target ${selected.targetNozzleTemp}°` : "idle"}
                  </small>
                </div>
                <div className="temp">
                  <ThermometerIcon size={17} />
                  <span>Bed</span>
                  <strong>{selected.bedTemp === null ? "—" : `${selected.bedTemp}°`}</strong>
                  <small>{selected.targetBedTemp ? `target ${selected.targetBedTemp}°` : "idle"}</small>
                </div>
              </div>

              {selected.hasAce ? (
                <div className="ace">
                  <div className="ace-head">
                    <span>ACE filament</span>
                    <span className="muted tiny">
                      {selected.boxes} unit{selected.boxes === 1 ? "" : "s"} · {selected.slots.length} slots
                    </span>
                  </div>
                  <div className="slots">
                    {selected.slots.map((slot) => (
                      <div className={`slot ${slot.empty ? "is-empty" : ""}`} key={slot.globalIndex}>
                        <span
                          className="spool"
                          style={{ background: slot.empty ? "transparent" : slot.colorHex }}
                        />
                        <span className="slot-text">
                          <strong>Slot {slot.globalIndex + 1}</strong>
                          <span>{slot.empty ? "empty" : slot.material}</span>
                        </span>
                        <span className="slot-bar" aria-hidden="true">
                          <i style={{ width: `${slot.remainingPercent ?? 0}%` }} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="hint">No ACE unit attached. Single-colour prints only.</p>
              )}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

export function StoragePanel({ store }: { store: Overview["store"] }) {
  const used = store?.usedBytes ?? 0;
  const total = store?.totalBytes ?? 0;
  const percent = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  return (
    <section className="panel storage-panel">
      <div className="panel-head">
        <div>
          <h2>Cloud storage</h2>
          <p className="muted">Your Anycubic account</p>
        </div>
        <span className="storage-percent">{total > 0 ? `${Math.round(percent)}%` : "—"}</span>
      </div>

      <div className="bar storage-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(percent, used > 0 ? 2 : 0)}%` }} />
      </div>

      <div className="storage-labels">
        <span>
          <strong>{store?.usedLabel || formatBytes(used)}</strong> used
        </span>
        <span>{store?.totalLabel || formatBytes(total)} total</span>
      </div>

      <p className="hint">
        <FolderIcon size={14} /> Files stay in your Anycubic cloud. anydrop keeps no copy.
      </p>
    </section>
  );
}
