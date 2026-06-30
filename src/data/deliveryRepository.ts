/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LOCAL_STORAGE_PREFIX } from "../storage-keys";
import { DeliveryProtocole } from "../types";
import { createLocalCollectionRepository, StorageLike } from "./dataProvider";

export interface DeliveryRecord {
  dossierId: string;
  delivery: DeliveryProtocole;
  updatedAt: string;
}

export function isDeliveryRecord(value: unknown): value is DeliveryRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DeliveryRecord>;
  return typeof candidate.dossierId === "string" &&
    typeof candidate.updatedAt === "string" &&
    Boolean(candidate.delivery);
}

export function createDeliveryRepository(storage?: StorageLike | null) {
  return createLocalCollectionRepository<DeliveryRecord>({
    key: `${LOCAL_STORAGE_PREFIX}-delivery-v1`,
    getId: record => record.dossierId,
    guard: isDeliveryRecord,
    storage,
  });
}

export const deliveryRepository = createDeliveryRepository();

