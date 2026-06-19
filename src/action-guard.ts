/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export function canRunGuardedAction(key: string, nowMs = Date.now()): boolean {
  const lastRun = lastActionByKey.get(key) ?? 0;
  if (nowMs - lastRun < GLOBAL_ACTION_GUARD_MS) {
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
