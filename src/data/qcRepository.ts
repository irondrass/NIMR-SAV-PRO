/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LOCAL_STORAGE_PREFIX } from "../storage-keys";
import { ChecklistQualite } from "../types";
import { createLocalCollectionRepository, StorageLike } from "./dataProvider";

export interface QcRecord {
  dossierId: string;
  checklist: ChecklistQualite;
  updatedAt: string;
}

export function isQcRecord(value: unknown): value is QcRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<QcRecord>;
  return typeof candidate.dossierId === "string" &&
    typeof candidate.updatedAt === "string" &&
    Boolean(candidate.checklist);
}

export function createQcRepository(storage?: StorageLike | null) {
  return createLocalCollectionRepository<QcRecord>({
    key: `${LOCAL_STORAGE_PREFIX}-qc-v1`,
    getId: record => record.dossierId,
    guard: isQcRecord,
    storage,
  });
}

export const qcRepository = createQcRepository();

