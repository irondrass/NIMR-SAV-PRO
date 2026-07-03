/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LOT7_INDEXEDDB_NAME, LOT7_INDEXEDDB_STORE, LOT7_STORAGE_SCHEMA_VERSION } from "./schemaVersion";

export interface IndexedDbRecord {
  key: string;
  value: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface AsyncKeyValueProvider {
  mode: "IndexedDB" | "memory-indexeddb";
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  keys(): Promise<string[]>;
  estimateBytes(): Promise<number | null>;
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined" && typeof indexedDB.open === "function";
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error("IndexedDB indisponible"));
      return;
    }

    const request = indexedDB.open(LOT7_INDEXEDDB_NAME, LOT7_STORAGE_SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOT7_INDEXEDDB_STORE)) {
        db.createObjectStore(LOT7_INDEXEDDB_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Ouverture IndexedDB impossible"));
  });
}

export function createIndexedDbProvider(): AsyncKeyValueProvider {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const getDb = () => {
    dbPromise = dbPromise ?? openDatabase();
    return dbPromise;
  };

  const withStore = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await getDb();
    const tx = db.transaction(LOT7_INDEXEDDB_STORE, mode);
    return requestToPromise(action(tx.objectStore(LOT7_INDEXEDDB_STORE)));
  };

  return {
    mode: "IndexedDB",
    async getItem(key) {
      const record = await withStore<IndexedDbRecord | undefined>("readonly", store => store.get(key));
      return record?.value ?? null;
    },
    async setItem(key, value) {
      const record: IndexedDbRecord = {
        key,
        value,
        updatedAt: new Date().toISOString(),
        schemaVersion: LOT7_STORAGE_SCHEMA_VERSION,
      };
      await withStore<IDBValidKey>("readwrite", store => store.put(record));
    },
    async removeItem(key) {
      await withStore<undefined>("readwrite", store => store.delete(key));
    },
    async keys() {
      return withStore<IDBValidKey[]>("readonly", store => store.getAllKeys()).then(keys => keys.map(String));
    },
    async estimateBytes() {
      const keys = await this.keys();
      let total = 0;
      for (const key of keys) {
        const value = await this.getItem(key);
        total += key.length + (value?.length ?? 0);
      }
      return total;
    },
  };
}

export function createMemoryIndexedDbProvider(initial?: Record<string, string>): AsyncKeyValueProvider {
  const values = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    mode: "memory-indexeddb",
    async getItem(key) {
      return values.has(key) ? values.get(key)! : null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
    async keys() {
      return [...values.keys()];
    },
    async estimateBytes() {
      return [...values.entries()].reduce((total, [key, value]) => total + key.length + value.length, 0);
    },
  };
}
