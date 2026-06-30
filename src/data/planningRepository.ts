/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkshopReservation } from "../types";
import { isWorkshopReservation } from "../sav-core";
import { STORAGE_KEYS } from "../storage-keys";
import { createLocalCollectionRepository, StorageLike } from "./dataProvider";

export function createPlanningRepository(storage?: StorageLike | null) {
  return createLocalCollectionRepository<WorkshopReservation>({
    key: STORAGE_KEYS.reservations,
    getId: reservation => reservation.reservationId,
    guard: isWorkshopReservation,
    storage,
  });
}

export const planningRepository = createPlanningRepository();

