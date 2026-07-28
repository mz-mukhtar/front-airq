"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RequestLog, RequestLogDetail, RequestLogFull } from "@/lib/api/types";
import { getRequestLogDetail } from "@/lib/api/admin-operations";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  RefreshCw,
} from "lucide-react";

interface RequestLogDetailModalProps {
  /** The row that was clicked — shown immediately while the full record loads. */
  summary: RequestLog | null;
  onClose: () => void;
  /** Re-filter the list around this request (device, user, path…). */
  onPivot?: (filter: { path?: string; device_id?: string; user_email?: string }) => void;
}

function statusTone(code: number): string {
  if (code >= 500) return "bg-red-100 text-red-800 ring-red-600/20";
  if (code >= 400) return "bg-amber-100 text-amber-800 ring-amber-600/20";
  if (code >= 300) return "bg-blue-100 text-blue-800 ring-blue-600/20";
  return "bg-green-100 text-green-800 ring-green-600/20";
}

/** Turn a raw UA string into something a human can read at a glance. */
function describeUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  if (/ESP32/i.test(ua)) return "ESP32 sensor firmware";
  if (/^node/i.test(ua)) return "Node.js client";
  if (/curl/i.test(ua)) return "curl";
  if (/bot|crawl|spider|scan/i.test(ua)) return "Bot / scanner";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua) && !/Chrome/.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : null;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os;
}

/** Pretty-print a JSON body; leave anything unparseable exactly as captured. */
function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 break-words text-sm text-foreground">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function CodeBlock({ text, tone }: { text: string; tone?: "error" }) {
  return (
    <pre
      className={`max-h-56 overflow-auto rounded-md border p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-900"
          : "bg-muted/40 text-foreground"
      }`}
    >
      {text}
    </pre>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 text-xs"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => undefined
        );
      }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/** Compact list of neighbouring requests, each clickable to open in turn. */
function NeighbourList({
  rows,
  emptyText,
}: {
  rows: RequestLog[];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="divide-y rounded-md border">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${statusTone(row.status_code)}`}
          >
            {row.status_code}
          </span>
          <span className="font-mono text-[11px] font-semibold">{row.method}</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground" title={row.path}>
            {row.path}
          </span>
          <span className="ml-auto whitespace-nowrap text-[11px] text-muted-foreground">
            {new Date(row.created_at).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RequestLogDetailModal({
  summary,
  onClose,
  onPivot,
}: RequestLogDetailModalProps) {
  const [detail, setDetail] = useState<RequestLogDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logId = summary?.id ?? null;

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequestLogDetail(id);
      setDetail(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load request detail");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!logId) {
      setDetail(null);
      setError(null);
      return;
    }
    load(logId);
  }, [logId, load]);

  if (!summary) return null;

  // The clicked row stands in until the full record arrives, so the modal has
  // content the instant it opens. The list row simply lacks the heavier fields,
  // which are optional on RequestLogFull and fill in once the fetch lands.
  const log: RequestLogFull = detail?.log ?? summary;
  const failed = log.status_code >= 400;
  const device = detail?.device ?? null;
  const user = detail?.user ?? null;
  const uaSummary = describeUserAgent(log.user_agent);
  const fullPath = log.query_string ? `${log.path}?${log.query_string}` : log.path;

  return (
    <Dialog open={!!summary} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusTone(log.status_code)}`}
            >
              {log.status_code}
            </span>
            <span className="font-mono text-sm font-semibold">{log.method}</span>
            <span className="break-all font-mono text-sm font-normal text-muted-foreground">
              {log.path}
            </span>
          </DialogTitle>
          <DialogDescription>
            {new Date(log.created_at).toLocaleString()}
            {log.duration_ms !== null && ` · took ${log.duration_ms.toFixed(1)} ms`}
            {loading && " · loading full record…"}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Could not load the full record:</span>
            </div>
            <p className="mt-1">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 gap-1.5 text-xs"
              onClick={() => logId && load(logId)}
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        ) : null}

        <div className="space-y-5">
          {/* What happened — the reason the row was opened. */}
          <Section title={failed ? "Failure" : "Outcome"}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Status">{log.status_code}</Field>
              <Field label="Duration">
                {log.duration_ms !== null ? `${log.duration_ms.toFixed(1)} ms` : "—"}
              </Field>
              <Field label="When">{new Date(log.created_at).toLocaleString()}</Field>
            </div>
            {log.error_detail && (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Response the caller received
                </p>
                <CodeBlock text={log.error_detail} tone="error" />
              </div>
            )}
            {log.internal_error && (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Server exception (not sent to the caller)
                </p>
                <CodeBlock text={log.internal_error} tone="error" />
              </div>
            )}
          </Section>

          {/* The request itself. */}
          <Section title="Request">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Path">
                <span className="font-mono text-xs break-all">{fullPath}</span>
              </Field>
              <Field label="Correlation ID">
                <span className="font-mono text-xs break-all">{log.request_id}</span>
              </Field>
            </div>
            {log.request_body && (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Body as sent{" "}
                  <span className="normal-case text-muted-foreground/70">
                    (credentials redacted)
                  </span>
                </p>
                <CodeBlock text={formatBody(log.request_body)} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <CopyButton value={log.request_id} label="Copy correlation ID" />
              <CopyButton value={fullPath} label="Copy path" />
              {onPivot && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    onPivot({ path: log.path });
                    onClose();
                  }}
                >
                  Show all requests to this path
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              The correlation ID is echoed in the <code>X-Request-ID</code> response header
              and prefixes this request&apos;s lines in the server log.
            </p>
          </Section>

          {/* Who made it — resolved from the ids on the row. */}
          <Section title="Caller">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="IP address">{log.ip_address || "—"}</Field>
              <Field label="Client">
                {uaSummary ? (
                  <span title={log.user_agent ?? undefined}>{uaSummary}</span>
                ) : (
                  <span className="font-mono text-xs break-all">{log.user_agent || "—"}</span>
                )}
              </Field>
            </div>

            {user && (
              <div className="rounded-md border bg-muted/20 p-2.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="User">{user.name || "—"}</Field>
                  <Field label="Email">{user.email}</Field>
                  <Field label="Role">{user.role || "—"}</Field>
                </div>
              </div>
            )}

            {device ? (
              <div className="rounded-md border bg-muted/20 p-2.5 space-y-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Device">
                    <span className="font-mono text-xs">{device.serial_number}</span>
                  </Field>
                  <Field label="Device status">{device.status || "—"}</Field>
                  <Field label="Approval">{device.approval_status || "—"}</Field>
                </div>
                {device.location && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Station">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {device.location.name}
                      </span>
                    </Field>
                    <Field label="Coordinates">
                      {device.location.latitude !== null &&
                      device.location.latitude !== undefined &&
                      device.location.longitude !== null &&
                      device.location.longitude !== undefined
                        ? `${device.location.latitude.toFixed(5)}, ${device.location.longitude.toFixed(5)}`
                        : "—"}
                    </Field>
                    <Field label="Installed">
                      {device.installed_at
                        ? new Date(device.installed_at).toLocaleDateString()
                        : "—"}
                    </Field>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/sensors?device=${device.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    View this station&apos;s charts
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  {onPivot && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        onPivot({ device_id: device.id });
                        onClose();
                      }}
                    >
                      Show this device&apos;s requests
                    </Button>
                  )}
                </div>
              </div>
            ) : log.device_id ? (
              <p className="text-xs text-muted-foreground">
                Device <span className="font-mono">{log.device_id}</span> is no longer
                registered.
              </p>
            ) : null}

            {!user && !log.device_id && (
              <p className="text-xs text-muted-foreground">
                Anonymous request — no device header and no authenticated user.
              </p>
            )}
          </Section>

          {/* Context: is this a one-off or a pattern? */}
          <Section title="Same correlation ID">
            <NeighbourList
              rows={detail?.related ?? []}
              emptyText="No other requests were recorded under this correlation ID."
            />
          </Section>

          <Section title="This caller's recent requests">
            <NeighbourList
              rows={detail?.actor_history ?? []}
              emptyText={
                loading
                  ? "Loading…"
                  : "No other requests recorded from this caller."
              }
            />
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
