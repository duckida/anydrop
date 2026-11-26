"use client";

import { formatMinutes } from "@/lib/format";
import type { JobView, PrinterView } from "@/lib/shape";
import { ClockIcon, LayersIcon, PauseIcon, PlayIcon, PrinterIcon, StopIcon } from "./icons";
import { Pill, ProgressRing, Spinner } from "./ui";

export function JobCard({
  job,
  printer,
  busy,
  demo,
  onControl,
}: {
  job: JobView | null;
  printer: PrinterView | null;
  busy: string | null;
  demo: boolean;
  onControl: (action: "pause" | "resume" | "cancel") => void;
}) {
  if (!job) {
    const offline = printer ? !printer.online : true;
    return (
      <section className="panel job-panel">
        <div className="panel-head">
          <div>
            <h2>Current print</h2>
            <p className="muted">
              {printer ? printer.name : "No printer selected"}
            </p>
          </div>
          <Pill tone={offline ? "bad" : "ok"}>{offline ? "Offline" : "Ready"}</Pill>
        </div>

        <div className="idle-state">
          <span className="idle-art">
            {offline ? <PrinterIcon size={34} /> : <LayersIcon size={34} />}
          </span>
          <h3>{offline ? "Printer is offline" : "Nothing printing"}</h3>
          <p className="muted">
            {offline
              ? "Wake the printer and make sure it is signed in to the same Anycubic account."
              : "Drop a G-code file above, pick your filament slots, and start the print."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel job-panel">
      <div className="panel-head">
        <div>
          <h2>Current print</h2>
          <p className="muted">{printer?.name ?? "Anycubic printer"}</p>
        </div>
        <Pill tone={job.paused ? "warn" : "accent"}>{job.statusLabel}</Pill>
      </div>

      <div className="job-body">
        <div className="job-visual">
          <ProgressRing value={job.progress} />
          <div className="job-controls">
            {job.paused ? (
              <button
                type="button"
                className="primary"
                onClick={() => onControl("resume")}
                disabled={demo || busy !== null}
              >
                {busy === "resume" ? <Spinner /> : <PlayIcon size={16} />}
                Resume
              </button>
            ) : (
              <button
                type="button"
                className="secondary"
                onClick={() => onControl("pause")}
                disabled={demo || busy !== null}
              >
                {busy === "pause" ? <Spinner /> : <PauseIcon size={16} />}
                Pause
              </button>
            )}
            <button
              type="button"
              className="ghost danger"
              onClick={() => onControl("cancel")}
              disabled={demo || busy !== null}
            >
              {busy === "cancel" ? <Spinner /> : <StopIcon size={16} />}
              Cancel
            </button>
          </div>
        </div>

        <div className="job-details">
          <div className="job-title-row">
            {job.imageUrl ? (
              <img
                className="job-thumb"
                src={job.imageUrl}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : null}
            <div>
              <h3 title={job.name}>{job.name}</h3>
              <p className="muted">
                {job.material ? `${job.material} · ` : ""}
                {job.elapsedMinutes !== null ? `${formatMinutes(job.elapsedMinutes)} elapsed` : "In progress"}
              </p>
            </div>
          </div>

          <dl className="job-stats">
            <div>
              <dt>
                <ClockIcon size={15} /> Remaining
              </dt>
              <dd>{job.remainMinutes === null ? "—" : formatMinutes(job.remainMinutes)}</dd>
            </div>
            <div>
              <dt>
                <LayersIcon size={15} /> Progress
              </dt>
              <dd>{job.progress}%</dd>
            </div>
            <div>
              <dt>
                <PrinterIcon size={15} /> Printer
              </dt>
              <dd>{printer?.model || printer?.name || "—"}</dd>
            </div>
          </dl>

          {demo ? <p className="hint">Demo data. Controls are disabled.</p> : null}
        </div>
      </div>
    </section>
  );
}
