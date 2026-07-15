"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogCleanupResponse } from "@/lib/api/types";
import { cleanupAdminLogs } from "@/lib/api/admin-operations";
import { Trash2, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

export function LogCleanupDialog() {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LogCleanupResponse | null>(null);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when closed
      setConfirmed(false);
      setError(null);
      // Keep result around if we reopen or reset if desired
    } else {
      setConfirmed(false);
      setError(null);
      setResult(null);
    }
  };

  const handleCleanup = async () => {
    if (!confirmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await cleanupAdminLogs();
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Log cleanup operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
          <Trash2 className="h-3.5 w-3.5" />
          Clean Up Old Logs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="h-5 w-5" />
            <DialogTitle>Clean Up Expired Security & Audit Logs</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-xs text-muted-foreground">
            Execute the backend log retention policy across database records.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-green-50 p-3 text-xs text-green-800 ring-1 ring-inset ring-green-600/20">
              <div className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{result.message || "Cleanup completed successfully"}</span>
              </div>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-2">
              <p className="font-semibold text-foreground">Deleted Record Counts:</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Audit Logs:</span>
                  <p className="font-semibold tabular-nums text-foreground">{result.results.audit_logs}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Reset Tokens:</span>
                  <p className="font-semibold tabular-nums text-foreground">{result.results.password_reset_tokens}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Password History:</span>
                  <p className="font-semibold tabular-nums text-foreground">{result.results.password_history}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Token Blacklist:</span>
                  <p className="font-semibold tabular-nums text-foreground">{result.results.token_blacklist}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                Completed at: {new Date(result.results.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-xs">
            <div className="rounded-md bg-amber-50 p-3 text-amber-900 ring-1 ring-inset ring-amber-600/20 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Critical Execution Warnings</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>
                  <strong>Irreversible:</strong> Purged audit, token, and history rows cannot be restored.
                </li>
                <li>
                  <strong>Synchronous:</strong> Runs immediately within this request thread.
                </li>
                <li>
                  <strong>Committed immediately:</strong> Database deletions take effect instantly without rollback.
                </li>
              </ul>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-red-700 ring-1 ring-inset ring-red-600/20">
                <p className="font-semibold">Cleanup error:</p>
                <p className="mt-0.5">{error}</p>
              </div>
            )}

            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="confirm-cleanup"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
              />
              <label htmlFor="confirm-cleanup" className="cursor-pointer select-none text-xs font-medium text-foreground">
                I understand that this operation is irreversible
              </label>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCleanup}
              disabled={!confirmed || loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? "Purging Logs..." : "Clean Up Logs"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
