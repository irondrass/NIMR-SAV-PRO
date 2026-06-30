/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DataProvider<T> {
  list(): T[];
  getById(id: string): T | undefined;
  replaceAll(items: T[]): T[];
  create(item: T): T;
  update(id: string, patch: Partial<T> | ((item: T) => T)): T | undefined;
  remove(id: string): boolean;
  clear(): void;
}

export interface LocalCollectionRepositoryOptions<T> {
  key: string;
  getId: (item: T) => string;
  guard?: (value: unknown) => value is T;
  defaults?: T[];
  storage?: StorageLike | null;
}

export interface BackendMigrationReadiness {
  currentRuntime: "localStorage";
  preparedTargets: Array<"IndexedDB" | "backend-api">;
  backendEnabled: false;
  authServerEnabled: false;
  repositories: string[];
}

export const BACKEND_MIGRATION_READINESS: BackendMigrationReadiness = {
  currentRuntime: "localStorage",
  preparedTargets: ["IndexedDB", "backend-api"],
  backendEnabled: false,
  authServerEnabled: false,
  repositories: [
    "dossiers",
    "vehicles",
    "clients",
    "workshopTasks",
    "planning",
    "qc",
    "delivery",
    "audit",
  ],
};

export class MemoryStorageLike implements StorageLike {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

export function getRuntimeStorage(): StorageLike | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export function createLocalCollectionRepository<T>(
  options: LocalCollectionRepositoryOptions<T>
): DataProvider<T> {
  const storage = options.storage ?? getRuntimeStorage() ?? new MemoryStorageLike();
  const defaults = options.defaults ?? [];

  const read = (): T[] => {
    const raw = storage.getItem(options.key);
    if (!raw) return [...defaults];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [...defaults];
      return options.guard ? parsed.filter(options.guard) : parsed as T[];
    } catch {
      return [...defaults];
    }
  };

  const write = (items: T[]): T[] => {
    storage.setItem(options.key, JSON.stringify(items));
    return items;
  };

  return {
    list: read,
    getById(id: string) {
      return read().find(item => options.getId(item) === id);
    },
    replaceAll(items: T[]) {
      return write([...items]);
    },
    create(item: T) {
      write([...read(), item]);
      return item;
    },
    update(id: string, patch: Partial<T> | ((item: T) => T)) {
      let updated: T | undefined;
      const items = read().map(item => {
        if (options.getId(item) !== id) return item;
        updated = typeof patch === "function" ? patch(item) : { ...item, ...patch };
        return updated;
      });
      write(items);
      return updated;
    },
    remove(id: string) {
      const items = read();
      const next = items.filter(item => options.getId(item) !== id);
      write(next);
      return next.length !== items.length;
    },
    clear() {
      storage.removeItem(options.key);
    },
  };
}

