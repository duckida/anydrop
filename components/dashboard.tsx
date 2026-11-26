"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Overview, UploadResult } from "@/lib/shape";
import { JobCard } from "./job-card";
import { Login } from "./login";
import { PrintDialog } from "./print-dialog";
import { PrinterCard, StoragePanel } from "./printer-card";
import { UploadCard, type ClientConfig } from "./upload-card";
import { AlertIcon, ArrowRightIcon, LogOutIcon, RefreshIcon } from "./icons";
import { Logo, Pill, Spinner, Toast } from "./ui";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data as T;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function Dashboard() {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | null>(null);
  const [pending, setPending] = useState<UploadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlBusy, setControlBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);

  const inFlight = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, kind: "ok" | "error" | "info" = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ kind, text });
    toastTimer.current = setTimeout(() => setToast(null), 6500);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!silent) setLoading(true);

    try {
      const data = await getJson<Overview>("/api/state");
      setOverview(data);
      setError(null);
      setSelectedPrinterId((current) => {
        if (current !== null && data.printers.some((printer) => printer.id === current)) return current;
        return data.printers.find((printer) => printer.online)?.id ?? data.printers[0]?.id ?? null;
      });
    } catch (problem) {
      setError(messageOf(problem));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const next = await getJson<ClientConfig>("/api/config");
        if (cancelled) return;
        setConfig(next);
        if (!next.authRequired || next.authenticated) {
          await refresh();
        } else {
          setLoading(false);
        }
      } catch (problem) {
        if (!cancelled) {
          setError(messageOf(problem));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!config?.authenticated || config.demo) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 7000);
    return () => clearInterval(timer);
  }, [config, refresh]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  async function afterLogin() {
    try {
      const next = await getJson<ClientConfig>("/api/config");
      setConfig(next);
      await refresh();
    } catch (problem) {
      setError(messageOf(problem));
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    setOverview(null);
    setPending(null);
    setConfig((current) => (current ? { ...current, authenticated: false } : current));
  }

  async function control(action: "pause" | "resume" | "cancel") {
    const job = selectedJob;
    if (!job || !selectedPrinter) return;
    if (
      action === "cancel" &&
      !window.confirm(`Cancel “${job.name}”? The print cannot be resumed after this.`)
    ) {
      return;
    }

    setControlBusy(action);
    try {
      await getJson("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerId: selectedPrinter.id,
          projectId: job.id,
          action,
        }),
      });
      showToast(
        action === "cancel" ? "Print cancelled." : action === "pause" ? "Print paused." : "Print resumed.",
      );
      await refresh(true);
    } catch (problem) {
      showToast(messageOf(problem), "error");
    } finally {
      setControlBusy(null);
    }
  }

  if (!config) {
    return (
      <div className="boot">
        <Logo size={44} />
        <Spinner size={22} />
      </div>
    );
  }

  if (config.authRequired && !config.authenticated) {
    return <Login onSuccess={afterLogin} />;
  }

  const printers = overview?.printers ?? [];
  const selectedPrinter =
    printers.find((printer) => printer.id === selectedPrinterId) ?? printers[0] ?? null;
  const selectedJob = selectedPrinter
    ? overview?.jobs.find((job) => job.printerId === selectedPrinter.id) ?? null
    : null;
  const onlineCount = printers.filter((printer) => printer.online).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <div className="brand-text">
            <span className="brand-name">anydrop</span>
            <span className="brand-sub">Anycubic cloud print</span>
          </div>
        </div>

        <div className="topbar-actions">
          {config.demo ? <Pill tone="accent">demo</Pill> : null}
          {overview ? (
            <span className="connection">
              <span className={`dot ${onlineCount > 0 ? "is-on" : ""}`} />
              {printers.length === 0
                ? "No printers"
                : `${onlineCount}/${printers.length} online`}
            </span>
          ) : null}
          <button
            type="button"
            className="ghost small"
            onClick={() => void refresh()}
            disabled={loading}
            title="Refresh status"
          >
            {loading ? <Spinner size={14} /> : <RefreshIcon size={16} />}
            Refresh
          </button>
          {config.authRequired ? (
            <button
              type="button"
              className="icon-button"
              onClick={() => void logout()}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOutIcon size={18} />
            </button>
          ) : null}
        </div>
      </header>

      <main className="shell">
        {!config.configured ? (
          <section className="panel setup-panel">
            <span className="eyebrow">Setup</span>
            <h2>Add your Anycubic token</h2>
            <p className="muted">
              anydrop talks to the Anycubic cloud with a token from your account. Set it once in your
              deployment, then redeploy.
            </p>
            <pre>
              <code>ANYCUBIC_TOKEN=your_anycubic_token</code>
            </pre>
            <p className="muted">
              On Vercel: Project → Settings → Environment Variables. Locally: copy{" "}
              <code>.env.example</code> to <code>.env.local</code>.
            </p>
            <p className="hint">
              The web token is in <code>localStorage[&quot;XX-Token&quot;]</code> on the Anycubic cloud
              site. For Slicer Next access tokens, also set <code>ANYCUBIC_AUTH_MODE=slicer</code>.
            </p>
            <button type="button" className="secondary" onClick={() => void refresh()}>
              <RefreshIcon size={16} /> Try again
            </button>
          </section>
        ) : (
          <>
            {error && overview ? (
              <div className="banner banner-bad">
                <AlertIcon size={17} />
                <span>{error}</span>
              </div>
            ) : null}

            {overview?.warnings.map((warning) => (
              <div className="banner" key={warning}>
                <AlertIcon size={17} />
                <span>{warning}</span>
              </div>
            ))}

            {!overview && loading ? (
              <div className="skeleton-grid">
                <div className="skeleton tall" />
                <div className="skeleton" />
                <div className="skeleton" />
              </div>
            ) : null}

            {!overview && !loading ? (
              <section className="panel error-panel">
                <AlertIcon size={24} />
                <h2>Could not reach the Anycubic cloud</h2>
                <p className="muted">{error}</p>
                <button type="button" className="secondary" onClick={() => void refresh()}>
                  <RefreshIcon size={16} /> Retry
                </button>
              </section>
            ) : null}

            {overview ? (
              <div className="layout">
                <div className="column main-column">
                  <UploadCard
                    config={config}
                    onUploaded={(result) => setPending(result)}
                    onError={(message) => showToast(message, "error")}
                    onToast={showToast}
                  />
                  <JobCard
                    job={selectedJob}
                    printer={selectedPrinter}
                    busy={controlBusy}
                    demo={config.demo}
                    onControl={(action) => void control(action)}
                  />
                </div>

                <aside className="column side-column">
                  <PrinterCard
                    printers={printers}
                    selectedId={selectedPrinter?.id ?? null}
                    onSelect={setSelectedPrinterId}
                  />
                  <StoragePanel store={overview.store} />
                  <section className="panel tip-panel">
                    <span className="eyebrow">How it works</span>
                    <ol>
                      <li>Slice in Anycubic Slicer or your usual slicer.</li>
                      <li>Drop the .gcode here — it goes to your Anycubic cloud.</li>
                      <li>Match colours to ACE slots, then start the print.</li>
                    </ol>
                    <p className="hint">
                      <ArrowRightIcon size={13} /> Status refreshes every few seconds while this tab is
                      open.
                    </p>
                  </section>
                </aside>
              </div>
            ) : null}
          </>
        )}

        <footer className="footer">
          <span>anydrop · self-hosted on Vercel</span>
          <span className="muted">
            {config.region === "cn" ? "China" : "International"} cloud · {config.authMode} token
          </span>
        </footer>
      </main>

      {pending ? (
        <PrintDialog
          result={pending}
          printers={printers}
          initialPrinterId={selectedPrinter?.id ?? null}
          demo={config.demo}
          onClose={() => setPending(null)}
          onStarted={() => {
            setPending(null);
            showToast("Print started.");
            setTimeout(() => void refresh(true), 1800);
          }}
        />
      ) : null}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
