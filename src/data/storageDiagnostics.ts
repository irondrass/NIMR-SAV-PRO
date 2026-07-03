/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { STORAGE_KEYS } from "../storage-keys";
import { LOT7_STORAGE_COLLECTIONS, StorageMigrationState } from "./storageMigration";
import { LOT7_STORAGE_SCHEMA_VERSION, Lot7StorageMode } from "./schemaVersion";
import { LocalStorageProvider, createLocalStorageProvider } from "./localStorageProvider";
import { AsyncKeyValueProvider } from "./indexedDbProvider";

export interface StorageDiagnostics {
  mode: Lot7StorageMode;
  migrationStatus: string;
  schemaVersion: number;
  dossierCount: number;
  taskCount: number;
  reservationCount: number;
  resourceCount: number;
  auditEventCount: number;
  fileMetadataCount: number;
  vehicleCount: number;
  lastMigration: string | null;
  estimatedBytes: number | null;
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function countArray(raw: string | null): number {
  const parsed = parseJson(raw);
  return Array.isArray(parsed) ? parsed.length : 0;
}

function countTasks(raw: string | null): number {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) return 0;
  return parsed.reduce((total, dossier) => {
    const candidate = dossier as any;
    const lines = dossier && typeof dossier === "object" && Array.isArray(candidate.ordresReparation)
      ? candidate.ordresReparation.length
      : dossier && typeof dossier === "object" && Array.isArray(candidate.repairOrderLines)
        ? candidate.repairOrderLines.length
        : 0;
    return total + lines;
  }, 0);
}

function readMigrationState(localStorage: LocalStorageProvider): StorageMigrationState | null {
  const parsed = parseJson(localStorage.getItem(STORAGE_KEYS.storageMigrationState));
  if (parsed && typeof parsed === "object" && "status" in parsed) {
    return parsed as StorageMigrationState;
  }
  return null;
}

function estimateLocalBytes(localStorage: LocalStorageProvider): number {
  return LOT7_STORAGE_COLLECTIONS.reduce((total, collection) => {
    const value = localStorage.getItem(collection.key);
    return total + collection.key.length + (value?.length ?? 0);
  }, 0);
}

export async function buildStorageDiagnostics(options?: {
  localStorage?: LocalStorageProvider;
  indexedDbProvider?: AsyncKeyValueProvider | null;
}): Promise<StorageDiagnostics> {
  const localProvider = options?.localStorage ?? createLocalStorageProvider();
  const migrationState = readMigrationState(localProvider);
  const provider = options?.indexedDbProvider ?? null;
  const estimatedBytes = provider
    ? await provider.estimateBytes().catch(() => estimateLocalBytes(localProvider))
    : estimateLocalBytes(localProvider);

  return {
    mode: migrationState?.mode ?? (provider ? "IndexedDB" : "localStorage fallback"),
    migrationStatus: migrationState?.status ?? "not-started",
    schemaVersion: Number(localProvider.getItem(STORAGE_KEYS.storageSchemaVersion) || LOT7_STORAGE_SCHEMA_VERSION),
    dossierCount: countArray(localProvider.getItem(STORAGE_KEYS.dossiers)),
    taskCount: countTasks(localProvider.getItem(STORAGE_KEYS.dossiers)),
    reservationCount: countArray(localProvider.getItem(STORAGE_KEYS.reservations)),
    resourceCount: countArray(localProvider.getItem(STORAGE_KEYS.techs)),
    auditEventCount: countArray(localProvider.getItem(STORAGE_KEYS.auditLog)),
    fileMetadataCount: countArray(localProvider.getItem(STORAGE_KEYS.fileAttachments)),
    vehicleCount: countArray(localProvider.getItem(STORAGE_KEYS.vehicleMaster)),
    lastMigration: migrationState?.migratedAt ?? null,
    estimatedBytes,
  };
}

export function buildSynchronousStorageDiagnostics(localStorage?: LocalStorageProvider): StorageDiagnostics {
  const localProvider = localStorage ?? createLocalStorageProvider();
  const migrationState = readMigrationState(localProvider);
  return {
    mode: migrationState?.mode ?? "localStorage fallback",
    migrationStatus: migrationState?.status ?? "not-started",
    schemaVersion: Number(localProvider.getItem(STORAGE_KEYS.storageSchemaVersion) || LOT7_STORAGE_SCHEMA_VERSION),
    dossierCount: countArray(localProvider.getItem(STORAGE_KEYS.dossiers)),
    taskCount: countTasks(localProvider.getItem(STORAGE_KEYS.dossiers)),
    reservationCount: countArray(localProvider.getItem(STORAGE_KEYS.reservations)),
    resourceCount: countArray(localProvider.getItem(STORAGE_KEYS.techs)),
    auditEventCount: countArray(localProvider.getItem(STORAGE_KEYS.auditLog)),
    fileMetadataCount: countArray(localProvider.getItem(STORAGE_KEYS.fileAttachments)),
    vehicleCount: countArray(localProvider.getItem(STORAGE_KEYS.vehicleMaster)),
    lastMigration: migrationState?.migratedAt ?? null,
    estimatedBytes: estimateLocalBytes(localProvider),
  };
}
