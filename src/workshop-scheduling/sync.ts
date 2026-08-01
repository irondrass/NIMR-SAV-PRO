export type SyncOperationStatus = "pending" | "processing" | "applied" | "conflict" | "failed";

export interface WorkshopSyncOperation {
  id: string;
  entityType: string;
  entityId: string;
  operationType: string;
  payload: unknown;
  status: SyncOperationStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  nextRetryAt?: string;
  lastError?: string;
  serverVersion?: number;
}

export interface WorkshopSyncConflict {
  operationId: string;
  localValue: unknown;
  serverValue: unknown;
  resolution?: "local" | "server" | "merged";
}

export function enqueueIdempotent(
  queue: WorkshopSyncOperation[],
  operation: WorkshopSyncOperation,
): WorkshopSyncOperation[] {
  return queue.some(candidate => candidate.id === operation.id) ? queue : [...queue, operation];
}

export function getRunnableOperations(queue: WorkshopSyncOperation[], now = new Date()): WorkshopSyncOperation[] {
  const timestamp = now.getTime();
  return queue.filter(operation =>
    operation.status === "pending" ||
    (operation.status === "failed" && operation.nextRetryAt !== undefined && new Date(operation.nextRetryAt).getTime() <= timestamp));
}

export function markSyncFailure(
  operation: WorkshopSyncOperation,
  error: string,
  now = new Date(),
  maximumAttempts = 5,
): WorkshopSyncOperation {
  const attempts = operation.attempts + 1;
  const terminal = attempts >= maximumAttempts;
  const delaySeconds = Math.min(300, 2 ** attempts * 5);
  return {
    ...operation,
    status: terminal ? "conflict" : "failed",
    attempts,
    lastError: error,
    updatedAt: now.toISOString(),
    nextRetryAt: terminal ? undefined : new Date(now.getTime() + delaySeconds * 1000).toISOString(),
  };
}

export function markSyncApplied(
  operation: WorkshopSyncOperation,
  serverVersion: number,
  now = new Date(),
): WorkshopSyncOperation {
  return {
    ...operation,
    status: "applied",
    attempts: operation.attempts + 1,
    serverVersion,
    updatedAt: now.toISOString(),
    nextRetryAt: undefined,
    lastError: undefined,
  };
}

export function resolveSyncConflict(
  conflict: WorkshopSyncConflict,
  resolution: "local" | "server" | "merged",
): WorkshopSyncConflict {
  return { ...conflict, resolution };
}
