"use client";

import { useRef, useState, type DragEvent } from "react";
import { upload } from "@vercel/blob/client";
import { formatBytes } from "@/lib/format";
import type { UploadResult } from "@/lib/shape";
import { AlertIcon, ArrowRightIcon, CloseIcon, UploadIcon } from "./icons";
import { Spinner } from "./ui";

export interface ClientConfig {
  region: "global" | "cn";
  authMode: "web" | "slicer";
  uploadMode: "auto" | "direct" | "blob";
  blobEnabled: boolean;
  blobAccess: "public" | "private";
  demo: boolean;
  configured: boolean;
  maxUploadBytes: number;
  maxRelayBytes: number;
  authRequired: boolean;
  authenticated: boolean;
}

interface LockResponse {
  lockId: number;
  presignUrl: string;
  name: string;
  size: number;
}

type Phase = "idle" | "locking" | "uploading" | "finalising";

class UploadError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function putWithProgress(
  url: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.timeout = 15 * 60_000;

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(
          new UploadError(
            `Anycubic's storage rejected the file (HTTP ${request.status}).`,
            request.status,
          ),
        );
      }
    };
    request.onerror = () => reject(new UploadError("The browser could not reach Anycubic's storage.", 0));
    request.ontimeout = () => reject(new UploadError("The upload timed out.", 0));
    request.onabort = () => reject(new UploadError("The upload was cancelled.", 0));

    // No Content-Type header: this keeps the request a CORS "simple request",
    // which is what gives a browser direct-to-S3 upload any chance at all.
    request.send(file);
  });
}

function pathSafe(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "file.gcode";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "The upload failed.";
}

export function UploadCard({
  config,
  onUploaded,
  onError,
  onToast,
}: {
  config: ClientConfig;
  onUploaded: (result: UploadResult) => void;
  onError: (message: string) => void;
  onToast: (text: string, kind?: "ok" | "error" | "info") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

  const busy = phase !== "idle";

  async function start(selected: File) {
    if (busy) return;
    setLocalError(null);

    if (!/\.(gcode|gco)$/i.test(selected.name)) {
      setLocalError("That is not a G-code file. Choose a .gcode exported from your slicer.");
      return;
    }
    if (selected.size <= 0) {
      setLocalError("That file is empty.");
      return;
    }
    if (selected.size > config.maxUploadBytes) {
      setLocalError(
        `That file is ${formatBytes(selected.size)}. The limit here is ${formatBytes(config.maxUploadBytes)}.`,
      );
      return;
    }

    setFile(selected);
    setProgress(0);
    setPhase("locking");

    let lockId: number | null = null;
    let blobPathname = "";

    try {
      const lock = await fetch("/api/upload/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selected.name, size: selected.size }),
      }).then(async (response) => {
        const data = (await response.json()) as LockResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || "Could not reserve cloud storage.");
        return data;
      });
      lockId = lock.lockId;

      let directBlocked = false;

      if (config.uploadMode !== "blob") {
        setPhase("uploading");
        setProgress(0);
        try {
          await putWithProgress(lock.presignUrl, selected, setProgress);
        } catch (error) {
          const blocked =
            error instanceof UploadError && error.status === 0 && config.uploadMode === "auto";
          if (!blocked) throw error;
          directBlocked = true;
        }
      }

      if (config.uploadMode === "blob" || directBlocked) {
        if (!config.blobEnabled) {
          throw new Error(
            "Direct upload to Anycubic was blocked by the browser. Add a Vercel Blob store to enable the fallback, or set ANYDROP_UPLOAD_MODE=direct.",
          );
        }

        setPhase("uploading");
        setProgress(0);
        const blob = await upload(
          `anydrop/${Date.now().toString(36)}-${pathSafe(selected.name)}`,
          selected,
          {
            access: config.blobAccess,
            handleUploadUrl: "/api/blob/upload",
            multipart: selected.size > 8 * 1024 * 1024,
            onUploadProgress: ({ percentage }) => setProgress(percentage / 100),
          },
        );
        blobPathname = blob.pathname;
        if (directBlocked) {
          onToast("Direct upload was blocked, so the file was staged through Vercel Blob.", "info");
        }
      }

      setPhase("finalising");
      setProgress(1);

      const result = await fetch("/api/upload/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lockId: lock.lockId,
          presignUrl: lock.presignUrl,
          name: lock.name,
          size: lock.size,
          blobPathname,
        }),
      }).then(async (response) => {
        const data = (await response.json()) as UploadResult & { error?: string };
        if (!response.ok) throw new Error(data.error || "Anycubic did not accept the file.");
        return data;
      });

      setPhase("idle");
      setProgress(0);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded(result);
    } catch (error) {
      if (lockId) {
        void fetch("/api/upload/abort", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lockId, deleteObject: true }),
        }).catch(() => undefined);
      }
      const message = messageOf(error);
      setLocalError(message);
      onError(message);
      setPhase("idle");
      setProgress(0);
      setFile(null);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) void start(dropped);
  }

  const label =
    phase === "locking"
      ? "Reserving cloud storage…"
      : phase === "uploading"
        ? `Uploading to Anycubic… ${Math.round(progress * 100)}%`
        : phase === "finalising"
          ? "Claiming the file in your cloud…"
          : "";

  return (
    <section className="panel upload-panel">
      <div className="panel-head">
        <div>
          <h2>Send a file</h2>
          <p className="muted">Drop G-code from your slicer. It goes straight to your Anycubic cloud.</p>
        </div>
        <span className={`drop-badge ${config.demo ? "is-demo" : ""}`}>
          {config.demo ? "demo" : config.region === "cn" ? "China cloud" : "Global cloud"}
        </span>
      </div>

      <div
        className={`dropzone ${dragging ? "is-dragging" : ""} ${busy ? "is-busy" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => {
          if (!busy) inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (!busy && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Choose a G-code file to upload"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".gcode,.gco,text/plain"
          hidden
          disabled={busy}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void start(selected);
          }}
        />

        {busy ? (
          <div className="upload-progress">
            <span className="upload-icon">
              <Spinner size={26} />
            </span>
            <strong>{label}</strong>
            <span className="upload-file">
              {file?.name} · {formatBytes(file?.size)}
            </span>
            <div className="bar" aria-hidden="true">
              <span style={{ width: `${Math.max(4, progress * 100)}%` }} />
            </div>
            <span className="muted tiny">Keep this tab open until it finishes.</span>
          </div>
        ) : (
          <>
            <span className="drop-icon">
              <UploadIcon size={28} />
            </span>
            <strong>Drop a .gcode file here</strong>
            <span className="muted">or click to browse · up to {formatBytes(config.maxUploadBytes)}</span>
            <span className="drop-cta">
              Choose file <ArrowRightIcon size={15} />
            </span>
          </>
        )}
      </div>

      {localError ? (
        <p className="inline-error">
          <AlertIcon size={16} /> {localError}
          <button type="button" className="icon-button" onClick={() => setLocalError(null)} aria-label="Dismiss">
            <CloseIcon size={14} />
          </button>
        </p>
      ) : null}

      <p className="hint">
        {config.uploadMode === "direct"
          ? "Files are uploaded directly from your browser to Anycubic's storage."
          : config.blobEnabled
            ? "Uploads try a direct transfer first, then fall back to Vercel Blob staging if the browser is blocked."
            : "Set BLOB_READ_WRITE_TOKEN to add a fallback for browsers that block direct uploads."}
      </p>
    </section>
  );
}
