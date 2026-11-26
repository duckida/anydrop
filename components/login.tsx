"use client";

import { useState, type FormEvent } from "react";
import { AlertIcon } from "./icons";
import { Logo, Spinner } from "./ui";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      onSuccess();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-glow" aria-hidden="true" />
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <Logo size={46} />
          <div>
            <h1>anydrop</h1>
            <p>Your Anycubic printer, one drop away.</p>
          </div>
        </div>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={busy}
          />
        </label>

        {error ? (
          <p className="inline-error">
            <AlertIcon size={16} /> {error}
          </p>
        ) : null}

        <button type="submit" className="primary wide" disabled={busy || !password}>
          {busy ? <Spinner /> : null}
          {busy ? "Checking…" : "Enter"}
        </button>

        <p className="login-foot">
          Self-hosted. Your Anycubic token stays on the server and is never sent to this browser.
        </p>
      </form>
    </div>
  );
}
