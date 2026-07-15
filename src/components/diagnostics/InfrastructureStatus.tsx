"use client";

import { DatabaseHealthCard } from "./DatabaseHealthCard";
import { ConnectionPoolCard } from "./ConnectionPoolCard";
import { PerformanceStatsTable } from "./PerformanceStatsTable";
import { LogCleanupDialog } from "./LogCleanupDialog";

export function InfrastructureStatus() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Infrastructure Diagnostics
          </h2>
          <p className="text-xs text-muted-foreground">
            Database connectivity, engine status, connection pool utilization, and API performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LogCleanupDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DatabaseHealthCard />
        <ConnectionPoolCard />
      </div>

      <PerformanceStatsTable />
    </div>
  );
}
