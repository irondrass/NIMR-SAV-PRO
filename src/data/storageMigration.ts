/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { STORAGE_KEYS } from "../storage-keys";
import { AsyncKeyValueProvider, createIndexedDbProvider, isIndexedDbAvailable } from "./indexedDbProvider";
import { createLocalStorageProvider, LocalStorageProvider } from "./localStorageProvider";
import {
  LOT7_STORAGE_MIGRATION_ID,
  LOT7_STORAGE_SCHEMA_VERSION,
  Lot7MigrationStatus,
} from "./schemaVersion";

export interface Lot7StorageCollection {
  key: string;
  label: string;
  kind: "array" | "object" | "string";
  idField?: string;
}

export const LOT7_STORAGE_COLLECTIONS: Lot7StorageCollection[] = [
  { key: STORAGE_KEYS.dossiers, label: "dossiers", kind: "array", idField: "id" },
  { key: STORAGE_KEYS.reclamations, label: "reclamations", kind: "array", idField: "id" },
  { key: STORAGE_KEYS.techs, label: "ressources atelier", kind: "array", idField: "id" },
  { key: STORAGE_KEYS.logs, label: "activite locale", kind: "array", idField: "id" },
  { key: STORAGE_KEYS.reservations, label: "reservations planning", kind: "array", idField: "reservationId" },
  { key: STORAGE_KEYS.availability, label: "disponibilites atelier", kind: "object" },
  { key: STORAGE_KEYS.vehicleMaster, label: "vehicules", kind: "array", idField: "id" },
  { key: STORAGE_KEYS.vehicleMasterLastImport, label: "date import vehicules", kind: "string" },
  { key: STORAGE_KEYS.auditLog, label: "audit trail", kind: "array", idField: "id" },
  { key: STORAGE_KEYS.settings, label: "parametres", kind: "object" },
  { key: STORAGE_KEYS.fileAttachments, label: "metadonnees fichiers", kind: "array", idField: "id" },
  { key: STORAGE_KEYS.storageSchemaVersion, label: "schema local", kind: "string" },
];

export interface StorageMigrationState {
  id: string;
  status: Lot7MigrationStatus;
  schemaVersion: number;
  mode: "IndexedDB" | "localStorage fallback";
  migratedAt?: string;
  lastError?: string;
  migratedKeys: string[];
}

export interface BootstrapLot7StorageResult {
  provider: AsyncKeyValueProvider | null;
  localStorage: LocalStorageProvider;
  state: StorageMigrationState;
}

let activeIndexedDbProvider: AsyncKeyValueProvider | null = null;

function parseArray(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mergeArrayWithoutDuplicateIds(rawSource: string, rawTarget: string | null, idField = "id"): string {
  const sourceItems = parseArray(rawSource);
  const targetItems = parseArray(rawTarget);
  const seen = new Set<string>();
  const merged: unknown[] = [];

  for (const item of targetItems) {
    const id = item && typeof item === "object" ? String((item as Record<string, unknown>)[idField] ?? "") : "";
    if (id) seen.add(id);
    merged.push(item);
  }

  for (const item of sourceItems) {
    const id = item && typeof item === "object" ? String((item as Record<string, unknown>)[idField] ?? "") : "";
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    merged.push(item);
  }

  return JSON.stringify(merged);
}

function serializeMigrationState(state: StorageMigrationState): string {
  return JSON.stringify(state);
}

function createState(status: Lot7MigrationStatus, mode: StorageMigrationState["mode"], migratedKeys: string[], lastError?: string): StorageMigrationState {
  return {
    id: LOT7_STORAGE_MIGRATION_ID,
    status,
    schemaVersion: LOT7_STORAGE_SCHEMA_VERSION,
    mode,
    migratedAt: status === "migrated" ? new Date().toISOString() : undefined,
    lastError,
    migratedKeys,
  };
}

export async function bootstrapLot7Storage(options?: {
  localStorage?: LocalStorageProvider;
  indexedDbProvider?: AsyncKeyValueProvider | null;
}): Promise<BootstrapLot7StorageResult> {
  const localProvider = options?.localStorage ?? createLocalStorageProvider();
  const provider = options?.indexedDbProvider ?? (isIndexedDbAvailable() ? createIndexedDbProvider() : null);
  activeIndexedDbProvider = provider;

  localProvider.setItem(STORAGE_KEYS.storageSchemaVersion, String(LOT7_STORAGE_SCHEMA_VERSION));

  if (!provider) {
    const fallbackState = createState("fallback", "localStorage fallback", []);
    localProvider.setItem(STORAGE_KEYS.storageMigrationState, serializeMigrationState(fallbackState));
    return { provider: null, localStorage: localProvider, state: fallbackState };
  }

  try {
    const migratedKeys: string[] = [];
    await provider.setItem(STORAGE_KEYS.storageSchemaVersion, String(LOT7_STORAGE_SCHEMA_VERSION));

    for (const collection of LOT7_STORAGE_COLLECTIONS) {
      const localRaw = localProvider.getItem(collection.key);
      const indexedRaw = await provider.getItem(collection.key);

      if (localRaw && collection.kind === "array") {
        const merged = mergeArrayWithoutDuplicateIds(localRaw, indexedRaw, collection.idField);
        await provider.setItem(collection.key, merged);
        migratedKeys.push(collection.key);
        continue;
      }

      if (localRaw && !indexedRaw) {
        await provider.setItem(collection.key, localRaw);
        migratedKeys.push(collection.key);
        continue;
      }

      if (!localRaw && indexedRaw) {
        localProvider.setItem(collection.key, indexedRaw);
      }
    }

    const state = createState("migrated", "IndexedDB", migratedKeys);
    localProvider.setItem(STORAGE_KEYS.storageMigrationState, serializeMigrationState(state));
    await provider.setItem(STORAGE_KEYS.storageMigrationState, serializeMigrationState(state));
    return { provider, localStorage: localProvider, state };
  } catch (error) {
    const state = createState("failed", "localStorage fallback", [], error instanceof Error ? error.message : String(error));
    activeIndexedDbProvider = null;
    localProvider.setItem(STORAGE_KEYS.storageMigrationState, serializeMigrationState(state));
    return { provider: null, localStorage: localProvider, state };
  }
}

export function mirrorStorageKeyToIndexedDb(key: string, value: string | null): void {
  if (!activeIndexedDbProvider) return;
  const provider = activeIndexedDbProvider;
  Promise.resolve()
    .then(() => value === null ? provider.removeItem(key) : provider.setItem(key, value))
    .catch(() => {
      activeIndexedDbProvider = null;
    });
}

export async function readIndexedDbValue(key: string): Promise<string | null> {
  if (!activeIndexedDbProvider) return null;
  try {
    return await activeIndexedDbProvider.getItem(key);
  } catch {
    return null;
  }
}
