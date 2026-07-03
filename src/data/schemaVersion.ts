/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const LOT7_STORAGE_SCHEMA_VERSION = 7;
export const LOT7_INDEXEDDB_NAME = "nimr-sav-pro-local-db";
export const LOT7_INDEXEDDB_STORE = "keyValue";
export const LOT7_STORAGE_MIGRATION_ID = "lot7-localstorage-to-indexeddb";

export type Lot7StorageMode = "IndexedDB" | "localStorage fallback";
export type Lot7MigrationStatus = "not-started" | "migrated" | "fallback" | "failed";
