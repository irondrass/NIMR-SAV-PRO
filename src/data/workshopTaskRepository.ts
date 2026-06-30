/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LOCAL_STORAGE_PREFIX } from "../storage-keys";
import { RepairOrderLine } from "../types";
import { createLocalCollectionRepository, StorageLike } from "./dataProvider";

export interface WorkshopTaskRecord extends RepairOrderLine {
  dossierId: string;
}

export function isWorkshopTaskRecord(value: unknown): value is WorkshopTaskRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkshopTaskRecord>;
  return typeof candidate.id === "string" &&
    typeof candidate.dossierId === "string" &&
    typeof candidate.designation === "string" &&
    typeof candidate.status === "string";
}

export function createWorkshopTaskRepository(storage?: StorageLike | null) {
  return createLocalCollectionRepository<WorkshopTaskRecord>({
    key: `${LOCAL_STORAGE_PREFIX}-workshop-tasks-v1`,
    getId: task => task.id,
    guard: isWorkshopTaskRecord,
    storage,
  });
}

export const workshopTaskRepository = createWorkshopTaskRepository();

