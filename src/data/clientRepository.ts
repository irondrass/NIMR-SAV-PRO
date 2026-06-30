/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LOCAL_STORAGE_PREFIX } from "../storage-keys";
import { createLocalCollectionRepository, StorageLike } from "./dataProvider";

export interface ClientRecord {
  id: string;
  name: string;
  phone?: string;
  lastDossierId?: string;
  updatedAt: string;
}

export function isClientRecord(value: unknown): value is ClientRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ClientRecord>;
  return typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.updatedAt === "string";
}

export function createClientRepository(storage?: StorageLike | null) {
  return createLocalCollectionRepository<ClientRecord>({
    key: `${LOCAL_STORAGE_PREFIX}-clients-v1`,
    getId: client => client.id,
    guard: isClientRecord,
    storage,
  });
}

export const clientRepository = createClientRepository();

