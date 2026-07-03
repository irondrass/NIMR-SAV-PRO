/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryStorageLike, StorageLike } from "./dataProvider";

export interface LocalStorageProvider {
  mode: "localStorage";
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export function createLocalStorageProvider(storage?: StorageLike | null): LocalStorageProvider {
  const target = storage ?? (
    typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : new MemoryStorageLike()
  );

  return {
    mode: "localStorage",
    getItem: key => target.getItem(key),
    setItem: (key, value) => target.setItem(key, value),
    removeItem: key => target.removeItem(key),
    keys: () => {
      if ("length" in target && typeof (target as Storage).key === "function") {
        const keys: string[] = [];
        for (let index = 0; index < (target as Storage).length; index += 1) {
          const key = (target as Storage).key(index);
          if (key) keys.push(key);
        }
        return keys;
      }
      if (target instanceof MemoryStorageLike) return target.keys();
      return [];
    },
  };
}
