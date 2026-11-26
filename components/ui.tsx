"use client";

import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, CloseIcon, DropIcon } from "./icons";

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="logo" style={{ width: size, height: size }}>
      <DropIcon size={size * 0.58} />
    </span>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function ProgressRing({ value, size = 128 }: { value: number; size?: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <circle cx="60" cy="60" r={radius} className="ring-track" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="ring-value"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="ring-label">
        <strong>{Math.round(value)}%</strong>
        <span>complete</span>
      </div>
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad" | "accent";
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Toast({
  toast,
  onClose,
}: {
  toast: { kind: "ok" | "error" | "info"; text: string } | null;
  onClose: () => void;
}) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.kind}`} role="status" aria-live="polite">
      <span className="toast-icon">
        {toast.kind === "error" ? <AlertIcon size={17} /> : <CheckIcon size={17} />}
      </span>
      <span>{toast.text}</span>
      <button type="button" className="icon-button" onClick={onClose} aria-label="Dismiss">
        <CloseIcon size={15} />
      </button>
    </div>
  );
}
