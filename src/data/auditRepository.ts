/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActiviteLog } from "../types";
import { STORAGE_KEYS } from "../storage-keys";
import { isActiviteLog } from "../sav-core";
import { createLocalCollectionRepository, StorageLike } from "./dataProvider";

export function createAuditRepository(storage?: StorageLike | null) {
  return createLocalCollectionRepository<ActiviteLog>({
    key: STORAGE_KEYS.logs,
    getId: log => log.id,
    guard: isActiviteLog,
    storage,
  });
}

export const auditRepository = createAuditRepository();

