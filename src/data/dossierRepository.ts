/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DossierSAV } from "../types";
import { isDossierSAV, normalizeDossierForRuntime } from "../sav-core";
import { STORAGE_KEYS } from "../storage-keys";
import { createLocalCollectionRepository, StorageLike } from "./dataProvider";

export function createDossierRepository(storage?: StorageLike | null) {
  const repository = createLocalCollectionRepository<DossierSAV>({
    key: STORAGE_KEYS.dossiers,
    getId: dossier => dossier.id,
    guard: isDossierSAV,
    storage,
  });

  return {
    ...repository,
    list: () => repository.list().map(normalizeDossierForRuntime),
  };
}

export const dossierRepository = createDossierRepository();

