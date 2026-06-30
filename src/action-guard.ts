/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState } from "react";

export const GLOBAL_ACTION_GUARD_MS = 900;

const lastActionByKey = new Map<string, number>();

export type ActionGuardResult<T> =
  | { ok: true; skipped: false; value: T }
  | { ok: false; skipped: true; reason: "already-running" };

export function createActionGuard() {
  const runningActions = new Set<string>();

  return {
    isRunning(key: string): boolean {
      return runningActions.has(key);
    },

    async run<T>(key: string, action: () => T | Promise<T>): Promise<ActionGuardResult<Awaited<T>>> {
      if (runningActions.has(key)) {
        return { ok: false, skipped: true, reason: "already-running" };
      }

      runningActions.add(key);
      try {
        const value = await action();
        return { ok: true, skipped: false, value };
      } finally {
        runningActions.delete(key);
      }
    }
  };
}

function getActionGuardTime(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function canRunGuardedAction(key: string, nowMs = getActionGuardTime()): boolean {
  const lastRun = lastActionByKey.get(key);
  if (lastRun !== undefined && nowMs - lastRun < GLOBAL_ACTION_GUARD_MS) {
    return false;
  }
  lastActionByKey.set(key, nowMs);
  return true;
}

export function resetActionGuard(key?: string): void {
  if (key) {
    lastActionByKey.delete(key);
    return;
  }
  lastActionByKey.clear();
}

export async function runGuardedAction<T>(
  guard: ReturnType<typeof createActionGuard>,
  key: string,
  action: () => T | Promise<T>
): Promise<ActionGuardResult<Awaited<T>>> {
  return guard.run(key, action);
}

function getActionErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Action impossible : une erreur locale est survenue.";
}

export function usePendingAction() {
  const guardRef = useRef(createActionGuard());
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runPendingAction = async <T,>(
    key: string,
    action: () => T | Promise<T>
  ): Promise<ActionGuardResult<Awaited<T>>> => {
    if (guardRef.current.isRunning(key)) {
      setActionError("Traitement déjà en cours.");
      return { ok: false, skipped: true, reason: "already-running" };
    }

    setPendingKey(key);
    setActionError(null);
    try {
      return await runGuardedAction(guardRef.current, key, action);
    } catch (error) {
      setActionError(getActionErrorMessage(error));
      throw error;
    } finally {
      setPendingKey(null);
    }
  };

  return {
    pendingKey,
    actionError,
    isPending: (key?: string) => key ? pendingKey === key : pendingKey !== null,
    clearActionError: () => setActionError(null),
    runGuardedAction: runPendingAction,
  };
}
