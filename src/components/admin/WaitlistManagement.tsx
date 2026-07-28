"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { Check, Copy, Link2, RefreshCw, Trash2, X } from "lucide-react";
import {
  approveWaitlistEntry,
  deleteWaitlistEntry,
  getSignupSettings,
  getWaitlistEntries,
  regenerateRegistrationLink,
  rejectWaitlistEntry,
  updateSignupSettings,
} from "@/lib/api/waitlist";
import { useWaitlistNotificationStore } from "@/store/waitlistNotificationStore";
import type {
  InvitationLink,
  SignupMode,
  SignupSettings,
  WaitlistEntry,
  WaitlistStatus,
} from "@/lib/api/types";

type StatusFilter = "all" | WaitlistStatus;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

/** Matches the backend's accepted range for a link lifetime. */
const MIN_EXPIRE_DAYS = 1;
const MAX_EXPIRE_DAYS = 365;

function statusPillClass(status: WaitlistStatus): string {
  if (status === "approved") return "bg-green-100 text-green-800";
  if (status === "rejected") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString();
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** null when the text is not a whole number of days inside the allowed range. */
function parseExpireDays(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const days = Number(value.trim());
  if (days < MIN_EXPIRE_DAYS || days > MAX_EXPIRE_DAYS) return null;
  return days;
}

/**
 * The admin half of invite-only signup: the access-request queue plus the
 * settings that decide whether that queue is used at all.
 *
 * Approving mints a registration link that the server shows exactly once, so
 * the link dialog is the only chance to capture it — hence the copy button and
 * the explicit warning rather than a toast that can be missed.
 */
export function WaitlistManagement() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<SignupSettings | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [defaultDays, setDefaultDays] = useState("");
  const [savingDefaultDays, setSavingDefaultDays] = useState(false);

  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [linkDialog, setLinkDialog] = useState<InvitationLink | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // One dialog serves approve and regenerate — both mint a link and both want
  // the same "how long should it last" answer.
  const [issueTarget, setIssueTarget] = useState<
    { entry: WaitlistEntry; mode: "approve" | "regenerate" } | null
  >(null);
  const [issueDays, setIssueDays] = useState("");

  const [confirmReject, setConfirmReject] = useState<WaitlistEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WaitlistEntry | null>(null);

  // Keep the sidebar badge honest: every decision here changes the pending count.
  const refreshPendingBadge = useWaitlistNotificationStore((s) => s.refresh);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWaitlistEntries(
        filter === "all" ? undefined : filter
      );
      setEntries(data);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load access requests"));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    getSignupSettings()
      .then((config) => {
        setSettings(config);
        setDefaultDays(String(config.invite_expire_days));
      })
      .catch((err: unknown) =>
        setError(errorMessage(err, "Failed to load the signup settings"))
      );
  }, []);

  const afterDecision = async () => {
    await fetchEntries();
    refreshPendingBadge();
  };

  const handleModeChange = async (mode: SignupMode) => {
    if (mode === settings?.signup_mode) return;
    setSavingMode(true);
    setError(null);
    try {
      setSettings(await updateSignupSettings({ signup_mode: mode }));
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to change the signup mode"));
    } finally {
      setSavingMode(false);
    }
  };

  const handleSaveDefaultDays = async () => {
    const days = parseExpireDays(defaultDays);
    if (days === null) {
      setError(
        `Default link expiry must be a whole number of days between ${MIN_EXPIRE_DAYS} and ${MAX_EXPIRE_DAYS}.`
      );
      return;
    }
    setSavingDefaultDays(true);
    setError(null);
    try {
      const config = await updateSignupSettings({ invite_expire_days: days });
      setSettings(config);
      setDefaultDays(String(config.invite_expire_days));
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to save the default link expiry"));
    } finally {
      setSavingDefaultDays(false);
    }
  };

  const openIssueDialog = (
    entry: WaitlistEntry,
    mode: "approve" | "regenerate"
  ) => {
    setIssueDays(String(settings?.invite_expire_days ?? 14));
    setIssueTarget({ entry, mode });
  };

  const handleIssueConfirmed = async () => {
    const target = issueTarget;
    if (!target) return;

    const days = parseExpireDays(issueDays);
    if (days === null) {
      setError(
        `Link expiry must be a whole number of days between ${MIN_EXPIRE_DAYS} and ${MAX_EXPIRE_DAYS}.`
      );
      return;
    }

    setIssueTarget(null);
    setBusyEntryId(target.entry.id);
    setError(null);
    try {
      const link =
        target.mode === "approve"
          ? await approveWaitlistEntry(target.entry.id, days)
          : await regenerateRegistrationLink(target.entry.id, days);
      setLinkDialog(link);
      setLinkCopied(false);
      await afterDecision();
    } catch (err: unknown) {
      setError(
        errorMessage(
          err,
          target.mode === "approve"
            ? "Failed to approve the request"
            : "Failed to generate a registration link"
        )
      );
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleRejectConfirmed = async () => {
    const entry = confirmReject;
    if (!entry) return;
    setConfirmReject(null);
    setBusyEntryId(entry.id);
    setError(null);
    try {
      await rejectWaitlistEntry(entry.id);
      await afterDecision();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to reject the request"));
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    const entry = confirmDelete;
    if (!entry) return;
    setConfirmDelete(null);
    setBusyEntryId(entry.id);
    setError(null);
    try {
      await deleteWaitlistEntry(entry.id);
      await afterDecision();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to delete the request"));
    } finally {
      setBusyEntryId(null);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  const defaultDaysDirty =
    settings !== null && defaultDays !== String(settings.invite_expire_days);
  const issueDaysValid = parseExpireDays(issueDays) !== null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Signup settings */}
      <Card>
        <CardHeader>
          <CardTitle>How people sign up</CardTitle>
          <CardDescription>
            Choose whether anyone can create an account, or whether every account
            has to be approved here first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {settings === null ? (
            <LoadingState
              variant="compact"
              message="Loading signup settings"
              className="py-2"
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      mode: "open" as SignupMode,
                      title: "Open sign-up",
                      body: "Anyone can create an account from the sign-in page and use it immediately.",
                    },
                    {
                      mode: "waitlist" as SignupMode,
                      title: "Approval required",
                      body: "Visitors request access instead. You approve a request to generate a one-time registration link to send them.",
                    },
                  ] as const
                ).map(({ mode, title, body }) => {
                  const active = settings.signup_mode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleModeChange(mode)}
                      disabled={savingMode || active}
                      aria-pressed={active}
                      className={`rounded-xl border p-4 text-left transition-all disabled:cursor-default ${
                        active
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">{title}</span>
                        {active && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                            <Check className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                    </button>
                  );
                })}
              </div>

              {savingMode && <p className="text-sm text-muted-foreground">Saving…</p>}

              {settings.signup_mode === "open" && (
                <p className="text-sm text-muted-foreground">
                  Requests below are still accepted while sign-up is open, so
                  nothing is lost if you switch modes later.
                </p>
              )}

              <div className="border-t border-border/60 pt-4">
                <Label htmlFor="default-expiry" className="text-sm font-medium">
                  Registration links expire after
                </Label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Input
                    id="default-expiry"
                    type="number"
                    inputMode="numeric"
                    min={MIN_EXPIRE_DAYS}
                    max={MAX_EXPIRE_DAYS}
                    value={defaultDays}
                    onChange={(e) => setDefaultDays(e.target.value)}
                    disabled={savingDefaultDays}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveDefaultDays}
                    disabled={savingDefaultDays || !defaultDaysDirty}
                  >
                    {savingDefaultDays ? "Saving…" : "Save default"}
                  </Button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Just the starting value — you can set a different expiry each
                  time you approve someone. Changing it does not affect links you
                  have already sent.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Requests */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Access Requests</CardTitle>
              <CardDescription>
                Approve a request to generate its registration link
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-card/60 p-1">
              {STATUS_FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    filter === id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState
              variant="inline"
              message="Loading access requests"
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center">
                      {filter === "pending"
                        ? "No requests waiting for review"
                        : "No access requests found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => {
                    const busy = busyEntryId === entry.id;
                    const registered = Boolean(entry.registered_user_id);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.name}
                          {entry.reason && (
                            <p
                              className="mt-0.5 max-w-[220px] truncate text-xs font-normal text-muted-foreground"
                              title={entry.reason}
                            >
                              {entry.reason}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{entry.email}</TableCell>
                        <TableCell>{entry.organization || "-"}</TableCell>
                        <TableCell>{formatDate(entry.created_at)}</TableCell>
                        <TableCell>
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${statusPillClass(
                              entry.status
                            )}`}
                          >
                            {entry.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {registered ? (
                            <span className="text-xs font-medium text-green-700 dark:text-green-400">
                              Registered
                            </span>
                          ) : entry.invitation_status === "active" ? (
                            <span className="text-xs text-muted-foreground">
                              Sent · expires{" "}
                              {formatDate(entry.invitation_expires_at)}
                            </span>
                          ) : entry.invitation_status ? (
                            <span className="text-xs text-muted-foreground">
                              {entry.invitation_status}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {entry.status !== "approved" && !registered && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => openIssueDialog(entry, "approve")}
                                title="Approve and generate a registration link"
                                className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-950/50"
                              >
                                <Check className="mr-1 h-3 w-3" />
                                Approve
                              </Button>
                            )}
                            {entry.status === "approved" && !registered && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => openIssueDialog(entry, "regenerate")}
                                title="Generate a new link (revokes the previous one)"
                                className="h-7 px-2 text-xs"
                              >
                                <RefreshCw className="mr-1 h-3 w-3" />
                                New link
                              </Button>
                            )}
                            {entry.status !== "rejected" && !registered && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => setConfirmReject(entry)}
                                title="Reject this request"
                                className="h-7 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-950/50"
                              >
                                <X className="mr-1 h-3 w-3" />
                                Reject
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => setConfirmDelete(entry)}
                              title="Delete this request"
                              className="h-7 px-2 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Set this link's expiry, then mint it */}
      <Dialog
        open={issueTarget !== null}
        onOpenChange={(open) => {
          if (!open) setIssueTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {issueTarget?.mode === "approve"
                ? "Approve and send a link"
                : "Generate a new link"}
            </DialogTitle>
            <DialogDescription>
              {issueTarget?.mode === "approve" ? (
                <>
                  <strong>{issueTarget?.entry.name}</strong> (
                  {issueTarget?.entry.email}) will be able to create an account
                  using a single-use link.
                </>
              ) : (
                <>
                  Issue a replacement link for <strong>{issueTarget?.entry.email}</strong>.
                  The previous link stops working immediately.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="issue-expiry">Link expires after</Label>
            <div className="flex items-center gap-2">
              <Input
                id="issue-expiry"
                type="number"
                inputMode="numeric"
                min={MIN_EXPIRE_DAYS}
                max={MAX_EXPIRE_DAYS}
                value={issueDays}
                onChange={(e) => setIssueDays(e.target.value)}
                className="w-24"
                autoFocus
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            {!issueDaysValid && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Enter a whole number between {MIN_EXPIRE_DAYS} and {MAX_EXPIRE_DAYS}.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Prefilled from your default of {settings?.invite_expire_days ?? 14}{" "}
              days. Changing it here affects only this link.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleIssueConfirmed} disabled={!issueDaysValid}>
              {issueTarget?.mode === "approve" ? "Approve" : "Generate link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registration link — shown once */}
      <Dialog
        open={linkDialog !== null}
        onOpenChange={(open) => {
          if (!open) setLinkDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registration link generated</DialogTitle>
            <DialogDescription>
              Send this link to <strong>{linkDialog?.entry.email}</strong>. Copy it
              now — it is shown only once, and only a hash of it is stored. If you
              lose it, generate a new one (which revokes this one).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                Single-use registration link
              </Label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border bg-muted/50 p-3 font-mono text-sm break-all">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 select-all">
                  {linkDialog?.registration_url}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    linkDialog && copyLink(linkDialog.registration_url)
                  }
                >
                  {linkCopied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires {formatDate(linkDialog?.expires_at)}. The account is created
              only when the link is used, and the email address is fixed to the
              one above.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setLinkDialog(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject confirmation */}
      <Dialog
        open={confirmReject !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmReject(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this request?</DialogTitle>
            <DialogDescription>
              <strong>{confirmReject?.name}</strong> ({confirmReject?.email}) will
              not be able to register, and any link already issued to them stops
              working. The request stays on the list as a record of the decision.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReject(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectConfirmed}>
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this request?</DialogTitle>
            <DialogDescription>
              Permanently removes the request from <strong>{confirmDelete?.email}</strong>{" "}
              and any registration links issued for it. Existing accounts are not
              affected. This address will be able to request access again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirmed}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
