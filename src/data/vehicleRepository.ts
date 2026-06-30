/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VehicleMasterRecord } from "../types";
import { STORAGE_KEYS } from "../storage-keys";
import { createLocalCollectionRepository, StorageLike } from "./dataProvider";

export function isVehicleMasterRepositoryRecord(value: unknown): value is VehicleMasterRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<VehicleMasterRecord>;
  return typeof candidate.id === "string" &&
    typeof candidate.brand === "string" &&
    typeof candidate.model === "string";
}

export function createVehicleRepository(storage?: StorageLike | null) {
  return createLocalCollectionRepository<VehicleMasterRecord>({
    key: STORAGE_KEYS.vehicleMaster,
    getId: vehicle => vehicle.id,
    guard: isVehicleMasterRepositoryRecord,
    storage,
  });
}

export const vehicleRepository = createVehicleRepository();
