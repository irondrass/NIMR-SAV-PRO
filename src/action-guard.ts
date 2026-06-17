/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GuardedActionSkipped {
  ok: false;
  skipped: true;
  reason: "already-running";
}

export interface GuardedActionDone<T> {
  ok: true;
  skipped: false;
  value: T;
}

export type GuardedActionResult<T> = GuardedActionDone<T> | GuardedActionSkipped;

export function createActionGuard() {
  const runningKeys = new Set<string>();

  return {
    isRunning(key: string): boolean {
      return runningKeys.has(key);
    },

    async run<T>(key: string, action: () => Promise<T> | T): Promise<GuardedActionResult<T>> {
      if (runningKeys.has(key)) {
        return { ok: false, skipped: true, reason: "already-running" };
      }

      runningKeys.add(key);
      try {
        return { ok: true, skipped: false, value: await action() };
      } finally {
        runningKeys.delete(key);
      }
    },
  };
}
